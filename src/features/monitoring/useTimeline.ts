import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDay, getRange, indexAt } from '../../domain/telemetry'
import { MINUTES_PER_DAY, shiftKey, tsOf } from '../../domain/time'
import type { Interval, Sample } from '../../domain/types'

export type RangeKey = '24h' | 'shift' | '7d'

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: '24h', label: '24 часа' },
  { key: 'shift', label: 'Смена' },
  { key: '7d', label: '7 дней' },
]

export const SPEEDS = [1, 2, 4, 8] as const

/** Вся шкала проигрывается за столько секунд на скорости 1x. */
const PLAY_SECONDS_AT_1X = 60

interface Window {
  from: number
  to: number
  samples: Sample[]
  intervals: Interval[]
}

function windowFor(craneId: string, dateKey: string, range: RangeKey): Window {
  if (range === '7d') {
    const startKey = shiftKey(dateKey, -6)
    return {
      from: tsOf(startKey, 0),
      to: tsOf(dateKey, MINUTES_PER_DAY),
      samples: getRange(craneId, dateKey, 7),
      intervals: getDay(craneId, dateKey).intervals,
    }
  }
  const day = getDay(craneId, dateKey)
  const fromMin = range === 'shift' ? 8 * 60 : 0
  const toMin = range === 'shift' ? 20 * 60 : MINUTES_PER_DAY
  return {
    from: tsOf(dateKey, fromMin),
    to: tsOf(dateKey, toMin),
    samples: day.samples.filter((s) => s.min >= fromMin && s.min <= toMin),
    intervals: day.intervals.filter((i) => i.toMin > fromMin && i.fromMin < toMin),
  }
}

/**
 * Плеер хронологии. Держит положение курсора во времени и двигает его при
 * воспроизведении. Все панели «Мониторинга» читают точку под курсором,
 * поэтому перемотка меняет весь экран, а не только полосу.
 */
export function useTimeline(craneId: string, dateKey: string, range: RangeKey, live: boolean) {
  const win = useMemo(() => windowFor(craneId, dateKey, range), [craneId, dateKey, range])

  const lastDataTs = win.samples.length
    ? (win.samples[win.samples.length - 1] as Sample).ts
    : win.from
  const [cursorTs, setCursorTs] = useState(lastDataTs)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<number>(1)

  // Смена крана, даты или диапазона возвращает курсор к последним данным.
  useEffect(() => {
    setCursorTs(lastDataTs)
    setPlaying(false)
  }, [craneId, dateKey, range, lastDataTs])

  // В режиме Live курсор всегда стоит на последней точке.
  useEffect(() => {
    if (live) {
      setCursorTs(lastDataTs)
      setPlaying(false)
    }
  }, [live, lastDataTs])

  const raf = useRef<number | null>(null)
  const prevTime = useRef<number>(0)

  useEffect(() => {
    if (!playing) return
    const span = win.to - win.from
    const rate = span / (PLAY_SECONDS_AT_1X * 1000)
    prevTime.current = performance.now()

    const tick = (now: number) => {
      const dt = now - prevTime.current
      prevTime.current = now
      setCursorTs((prev) => {
        const next = prev + dt * rate * speed
        if (next >= lastDataTs) {
          setPlaying(false)
          return lastDataTs
        }
        return next
      })
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current)
    }
  }, [playing, speed, win.from, win.to, lastDataTs])

  const clampTs = useCallback(
    (ts: number) => Math.min(Math.max(ts, win.from), Math.max(win.from, lastDataTs)),
    [win.from, lastDataTs],
  )

  const seek = useCallback(
    (ts: number) => {
      setPlaying(false)
      setCursorTs(clampTs(ts))
    },
    [clampTs],
  )

  /** Прыжок к границе предыдущего/следующего интервала. */
  const stepInterval = useCallback(
    (dir: -1 | 1) => {
      setPlaying(false)
      const bounds = win.intervals.map((i) => tsOf(dateKey, i.fromMin))
      bounds.push(lastDataTs)
      setCursorTs((prev) => {
        const sorted = [...new Set(bounds)].sort((a, b) => a - b)
        const next =
          dir === 1
            ? sorted.find((b) => b > prev + 1000)
            : [...sorted].reverse().find((b) => b < prev - 1000)
        return clampTs(next ?? prev)
      })
    },
    [win.intervals, dateKey, lastDataTs, clampTs],
  )

  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (p) return false
      if (cursorTs >= lastDataTs - 1) setCursorTs(win.from)
      return true
    })
  }, [cursorTs, lastDataTs, win.from])

  const index = indexAt(win.samples, cursorTs)
  const sample = index >= 0 ? (win.samples[index] as Sample) : null
  const progress = win.to > win.from ? (cursorTs - win.from) / (win.to - win.from) : 0

  return {
    ...win,
    cursorTs,
    sample,
    progress,
    playing,
    speed,
    setSpeed,
    toggle,
    seek,
    stepInterval,
    atLive: cursorTs >= lastDataTs - 1,
  }
}
