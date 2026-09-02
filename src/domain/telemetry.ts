import type { Crane, DayData, Interval, Sample, Severity, TimelineEvent, WorkMode } from './types'
import { getCrane } from './fleet'
import { between, hashString, intBetween, makeRng } from './rng'
import {
  DEMO_NOW_MIN,
  MINUTES_PER_DAY,
  STEP_MIN,
  isFutureKey,
  isTodayKey,
  shiftKey,
  tsOf,
} from './time'
import { hms, num, tons } from './format'

/* ------------------------------------------------------------------ *
 * Генератор суточной телеметрии.
 *
 * Идея: сутки собираются из «блоков» (стоянка → прогрев → циклы подъёма
 * с паузами → стоянка → нет связи). Блоки строятся детерминированно от
 * seed «id крана + дата», поэтому архив за любое число воспроизводим.
 * Для «сегодня» план подгоняется так, чтобы в момент DEMO_NOW сойтись
 * к якорным значениям крана из fleet.ts.
 * ------------------------------------------------------------------ */

type BlockKind = 'off' | 'warmup' | 'idle' | 'cycle' | 'offline'

interface Block {
  kind: BlockKind
  from: number
  to: number
  /** Пик загрузки цикла, %. */
  peak: number
  /** Порядковый номер цикла (для счётчика завершённых). */
  cycleIndex: number
  /** Незавершённый цикл — идёт прямо сейчас. */
  partial: boolean
  boomLenM: number
  angleLowDeg: number
  angleHighDeg: number
  azimuthFromDeg: number
  azimuthToDeg: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Дешёвый детерминированный шум в диапазоне -0.5..0.5. */
function jitter(seed: number, min: number, salt = 0): number {
  let x = Math.imul(seed ^ Math.imul(min + 1, 2654435761) ^ salt, 0x27d4eb2d)
  x ^= x >>> 15
  x = Math.imul(x, 0x85ebca6b)
  x ^= x >>> 13
  return (x >>> 0) / 4294967296 - 0.5
}

/**
 * Допустимая масса при текущем вылете. Кривая подобрана так, чтобы на
 * якорном вылете крана получалось ровно его якорное «Допустимо».
 */
function allowedAt(crane: Crane, radiusM: number): number {
  const cap = crane.passport.capacityT
  const cur = crane.current
  const refR =
    cur.allowedT > 0 && cur.radiusM > 0
      ? cur.radiusM * Math.min(1, cur.allowedT / cap)
      : crane.passport.maxBoomM * 0.26
  return cap * clamp(refR / Math.max(radiusM, 1), 0.12, 1)
}

/** Вылет и высота крюка — производные от длины стрелы и угла. */
function geometry(boomLenM: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    radiusM: Math.max(1.2, boomLenM * Math.cos(rad) - 0.85),
    heightM: Math.max(0.5, boomLenM * Math.sin(rad) + 0.1),
  }
}

function severityOf(mode: WorkMode, online: boolean, loadPct: number | null): Severity {
  if (!online) return 'offline'
  if (mode === 'off' || mode === 'idle' || mode === 'warmup') return 'idle'
  if (loadPct == null) return 'idle'
  if (loadPct > 100) return 'alarm'
  if (loadPct >= 90) return 'warn'
  return 'ok'
}

/* ------------------------------- план суток ------------------------------- */

function buildBlocks(crane: Crane, dateKey: string, rng: () => number): Block[] {
  const today = isTodayKey(dateKey)
  const cutoff = today ? DEMO_NOW_MIN : MINUTES_PER_DAY

  // Кран без связи: с этой минуты данных нет. -1 — нет данных за все сутки.
  const offlineFrom =
    today && crane.lastSeenMin !== null ? Math.max(0, crane.lastSeenMin) : Number.POSITIVE_INFINITY

  const mk = (b: Partial<Block> & Pick<Block, 'kind' | 'from' | 'to'>): Block => ({
    peak: 0,
    cycleIndex: -1,
    partial: false,
    boomLenM: 0,
    angleLowDeg: 0,
    angleHighDeg: 0,
    azimuthFromDeg: 0,
    azimuthToDeg: 0,
    ...b,
  })

  const tail = (from: number): Block[] => {
    const out: Block[] = []
    if (offlineFrom <= from) {
      out.push(mk({ kind: 'offline', from, to: MINUTES_PER_DAY }))
    } else {
      const stop = Math.min(offlineFrom, MINUTES_PER_DAY)
      if (stop > from) out.push(mk({ kind: 'off', from, to: stop }))
      if (stop < MINUTES_PER_DAY) out.push(mk({ kind: 'offline', from: stop, to: MINUTES_PER_DAY }))
    }
    return out
  }

  // --- параметры смены -------------------------------------------------
  let workMin: number
  let cycles: number
  let idleMin: number
  let maxLoad: number
  let overloads: number

  if (today) {
    workMin = crane.shift.workMin
    cycles = crane.shift.cycles
    idleMin = crane.lastSeenMin !== null ? 0 : crane.shift.idleMin
    maxLoad = crane.shift.maxLoadPct ?? 0
    overloads = crane.shift.overloads
  } else {
    workMin = Math.round(between(rng, 170, 430))
    cycles = Math.max(1, Math.round(workMin / between(rng, 20, 40)))
    idleMin = Math.round(between(rng, 8, 95))
    const alarmDay = crane.status === 'alarm' ? rng() < 0.55 : rng() < 0.05
    maxLoad = alarmDay ? Math.round(between(rng, 103, 126)) : Math.round(between(rng, 58, 99))
    overloads = alarmDay ? intBetween(rng, 1, 3) : 0
  }

  // Двигатель вообще не запускался (или сутки целиком без связи).
  let endWork = today ? cutoff : Math.round(between(rng, 16 * 60, 19 * 60 + 30))
  if (offlineFrom < endWork) endWork = offlineFrom
  if (workMin <= 0 || cycles <= 0 || endWork <= 0) return tail(0)

  let warmup = Math.round(between(rng, 22, 46))
  let span = warmup + workMin + idleMin
  let start = endWork - span
  if (start < 0) {
    // Окно не помещается в сутки до последнего контакта — сжимаем пропорционально.
    const k = endWork / span
    warmup = Math.max(2, Math.round(warmup * k))
    workMin = workMin * k
    idleMin = Math.round(idleMin * k)
    span = warmup + workMin + idleMin
    start = Math.max(0, endWork - span)
  }

  // --- пики загрузки по циклам ----------------------------------------
  const peaks: number[] = []
  for (let i = 0; i < cycles; i++) {
    if (i < overloads) {
      peaks.push(Math.round(between(rng, 101, Math.max(103, maxLoad))))
    } else {
      peaks.push(
        Math.round(between(rng, Math.max(18, maxLoad * 0.4), Math.max(28, maxLoad * 0.93))),
      )
    }
  }
  if (cycles > 0) {
    const hero = overloads > 0 ? 0 : intBetween(rng, 0, cycles - 1)
    peaks[hero] = maxLoad
  }

  // --- раскладка блоков -------------------------------------------------
  const endsIdle = today && crane.current.mode === 'idle'
  const endsMidCycle = today && crane.current.mode === 'load'
  const partialLen = endsMidCycle ? Math.min(workMin * 0.14, 18) : 0
  const cycleLen = (workMin - partialLen) / cycles

  // Простой раскидываем паузами между циклами; если кран простаивает прямо
  // сейчас — весь простой уезжает в хвост смены, после последнего цикла.
  const gapByCycle = new Map<number, number>()
  if (idleMin > 0) {
    if (endsIdle) {
      gapByCycle.set(cycles - 1, idleMin)
    } else {
      const gapCount = clamp(Math.round(idleMin / 25), 1, 3)
      const gapLen = idleMin / gapCount
      for (let g = 0; g < gapCount; g++) {
        const idx = clamp(Math.round(((g + 1) * cycles) / (gapCount + 1)), 0, cycles - 1)
        gapByCycle.set(idx, (gapByCycle.get(idx) ?? 0) + gapLen)
      }
    }
  }

  const blocks: Block[] = []
  if (start > 0) blocks.push(mk({ kind: 'off', from: 0, to: start }))
  blocks.push(mk({ kind: 'warmup', from: start, to: start + warmup }))

  let t = start + warmup
  const maxBoom = crane.passport.maxBoomM
  for (let i = 0; i < cycles; i++) {
    const boomLenM =
      today && i === cycles - 1 && crane.current.boomLenM > 0
        ? crane.current.boomLenM
        : Number(lerp(maxBoom * 0.42, maxBoom * 0.82, rng()).toFixed(2))
    const angleHighDeg = Number(between(rng, 52, 74).toFixed(2))
    const angleLowDeg = Number(clamp(angleHighDeg - between(rng, 8, 22), 22, 70).toFixed(2))
    const azimuthFromDeg = Math.round(between(rng, 0, 359))
    const azimuthToDeg = Math.round((azimuthFromDeg + between(rng, 40, 190)) % 360)

    blocks.push(
      mk({
        kind: 'cycle',
        from: t,
        to: t + cycleLen,
        peak: peaks[i] as number,
        cycleIndex: i,
        boomLenM,
        angleLowDeg,
        angleHighDeg,
        azimuthFromDeg,
        azimuthToDeg,
      }),
    )
    t += cycleLen

    const gap = gapByCycle.get(i)
    if (gap && gap > 0) {
      blocks.push(mk({ kind: 'idle', from: t, to: t + gap }))
      t += gap
    }
  }

  if (partialLen > 0) {
    const cur = crane.current
    blocks.push(
      mk({
        kind: 'cycle',
        from: t,
        to: t + partialLen,
        peak: cur.loadPct ?? 0,
        cycleIndex: cycles,
        partial: true,
        boomLenM: cur.boomLenM || maxBoom * 0.7,
        angleLowDeg: Math.max(20, cur.boomAngleDeg - 14),
        angleHighDeg: cur.boomAngleDeg,
        azimuthFromDeg: Math.max(0, cur.azimuthDeg - 60),
        azimuthToDeg: cur.azimuthDeg,
      }),
    )
    t += partialLen
  }

  return [...blocks, ...tail(Math.min(t, MINUTES_PER_DAY))]
}

/* ----------------------------- точки ряда ----------------------------- */

interface CycleShape {
  mode: WorkMode
  loadFactor: number
  anglePos: number
  azimuthPos: number
}

/** Профиль одного цикла: подъезд → подъём → перенос → опускание → отход. */
function cycleShape(f: number): CycleShape {
  if (f < 0.16) return { mode: 'noload', loadFactor: 0, anglePos: (f / 0.16) * 0.3, azimuthPos: 0 }
  if (f < 0.3) {
    const k = (f - 0.16) / 0.14
    return { mode: 'load', loadFactor: k, anglePos: 0.3 + k * 0.5, azimuthPos: k * 0.15 }
  }
  if (f < 0.7) {
    const k = (f - 0.3) / 0.4
    return {
      mode: 'load',
      loadFactor: 0.94 + 0.06 * Math.sin(k * Math.PI),
      anglePos: 0.8 + 0.2 * Math.sin(k * Math.PI),
      azimuthPos: 0.15 + k * 0.75,
    }
  }
  if (f < 0.84) {
    const k = (f - 0.7) / 0.14
    return { mode: 'load', loadFactor: 1 - k, anglePos: 0.8 - k * 0.5, azimuthPos: 0.9 + k * 0.1 }
  }
  const k = (f - 0.84) / 0.16
  return { mode: 'noload', loadFactor: 0, anglePos: 0.3 * (1 - k), azimuthPos: 1 }
}

function blockAt(blocks: Block[], min: number): Block {
  for (const b of blocks) if (min >= b.from && min < b.to) return b
  return blocks[blocks.length - 1] as Block
}

function buildSamples(crane: Crane, dateKey: string, blocks: Block[], cutoffMin: number): Sample[] {
  const seed = hashString(crane.id + '|' + dateKey)
  const engineStart = blocks.find((b) => b.kind === 'warmup')?.from ?? 0
  const engineEnd =
    [...blocks].reverse().find((b) => b.kind === 'cycle' || b.kind === 'idle')?.to ?? 0
  const fuelStart = clamp(crane.current.fuelPct + 24 + jitter(seed, 7) * 10, 30, 97)
  const fuelEnd =
    isTodayKey(dateKey) && crane.current.fuelPct > 0
      ? crane.current.fuelPct
      : clamp(fuelStart - 32, 12, 95)

  const samples: Sample[] = []
  let cyclesDone = 0
  let workAcc = 0
  let idleAcc = 0
  let liftedAcc = 0
  let overloadAcc = 0
  let lastCycleIndex = -1
  let cyclePeakSeen = 0
  let cyclePeakMass = 0

  // Сетка минут: ровный шаг плюс отдельная точка ровно на «сейчас»,
  // иначе последнее значение отставало бы от DEMO_NOW на шаг.
  const minutes: number[] = []
  const lastGrid = Math.min(cutoffMin, MINUTES_PER_DAY - STEP_MIN)
  for (let m = 0; m <= lastGrid; m += STEP_MIN) minutes.push(m)
  if (minutes[minutes.length - 1] !== cutoffMin && cutoffMin < MINUTES_PER_DAY)
    minutes.push(cutoffMin)

  for (const min of minutes) {
    const b = blockAt(blocks, min)
    const online = b.kind !== 'offline'
    const span = Math.max(1e-6, b.to - b.from)
    const f = clamp((min - b.from) / span, 0, 1)

    let mode: WorkMode = 'off'
    let loadPct: number | null = 0
    let boomLenM = 0
    let angleDeg = 0
    let azimuthDeg = 0

    if (!online) {
      mode = 'off'
      loadPct = null
    } else if (b.kind === 'off') {
      mode = 'off'
      loadPct = 0
    } else if (b.kind === 'warmup') {
      mode = 'warmup'
      loadPct = 0
      boomLenM = crane.passport.maxBoomM * 0.3
      angleDeg = 8 + f * 14
    } else if (b.kind === 'idle') {
      mode = 'idle'
      loadPct = 0
      boomLenM = crane.passport.maxBoomM * 0.35
      angleDeg = 26
    } else {
      const shape = cycleShape(f)
      mode = shape.mode
      loadPct = Math.round(b.peak * shape.loadFactor * (1 + jitter(seed, min, 3) * 0.03) * 10) / 10
      boomLenM = b.boomLenM
      angleDeg = lerp(b.angleLowDeg, b.angleHighDeg, shape.anglePos)
      azimuthDeg = Math.round(lerp(b.azimuthFromDeg, b.azimuthToDeg, shape.azimuthPos))
    }

    const geo = geometry(boomLenM, angleDeg)
    const allowedT = boomLenM > 0 ? allowedAt(crane, geo.radiusM) : 0
    const massT = loadPct == null ? 0 : (allowedT * loadPct) / 100

    // накопители
    if (online) {
      if (mode === 'load' || mode === 'noload') workAcc += STEP_MIN
      else if (mode === 'idle' || mode === 'warmup') idleAcc += STEP_MIN
    }
    if (b.kind === 'cycle') {
      if (b.cycleIndex !== lastCycleIndex) {
        if (lastCycleIndex >= 0) {
          cyclesDone += 1
          liftedAcc += cyclePeakMass
          if (cyclePeakSeen > 100) overloadAcc += 1
        }
        lastCycleIndex = b.cycleIndex
        cyclePeakSeen = 0
        cyclePeakMass = 0
      }
      cyclePeakSeen = Math.max(cyclePeakSeen, loadPct ?? 0)
      cyclePeakMass = Math.max(cyclePeakMass, massT)
    }

    const engineOn = online && mode !== 'off'
    const sinceStart = Math.max(0, min - engineStart)
    const warmK = engineOn ? 1 - Math.exp(-sinceStart / 42) : 0
    const loadK = mode === 'load' ? (loadPct ?? 0) / 100 : 0

    const rpm = !engineOn
      ? 0
      : mode === 'warmup'
        ? Math.round(lerp(620, 900, f) + jitter(seed, min, 1) * 40)
        : mode === 'idle'
          ? Math.round(780 + jitter(seed, min, 1) * 60)
          : mode === 'noload'
            ? Math.round(960 + jitter(seed, min, 1) * 90)
            : Math.round(clamp(1080 + loadK * 460, 900, 1850) + jitter(seed, min, 1) * 50)

    const ambient = crane.tempC
    const oilTempC = engineOn
      ? Number(
          (
            ambient +
            (crane.current.oilTempC - ambient || 70) * warmK +
            loadK * 5 +
            jitter(seed, min, 2) * 1.2
          ).toFixed(1),
        )
      : Number((ambient + 0.4).toFixed(1))
    const coolantTempC = engineOn
      ? Number(
          (
            ambient +
            (crane.current.coolantTempC - ambient || 62) * warmK +
            loadK * 4 +
            jitter(seed, min, 4) * 1
          ).toFixed(1),
        )
      : Number(ambient.toFixed(1))
    const hydOilTempC = engineOn
      ? Number(
          (
            ambient +
            (crane.current.hydOilTempC - ambient || 40) * warmK +
            loadK * 6 +
            jitter(seed, min, 5) * 1
          ).toFixed(1),
        )
      : Number(ambient.toFixed(1))
    const hydPressureKpa = !engineOn
      ? 0
      : mode === 'idle' || mode === 'warmup'
        ? Math.round(260 + jitter(seed, min, 6) * 90)
        : mode === 'noload'
          ? Math.round(2100 + jitter(seed, min, 6) * 500)
          : Math.round(clamp(2800 + massT * 560, 2500, 21000) + jitter(seed, min, 6) * 220)

    const runSpan = Math.max(1, engineEnd - engineStart)
    const fuelK = clamp((min - engineStart) / runSpan, 0, 1)
    const fuelPct =
      engineOn || min > engineStart
        ? Number(clamp(lerp(fuelStart, fuelEnd, fuelK), 0, 100).toFixed(0))
        : Number(fuelStart.toFixed(0))
    const voltageV = !online
      ? 0
      : engineOn
        ? Number((27.6 + jitter(seed, min, 8) * 0.6).toFixed(1))
        : Number((24.3 + jitter(seed, min, 8) * 0.4).toFixed(1))

    samples.push({
      ts: tsOf(dateKey, min),
      min,
      mode,
      severity: severityOf(mode, online, loadPct),
      online,
      loadPct: online ? loadPct : null,
      massT: Number(massT.toFixed(2)),
      allowedT: Number(allowedT.toFixed(2)),
      boomAngleDeg: Number(angleDeg.toFixed(2)),
      boomLenM: Number(boomLenM.toFixed(2)),
      radiusM: Number((boomLenM > 0 ? geo.radiusM : 0).toFixed(2)),
      heightM: Number((boomLenM > 0 ? geo.heightM : 0).toFixed(2)),
      azimuthDeg,
      rpm,
      oilTempC,
      coolantTempC,
      hydPressureKpa,
      hydOilTempC,
      fuelPct,
      voltageV,
      tiltXDeg: Number((engineOn ? Math.abs(jitter(seed, min, 9)) * 1.1 : 0).toFixed(2)),
      tiltYDeg: Number((engineOn ? Math.abs(jitter(seed, min, 10)) * 0.8 : 0).toFixed(2)),
      cyclesDone,
      workMin: workAcc,
      idleMin: idleAcc,
      liftedT: Number(liftedAcc.toFixed(2)),
      overloads: overloadAcc,
    })
  }

  if (!isTodayKey(dateKey) || samples.length === 0) return samples

  // Кран без связи: итоги смены замирают на моменте последнего контакта.
  if (crane.lastSeenMin !== null) {
    const lastOnlineIdx = samples.reduce((acc, s, i) => (s.online ? i : acc), -1)
    if (lastOnlineIdx >= 0) {
      for (let i = lastOnlineIdx; i < samples.length; i++) {
        const s = samples[i] as Sample
        s.cyclesDone = crane.shift.cycles
        s.workMin = crane.shift.workMin
        s.idleMin = crane.shift.idleMin
        s.liftedT = crane.shift.liftedT
        s.overloads = crane.shift.overloads
      }
    }
    return samples
  }

  // Кран на связи: последняя точка — якорь, ровно значения из fleet.ts.
  {
    const last = samples[samples.length - 1] as Sample
    const cur = crane.current
    Object.assign(last, {
      mode: cur.mode,
      loadPct: cur.loadPct,
      massT: cur.massT,
      allowedT: cur.allowedT,
      boomAngleDeg: cur.boomAngleDeg,
      boomLenM: cur.boomLenM,
      radiusM: cur.radiusM,
      heightM: cur.heightM,
      azimuthDeg: cur.azimuthDeg,
      rpm: cur.rpm,
      oilTempC: cur.oilTempC,
      coolantTempC: cur.coolantTempC,
      hydPressureKpa: cur.hydPressureKpa,
      hydOilTempC: cur.hydOilTempC,
      fuelPct: cur.fuelPct,
      voltageV: cur.voltageV,
      tiltXDeg: cur.tiltXDeg,
      tiltYDeg: cur.tiltYDeg,
      cyclesDone: crane.shift.cycles,
      workMin: crane.shift.workMin,
      idleMin: crane.shift.idleMin,
      liftedT: crane.shift.liftedT,
      overloads: crane.shift.overloads,
      severity: severityOf(cur.mode, true, cur.loadPct),
    } satisfies Partial<Sample>)
  }

  return samples
}

/* ------------------------- интервалы и события ------------------------- */

const MODE_LABEL: Record<BlockKind, string> = {
  off: 'Простой, двигатель выключен',
  warmup: 'Прогрев, установка опор',
  idle: 'Простой с включённым двигателем',
  cycle: 'Работа с грузом',
  offline: 'Нет связи',
}

function blockSeverity(b: Block): Severity {
  if (b.kind === 'offline') return 'offline'
  if (b.kind !== 'cycle') return 'idle'
  if (b.peak > 100) return 'alarm'
  if (b.peak >= 90) return 'warn'
  return 'ok'
}

function buildIntervals(blocks: Block[], cutoffMin: number): Interval[] {
  const out: Interval[] = []
  for (const b of blocks) {
    if (b.from >= cutoffMin) break
    const to = Math.min(b.to, cutoffMin)
    if (to - b.from < 0.5) continue
    const sev = blockSeverity(b)
    const prev = out[out.length - 1]
    const sameRun =
      prev &&
      prev.severity === sev &&
      ((prev.mode === 'load' && b.kind === 'cycle') ||
        (prev.mode !== 'load' && prev.label === MODE_LABEL[b.kind]))

    if (sameRun && prev) {
      prev.toMin = to
      prev.cycles += b.kind === 'cycle' && !b.partial ? 1 : 0
      prev.maxLoadPct = Math.max(prev.maxLoadPct ?? 0, b.kind === 'cycle' ? b.peak : 0) || null
      continue
    }

    out.push({
      fromMin: b.from,
      toMin: to,
      mode: b.kind === 'cycle' ? 'load' : b.kind === 'offline' ? 'off' : (b.kind as WorkMode),
      severity: sev,
      label: MODE_LABEL[b.kind],
      cycles: b.kind === 'cycle' && !b.partial ? 1 : 0,
      maxLoadPct: b.kind === 'cycle' ? b.peak : null,
      event:
        sev === 'alarm'
          ? 'Перегруз'
          : sev === 'warn'
            ? 'Предупреждение'
            : b.kind === 'offline'
              ? 'Потеря связи'
              : '—',
    })
  }
  // «хвост» суток, до которого данные ещё не дошли
  if (cutoffMin < MINUTES_PER_DAY) {
    out.push({
      fromMin: cutoffMin,
      toMin: MINUTES_PER_DAY,
      mode: 'off',
      severity: 'idle',
      label: 'Данные ожидаются',
      cycles: 0,
      maxLoadPct: null,
      event: '—',
    })
  }
  return out
}

function buildEvents(
  crane: Crane,
  dateKey: string,
  blocks: Block[],
  cutoffMin: number,
): TimelineEvent[] {
  const out: TimelineEvent[] = []
  const push = (min: number, kind: string, text: string, severity: Severity) => {
    if (min > cutoffMin) return
    out.push({ ts: tsOf(dateKey, min), min, kind, text, severity })
  }

  for (const b of blocks) {
    if (b.from > cutoffMin) break
    if (b.kind === 'warmup') {
      push(b.from, 'Начало работы', `Запуск двигателя · ${crane.operator}`, 'idle')
      push(b.to, 'Опоры', `Контур ${crane.passport.outriggers} установлен`, 'idle')
    }
    if (b.kind === 'idle') {
      push(b.from, 'Простой', 'Двигатель работает, груза нет', 'idle')
    }
    if (b.kind === 'offline') {
      push(b.from, 'Нет связи', `Последняя точка · ${crane.place}`, 'offline')
    }
    if (b.kind === 'cycle') {
      const peakMin = b.from + (b.to - b.from) * 0.45
      if (b.peak > 100) {
        push(peakMin, 'Перегруз', `Загрузка ${num(b.peak, 0)}% от допустимой`, 'alarm')
      } else if (b.peak >= 90) {
        push(peakMin, 'Предупреждение', `Загрузка ${num(b.peak, 0)}% от допустимой`, 'warn')
      }
      if (!b.partial) {
        const mass = (allowedAt(crane, geometry(b.boomLenM, b.angleHighDeg).radiusM) * b.peak) / 100
        push(b.to, 'Цикл завершён', `Масса ${tons(mass)} · ${hms((b.to - b.from) * 60)}`, 'ok')
      }
    }
  }

  // Регулярная отметка «Данные» — как в реальной системе (опрос раз в 30 сек).
  const lastOnline = [...blocks].reverse().find((b) => b.kind !== 'offline')
  if (lastOnline && lastOnline.to >= cutoffMin) {
    push(
      cutoffMin,
      'Данные',
      `Давление ${num(crane.current.hydPressureKpa)} kPa · ${num(crane.current.rpm)} rpm`,
      'idle',
    )
  }

  return out.sort((a, b) => b.min - a.min)
}

/* ------------------------------- фасад ------------------------------- */

const cache = new Map<string, DayData>()

export function getDay(craneId: string, dateKey: string): DayData {
  const key = `${craneId}|${dateKey}`
  const hit = cache.get(key)
  if (hit) return hit

  const crane = getCrane(craneId)
  if (isFutureKey(dateKey)) {
    const empty: DayData = {
      craneId,
      dateKey,
      samples: [],
      intervals: [],
      events: [],
      cutoffMin: 0,
    }
    cache.set(key, empty)
    return empty
  }

  const rng = makeRng(`${craneId}|${dateKey}`)
  const blocks = buildBlocks(crane, dateKey, rng)
  const cutoffMin = isTodayKey(dateKey) ? DEMO_NOW_MIN : MINUTES_PER_DAY
  const data: DayData = {
    craneId,
    dateKey,
    samples: buildSamples(crane, dateKey, blocks, cutoffMin),
    intervals: buildIntervals(blocks, cutoffMin),
    events: buildEvents(crane, dateKey, blocks, cutoffMin),
    cutoffMin,
  }
  cache.set(key, data)
  return data
}

/** Ряд за несколько суток подряд (для диапазона «7 дней»). */
export function getRange(craneId: string, endDateKey: string, days: number): Sample[] {
  const out: Sample[] = []
  for (let i = days - 1; i >= 0; i--) {
    out.push(...getDay(craneId, shiftKey(endDateKey, -i)).samples)
  }
  return out
}

/** Индекс ближайшей к `ts` точки ряда (бинарный поиск: сетка неравномерна). */
export function indexAt(samples: Sample[], ts: number): number {
  if (samples.length === 0) return -1
  let lo = 0
  let hi = samples.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((samples[mid] as Sample).ts < ts) lo = mid + 1
    else hi = mid
  }
  const prev = Math.max(0, lo - 1)
  const dPrev = Math.abs((samples[prev] as Sample).ts - ts)
  const dLo = Math.abs((samples[lo] as Sample).ts - ts)
  return dPrev <= dLo ? prev : lo
}

/** Ближайшая точка ряда к моменту `ts`. */
export function sampleAt(samples: Sample[], ts: number): Sample | null {
  const i = indexAt(samples, ts)
  return i < 0 ? null : (samples[i] as Sample)
}
