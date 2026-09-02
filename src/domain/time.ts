/**
 * Демо-время. Зафиксировано, чтобы стенд выглядел одинаково в любой день:
 * дата и время взяты из макета «Мониторинг крана v2» (02.09.2026, 11:39).
 */
export const DEMO_NOW = new Date(2026, 8, 2, 11, 39, 0)
export const DEMO_TODAY_KEY = '2026-09-02'
/** Минута суток «сейчас» — 11:39 = 699. */
export const DEMO_NOW_MIN = DEMO_NOW.getHours() * 60 + DEMO_NOW.getMinutes()

/** Интервал опроса телеметрии, сек (как в реальной системе). */
export const POLL_INTERVAL_SEC = 30
/** Шаг генерируемого ряда, мин. 5 мин → 288 точек в сутках. */
export const STEP_MIN = 5
export const MINUTES_PER_DAY = 1440

export const MONTHS_GEN = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

/** '2026-09-02' */
export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y as number, (m as number) - 1, d as number)
}

/** '02.09.2026' */
export function formatKeyRu(key: string): string {
  const [y, m, d] = key.split('-')
  return `${d}.${m}.${y}`
}

/** '2 сентября 2026' */
export function formatKeyLong(key: string): string {
  const d = parseKey(key)
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`
}

export function shiftKey(key: string, days: number): string {
  const d = parseKey(key)
  d.setDate(d.getDate() + days)
  return dateKey(d)
}

export function isFutureKey(key: string): boolean {
  return parseKey(key).getTime() > parseKey(DEMO_TODAY_KEY).getTime()
}

export function isTodayKey(key: string): boolean {
  return key === DEMO_TODAY_KEY
}

/** Абсолютное время (мс) для минуты суток указанной даты. */
export function tsOf(key: string, min: number): number {
  const d = parseKey(key)
  return d.getTime() + min * 60_000
}
