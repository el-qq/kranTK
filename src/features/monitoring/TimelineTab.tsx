import { clock, hmsFromMin, num, pct, tons } from '../../domain/format'
import { STEP_MIN, formatKeyRu, tsOf } from '../../domain/time'
import type { Interval, Sample } from '../../domain/types'
import { SEV_BAR, TimelineBar } from './TimelineBar'
import { RANGES, SPEEDS, type RangeKey } from './useTimeline'

interface Props {
  dateKey: string
  range: RangeKey
  onRange: (r: RangeKey) => void
  from: number
  to: number
  samples: Sample[]
  intervals: Interval[]
  cursorTs: number
  playing: boolean
  speed: number
  onSpeed: (s: number) => void
  onToggle: () => void
  onSeek: (ts: number) => void
  onStep: (dir: -1 | 1) => void
}

const LEGEND: { sev: keyof typeof SEV_BAR; label: string }[] = [
  { sev: 'ok', label: 'норма' },
  { sev: 'warn', label: 'предупреждение' },
  { sev: 'alarm', label: 'перегруз' },
  { sev: 'idle', label: 'простой' },
  { sev: 'offline', label: 'нет связи' },
]

export function TimelineTab(p: Props) {
  const upToCursor = p.samples.filter((s) => s.ts <= p.cursorTs)
  const stats = accumulate(upToCursor)
  const peak = peaks(upToCursor)
  const rangeLabel = RANGES.find((r) => r.key === p.range)?.label ?? ''

  return (
    <div className="mon__stack">
      <section className="card card-pad tl">
        <div className="tl__head">
          <span className="eyebrow">Хронология работы · {rangeLabel}</span>
          <div className="spacer" />
          <div className="seg">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                data-on={p.range === r.key}
                onClick={() => p.onRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="tl__legend">
            {LEGEND.map((l) => (
              <span key={l.sev}>
                <i style={{ background: SEV_BAR[l.sev] }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        <div className="tl__player">
          <div className="tl__controls">
            <button
              type="button"
              className="tl__play"
              onClick={p.onToggle}
              title={p.playing ? 'Пауза' : 'Воспроизвести'}
            >
              {p.playing ? '❚❚' : '▶'}
            </button>
            <div className="tl__speed">
              {SPEEDS.map((s) => (
                <button key={s} type="button" data-on={p.speed === s} onClick={() => p.onSpeed(s)}>
                  {s}x
                </button>
              ))}
            </div>
            <button
              type="button"
              className="tl__step"
              onClick={() => p.onStep(-1)}
              title="Предыдущий интервал"
            >
              «
            </button>
            <button
              type="button"
              className="tl__step"
              onClick={() => p.onStep(1)}
              title="Следующий интервал"
            >
              »
            </button>
          </div>

          <TimelineBar
            from={p.from}
            to={p.to}
            samples={p.samples}
            cursorTs={p.cursorTs}
            range={p.range}
            dateKey={p.dateKey}
            onSeek={p.onSeek}
          />
        </div>

        <div className="tl__note hint">
          Полосу можно тянуть мышью или стрелками ←/→. Скорость 1x — вся шкала за 60 секунд.
          Показатели ниже и вкладка «Обзор» пересчитываются на момент курсора.
        </div>

        <div className="mon__groups tl__groups">
          <Group
            title="Итого к моменту курсора"
            rows={[
              ['Работа', hmsFromMin(stats.workMin)],
              ['Простой', hmsFromMin(stats.idleMin + stats.offMin)],
              ['Циклов', String(stats.cycles)],
              [
                'Перегрузов',
                String(stats.overloads),
                stats.overloads > 0 ? 'var(--danger)' : 'var(--ok-text)',
              ],
            ]}
          />
          <Group
            title="Распределение"
            rows={[
              ['С грузом', pct(share(stats.loadMin, stats.total))],
              ['Без груза', pct(share(stats.noloadMin, stats.total))],
              ['Двигатель на холостом', pct(share(stats.idleMin, stats.total))],
              [
                'Нет связи',
                pct(share(stats.offlineMin, stats.total)),
                stats.offlineMin > 0 ? 'var(--warn)' : undefined,
              ],
            ]}
          />
          <Group
            title="Пики"
            rows={[
              ['Пик активности', peak.busiestHour],
              [
                'Макс. загрузка',
                pct(peak.maxLoad),
                (peak.maxLoad ?? 0) > 100
                  ? 'var(--danger)'
                  : (peak.maxLoad ?? 0) >= 90
                    ? 'var(--warn)'
                    : undefined,
              ],
              ['Макс. вылет', peak.maxRadius != null ? `${num(peak.maxRadius, 2)} м` : '—'],
              ['Макс. масса', peak.maxMass != null ? tons(peak.maxMass) : '—'],
            ]}
          />
        </div>
      </section>

      <section className="card mon__table">
        <div className="mon__table-head">
          <div className="dash__card-title">Интервалы работы</div>
          <div className="spacer" />
          <span className="hint">
            за {formatKeyRu(p.dateKey)} · клик по интервалу — курсор встаёт на его начало
          </span>
        </div>
        <div className="mon__table-scroll">
          <div className="mon__row mon__row--head">
            <div>Интервал</div>
            <div>Длительность</div>
            <div>Режим</div>
            <div>Циклов</div>
            <div>Макс. загрузка</div>
            <div>Событие</div>
          </div>
          {p.intervals.map((i) => {
            const active =
              p.cursorTs >= tsOf(p.dateKey, i.fromMin) && p.cursorTs < tsOf(p.dateKey, i.toMin)
            return (
              <button
                key={`${i.fromMin}-${i.label}`}
                type="button"
                className="mon__row"
                data-active={active}
                onClick={() => p.onSeek(tsOf(p.dateKey, i.fromMin))}
              >
                <div className="mono mon__row-range">
                  <span className="dot" style={{ background: SEV_BAR[i.severity] }} />
                  {clock(i.fromMin)}–{clock(i.toMin)}
                </div>
                <div className="mono">{hmsFromMin(i.toMin - i.fromMin)}</div>
                <div>{i.label}</div>
                <div className="mono">{i.cycles || '—'}</div>
                <div className="mono" style={{ color: loadColor(i.maxLoadPct) }}>
                  {pct(i.maxLoadPct)}
                </div>
                <div
                  style={{
                    color:
                      i.severity === 'alarm'
                        ? 'var(--danger)'
                        : i.severity === 'warn'
                          ? 'var(--warn)'
                          : 'var(--ink-4)',
                  }}
                >
                  {i.event}
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Group({ title, rows }: { title: string; rows: (readonly [string, string, string?])[] }) {
  return (
    <div className="mon__group">
      <div className="mon__group-title">{title}</div>
      {rows.map(([label, value, color]) => (
        <div key={label} className="mon__group-row">
          <span>{label}</span>
          <span className="mono" style={color ? { color } : undefined}>
            {value}
          </span>
        </div>
      ))}
    </div>
  )
}

function loadColor(v: number | null): string {
  if (v == null) return 'var(--ink-muted)'
  if (v > 100) return 'var(--danger)'
  if (v >= 90) return 'var(--warn)'
  return 'var(--ok-text)'
}

function share(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

function accumulate(samples: Sample[]) {
  const acc = {
    loadMin: 0,
    noloadMin: 0,
    idleMin: 0,
    offMin: 0,
    offlineMin: 0,
    workMin: 0,
    total: 0,
    cycles: 0,
    overloads: 0,
  }
  for (const s of samples) {
    acc.total += STEP_MIN
    if (!s.online) acc.offlineMin += STEP_MIN
    else if (s.mode === 'load') acc.loadMin += STEP_MIN
    else if (s.mode === 'noload') acc.noloadMin += STEP_MIN
    else if (s.mode === 'idle' || s.mode === 'warmup') acc.idleMin += STEP_MIN
    else acc.offMin += STEP_MIN
  }
  acc.workMin = acc.loadMin + acc.noloadMin
  // Счётчики в точках накопительные внутри суток и обнуляются в полночь,
  // поэтому для диапазона «7 дней» суммируем итоги каждых суток отдельно.
  let prevCycles = 0
  let prevOverloads = 0
  for (const s of samples) {
    if (s.cyclesDone < prevCycles) {
      acc.cycles += prevCycles
      acc.overloads += prevOverloads
    }
    prevCycles = s.cyclesDone
    prevOverloads = s.overloads
  }
  acc.cycles += prevCycles
  acc.overloads += prevOverloads
  return acc
}

function peaks(samples: Sample[]) {
  let maxLoad: number | null = null
  let maxRadius: number | null = null
  let maxMass: number | null = null
  const perHour = new Map<number, number>()

  for (const s of samples) {
    if (s.loadPct != null && (maxLoad == null || s.loadPct > maxLoad)) maxLoad = s.loadPct
    if (s.radiusM > 0 && (maxRadius == null || s.radiusM > maxRadius)) maxRadius = s.radiusM
    if (s.massT > 0 && (maxMass == null || s.massT > maxMass)) maxMass = s.massT
    if (s.mode === 'load') {
      const h = Math.floor(s.min / 60)
      perHour.set(h, (perHour.get(h) ?? 0) + 1)
    }
  }

  let busiest = -1
  let best = 0
  for (const [h, n] of perHour)
    if (n > best) {
      best = n
      busiest = h
    }

  return {
    maxLoad,
    maxRadius,
    maxMass,
    busiestHour: busiest < 0 ? '—' : `${clock(busiest * 60)}–${clock((busiest + 1) * 60)}`,
  }
}
