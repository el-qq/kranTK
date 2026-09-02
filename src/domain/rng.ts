/** FNV-1a — стабильный хеш строки в 32-битное число. */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * mulberry32 — маленький детерминированный ГПСЧ.
 * Один и тот же seed всегда даёт одну и ту же последовательность,
 * поэтому «архив» за конкретную дату выглядит одинаково при каждом открытии.
 */
export function makeRng(seed: string | number) {
  let a = (typeof seed === 'string' ? hashString(seed) : seed) >>> 0
  return function rng(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Случайное число в диапазоне. */
export function between(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min)
}

/** Целое в диапазоне включительно. */
export function intBetween(rng: () => number, min: number, max: number): number {
  return Math.floor(between(rng, min, max + 1 - 1e-9))
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] as T
}
