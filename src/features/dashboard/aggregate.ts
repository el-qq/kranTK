import { FLEET } from '../../domain/fleet'
import { getDay } from '../../domain/telemetry'
import { DEMO_TODAY_KEY, STEP_MIN, shiftKey } from '../../domain/time'
import type { Crane, DayData, Severity } from '../../domain/types'

/** Баланс времени за сутки по одному крану, мин. */
export interface DayBalance {
  loadMin: number
  noloadMin: number
  idleMin: number
  offMin: number
  offlineMin: number
  engineMin: number
}

export function dayBalance(day: DayData): DayBalance {
  const b: DayBalance = {
    loadMin: 0,
    noloadMin: 0,
    idleMin: 0,
    offMin: 0,
    offlineMin: 0,
    engineMin: 0,
  }
  for (const s of day.samples) {
    if (!s.online) b.offlineMin += STEP_MIN
    else if (s.mode === 'load') b.loadMin += STEP_MIN
    else if (s.mode === 'noload') b.noloadMin += STEP_MIN
    else if (s.mode === 'idle' || s.mode === 'warmup') b.idleMin += STEP_MIN
    else b.offMin += STEP_MIN
  }
  b.engineMin = b.loadMin + b.noloadMin + b.idleMin
  return b
}

export interface FleetSummary {
  total: number
  online: number
  onlinePct: number
  offline: number
  working: number
  withLoad: number
  idleCranes: number
  workedCranes: number
  workMin: number
  cycles: number
  liftedT: number
  avgMassT: number
  avgCycleSec: number
  maxLoadPct: number | null
  overloads: number
  overloadSec: number
  warnings: number
  warnCranes: number
  needCheck: number
  usefulPct: number
  idleAfterLoadMin: number
  engineNoLoadMin: number
  gpsOk: number
  canOk: number
  sensorErrors: number
  overloadsPer100: number
}

export function fleetSummary(dateKey: string): FleetSummary {
  const days = FLEET.map((c) => getDay(c.id, dateKey))
  const balances = days.map(dayBalance)

  const online = FLEET.filter((c) => c.status !== 'off').length
  const working = FLEET.filter(
    (c) => c.status === 'work' || c.status === 'alarm' || c.status === 'warn',
  ).length
  const withLoad = FLEET.filter((c) => c.current.mode === 'load').length
  const workMin = FLEET.reduce((a, c) => a + c.shift.workMin, 0)
  const cycles = FLEET.reduce((a, c) => a + c.shift.cycles, 0)
  const liftedT = FLEET.reduce((a, c) => a + c.shift.liftedT, 0)
  const overloads = FLEET.reduce((a, c) => a + c.shift.overloads, 0)
  const maxLoads = FLEET.map((c) => c.shift.maxLoadPct).filter((v): v is number => v != null)

  let warnings = 0
  let warnCranes = 0
  for (const d of days) {
    const n = d.events.filter((e) => e.severity === 'warn').length
    warnings += n
    if (n > 0) warnCranes += 1
  }

  const totalLoad = balances.reduce((a, b) => a + b.loadMin, 0)
  const totalEngine = balances.reduce((a, b) => a + b.engineMin, 0)
  const totalIdle = balances.reduce((a, b) => a + b.idleMin, 0)
  const totalNoload = balances.reduce((a, b) => a + b.noloadMin, 0)

  const needCheck = FLEET.filter(
    (c) =>
      c.status === 'off' ||
      Object.values(c.systems).some((v) => v === 'warn' || v === 'error' || v === 'none'),
  ).length

  return {
    total: FLEET.length,
    online,
    onlinePct: Math.round((online / FLEET.length) * 100),
    offline: FLEET.length - online,
    working,
    withLoad,
    idleCranes: FLEET.filter((c) => c.status === 'idle').length,
    workedCranes: FLEET.filter((c) => c.shift.workMin > 0).length,
    workMin,
    cycles,
    liftedT,
    avgMassT: cycles > 0 ? liftedT / cycles : 0,
    avgCycleSec: cycles > 0 ? (workMin * 60) / cycles : 0,
    maxLoadPct: maxLoads.length ? Math.max(...maxLoads) : null,
    overloads,
    overloadSec: overloads * 15,
    warnings,
    warnCranes,
    needCheck,
    usefulPct: totalEngine > 0 ? Math.round((totalLoad / totalEngine) * 100) : 0,
    idleAfterLoadMin: totalIdle,
    engineNoLoadMin: totalNoload,
    gpsOk: FLEET.filter((c) => c.systems.gps === 'ok').length,
    canOk: FLEET.filter((c) => c.systems.can === 'ok').length,
    sensorErrors: FLEET.filter((c) => c.systems.angle === 'error' || c.systems.pressure === 'error')
      .length,
    overloadsPer100: cycles > 0 ? (overloads / cycles) * 100 : 0,
  }
}

export interface AlertRow {
  craneId: string
  craneName: string
  text: string
  time: number
  severity: Severity
}

const SEV_RANK: Record<Severity, number> = { alarm: 0, offline: 1, warn: 2, idle: 3, ok: 4 }

/** Лента «Требует внимания»: самое важное событие по каждому проблемному крану. */
export function fleetAlerts(dateKey: string, limit = 4): AlertRow[] {
  const rows: AlertRow[] = []
  for (const c of FLEET) {
    const day = getDay(c.id, dateKey)
    const hit =
      day.events.find((e) => e.severity === 'alarm') ??
      day.events.find((e) => e.severity === 'offline') ??
      day.events.find((e) => e.severity === 'warn')
    if (!hit) continue
    rows.push({
      craneId: c.id,
      craneName: c.name,
      text: `${hit.kind} · ${hit.text}`,
      time: hit.min,
      severity: hit.severity,
    })
  }
  return rows
    .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || b.time - a.time)
    .slice(0, limit)
}

export interface HeatCell {
  dateKey: string
  maxLoadPct: number | null
  overloads: number
}

export interface HeatRow {
  crane: Crane
  cells: HeatCell[]
}

/** Матрица «Динамика загрузки» — максимум загрузки по дням. */
export function loadHeatmap(endDateKey: string, days = 15): HeatRow[] {
  return FLEET.map((crane) => ({
    crane,
    cells: Array.from({ length: days }, (_, i) => {
      const key = shiftKey(endDateKey, -(days - 1 - i))
      const day = getDay(crane.id, key)
      const peaks = day.intervals.map((iv) => iv.maxLoadPct).filter((v): v is number => v != null)
      return {
        dateKey: key,
        maxLoadPct: peaks.length ? Math.max(...peaks) : null,
        overloads: day.intervals.filter((iv) => iv.severity === 'alarm').length,
      }
    }),
  }))
}

export const TODAY = DEMO_TODAY_KEY
