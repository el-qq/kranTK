/** Форматирование чисел, времени и единиц. Один стиль на всё приложение. */

const NBSP = ' '

/** 1284 -> '1 284' (с неразрывным пробелом). */
export function num(n: number, digits = 0): string {
  const fixed = n.toFixed(digits)
  const [int, frac] = fixed.split('.')
  const grouped = (int as string).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  return frac ? `${grouped}.${frac}` : grouped
}

/** 18.6 -> '18.60 т' */
export function tons(n: number, digits = 2): string {
  return `${num(n, digits)}${NBSP}т`
}

export function pct(n: number | null, digits = 0): string {
  return n == null ? '—' : `${num(n, digits)}%`
}

export function meters(n: number, digits = 2): string {
  return `${num(n, digits)}${NBSP}м`
}

export function deg(n: number, digits = 2): string {
  return `${num(n, digits)}°`
}

/** Секунды -> 'ЧЧ:ММ:СС'. */
export function hms(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':')
}

/** Минуты -> 'ЧЧ:ММ:СС'. */
export function hmsFromMin(min: number): string {
  return hms(min * 60)
}

/** Минуты -> '3 ч 41 мин'. */
export function humanDuration(min: number): string {
  const total = Math.max(0, Math.round(min))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} мин`
  return `${h} ч ${String(m).padStart(2, '0')} мин`
}

/** Минута суток -> '11:39'. */
export function clock(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Минута суток (дробная) -> '11:39:00'. */
export function clockSec(min: number): string {
  const total = Math.max(0, Math.round(min * 60))
  const h = Math.floor(total / 3600) % 24
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

export function signed(n: number, digits = 2): string {
  return `${n >= 0 ? '' : '-'}${num(Math.abs(n), digits)}`
}

/** Склонение: 3 -> 'циклa'. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}
