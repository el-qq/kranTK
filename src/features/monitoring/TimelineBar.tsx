import { useCallback, useRef } from 'react'
import { clock } from '../../domain/format'
import { MINUTES_PER_DAY, STEP_MIN, parseKey } from '../../domain/time'
import type { Sample, Severity } from '../../domain/types'
import type { RangeKey } from './useTimeline'

export const SEV_BAR: Record<Severity, string> = {
  ok: 'var(--ok-bar)',
  warn: 'var(--warn-bar)',
  alarm: 'var(--danger)',
  idle: 'var(--idle-bar)',
  offline: 'var(--neutral-bar)',
}

interface Segment {
  from: number
  to: number
  severity: Severity
}

/**
 * Схлопывает соседние точки одной «тяжести» в отрезки для полосы.
 * Последний отрезок обрывается на последних данных, а не тянется до конца
 * шкалы — иначе «сейчас» размазывалось бы на остаток суток.
 */
export function segmentsFrom(samples: Sample[], to: number): Segment[] {
  const out: Segment[] = []
  const stepMs = STEP_MIN * 60_000
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] as Sample
    const end = i + 1 < samples.length ? (samples[i + 1] as Sample).ts : Math.min(to, s.ts + stepMs)
    const prev = out[out.length - 1]
    if (prev && prev.severity === s.severity) prev.to = end
    else out.push({ from: s.ts, to: end, severity: s.severity })
  }
  return out
}

interface Props {
  from: number
  to: number
  samples: Sample[]
  cursorTs: number
  range: RangeKey
  dateKey: string
  onSeek: (ts: number) => void
}

export function TimelineBar({ from, to, samples, cursorTs, range, dateKey, onSeek }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const span = Math.max(1, to - from)
  const segments = segmentsFrom(samples, to)
  const covered = segments.length ? (segments[segments.length - 1] as Segment).to : from
  const pendingPct = Math.max(0, ((to - covered) / span) * 100)
  const progress = (cursorTs - from) / span

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const el = trackRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      onSeek(from + ratio * span)
    },
    [from, span, onSeek],
  )

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    seekFromEvent(e.clientX)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return
    seekFromEvent(e.clientX)
  }

  const ticks = buildTicks(range, dateKey, from, to)

  return (
    <div className="tl__track-wrap">
      <div
        ref={trackRef}
        className="tl__track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        role="slider"
        tabIndex={0}
        aria-label="Положение на хронологии"
        aria-valuemin={from}
        aria-valuemax={to}
        aria-valuenow={cursorTs}
        onKeyDown={(e) => {
          const stepMs = span / 96
          if (e.key === 'ArrowLeft') onSeek(cursorTs - stepMs)
          if (e.key === 'ArrowRight') onSeek(cursorTs + stepMs)
        }}
      >
        <div className="tl__bar">
          {segments.map((s, i) => (
            <span
              key={i}
              style={{
                width: `${((s.to - s.from) / span) * 100}%`,
                background: SEV_BAR[s.severity],
              }}
              title={`${clock((s.from - from) / 60000 + startMin(range))}`}
            />
          ))}
          {pendingPct > 0.5 ? (
            <span className="tl__pending" style={{ width: `${pendingPct}%` }} />
          ) : null}
        </div>

        <div
          className="tl__cursor"
          style={{ left: `${Math.min(100, Math.max(0, progress * 100))}%` }}
        >
          <span
            className="tl__cursor-label mono"
            style={{
              transform: `translateX(${progress > 0.92 ? '-100%' : progress < 0.06 ? '0' : '-50%'})`,
            }}
          >
            {labelFor(cursorTs, range, dateKey)}
          </span>
        </div>
      </div>

      <div className="tl__axis mono">
        {ticks.map((t) => (
          <span
            key={t.at}
            style={{
              left: `${t.at * 100}%`,
              // Крайние подписи прижимаем к краям, иначе на узком экране обрезаются
              transform: `translateX(${t.at <= 0.001 ? '0' : t.at >= 0.999 ? '-100%' : '-50%'})`,
            }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function startMin(range: RangeKey): number {
  return range === 'shift' ? 8 * 60 : 0
}

function labelFor(ts: number, range: RangeKey, dateKey: string): string {
  const base = parseKey(dateKey).getTime()
  if (range === '7d') {
    const d = new Date(ts)
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${clock(d.getHours() * 60 + d.getMinutes())}`
  }
  return clock((ts - base) / 60000)
}

function buildTicks(range: RangeKey, dateKey: string, from: number, to: number) {
  const span = to - from
  const out: { at: number; label: string }[] = []
  if (range === '7d') {
    for (let i = 0; i < 7; i++) {
      const ts = from + i * MINUTES_PER_DAY * 60000
      const d = new Date(ts)
      out.push({
        at: (ts - from) / span,
        label: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`,
      })
    }
    return out
  }
  const startH = range === 'shift' ? 8 : 0
  const endH = range === 'shift' ? 20 : 24
  const stepH = range === 'shift' ? 2 : 3
  for (let h = startH; h <= endH; h += stepH) {
    const ts = parseKey(dateKey).getTime() + h * 60 * 60000
    out.push({ at: (ts - from) / span, label: `${String(h).padStart(2, '0')}:00` })
  }
  return out
}
