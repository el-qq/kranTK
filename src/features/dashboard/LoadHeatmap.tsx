import { num, pct } from '../../domain/format'
import { parseKey } from '../../domain/time'
import type { HeatRow } from './aggregate'

/** Цвет ячейки по максимальной загрузке за сутки. */
function cellColor(v: number | null): string {
  if (v == null) return 'var(--surface-neutral)'
  if (v > 100) return 'var(--danger)'
  if (v >= 90) return 'var(--warn-soft)'
  if (v >= 60) return 'var(--ok-soft)'
  if (v > 0) return '#dbeafe'
  return 'var(--surface-neutral)'
}

interface Props {
  rows: HeatRow[]
  onOpenCrane: (id: string) => void
}

export function LoadHeatmap({ rows, onOpenCrane }: Props) {
  const days = rows[0]?.cells ?? []

  return (
    <section className="card heat">
      <div className="dash__card-head">
        <div className="dash__card-title">Динамика загрузки</div>
        <div className="spacer" />
        <span className="hint">максимум загрузки по суткам · 15 дней</span>
      </div>

      <div className="heat__scroll">
        <div
          className="heat__grid"
          style={{ gridTemplateColumns: `170px repeat(${days.length}, minmax(22px, 1fr))` }}
        >
          <div />
          {days.map((d) => {
            const date = parseKey(d.dateKey)
            return (
              <div key={d.dateKey} className="heat__day mono">
                {date.getDate()}
              </div>
            )
          })}

          {rows.map((r) => (
            <Row key={r.crane.id} row={r} onOpenCrane={onOpenCrane} />
          ))}
        </div>
      </div>

      <div className="heat__legend">
        <span>
          <i style={{ background: '#dbeafe' }} /> до 60%
        </span>
        <span>
          <i style={{ background: 'var(--ok-soft)' }} /> 60–90%
        </span>
        <span>
          <i style={{ background: 'var(--warn-soft)' }} /> 90–100%
        </span>
        <span>
          <i style={{ background: 'var(--danger)' }} /> перегруз
        </span>
        <span>
          <i style={{ background: 'var(--surface-neutral)' }} /> нет данных
        </span>
      </div>
    </section>
  )
}

function Row({ row, onOpenCrane }: { row: HeatRow; onOpenCrane: (id: string) => void }) {
  const peaks = row.cells.map((c) => c.maxLoadPct).filter((v): v is number => v != null)
  const worst = peaks.length ? Math.max(...peaks) : null

  return (
    <>
      <button type="button" className="heat__name" onClick={() => onOpenCrane(row.crane.id)}>
        <span>{row.crane.name}</span>
        <span className="mono hint" data-tone={(worst ?? 0) > 100 ? 'danger' : undefined}>
          макс {pct(worst)}
        </span>
      </button>
      {row.cells.map((c) => (
        <div
          key={c.dateKey}
          className="heat__cell"
          style={{ background: cellColor(c.maxLoadPct) }}
          title={`${c.dateKey} · макс. загрузка ${c.maxLoadPct == null ? 'нет данных' : num(c.maxLoadPct) + '%'}`}
        />
      ))}
    </>
  )
}
