import { clock } from '../../domain/format'
import type { AlertRow, FleetSummary } from './aggregate'

const SEV_COLOR: Record<string, string> = {
  alarm: 'var(--danger)',
  warn: 'var(--warn)',
  offline: 'var(--neutral)',
  ok: 'var(--ok)',
  idle: 'var(--neutral)',
}

interface Props {
  summary: FleetSummary
  alerts: AlertRow[]
  onOpenCrane: (id: string) => void
}

export function AttentionBlock({ summary, alerts, onOpenCrane }: Props) {
  return (
    <section className="attention">
      <div className="attention__head">
        <div className="attention__badge">
          <span>!</span>
          <b>Требует внимания</b>
        </div>
        <div className="attention__sep" />
        <div className="attention__counters">
          <span>
            <b data-tone="danger">{summary.offline}</b> не в сети
          </span>
          <span>
            <b data-tone="danger">{summary.overloads}</b> перегруза за сутки
          </span>
          <span>
            <b data-tone="warn">{summary.warnings}</b> предупреждения 90–105%
          </span>
          <span>
            <b data-tone="warn">{summary.needCheck}</b> требуют проверки
          </span>
        </div>
        <span className="link">Все события →</span>
      </div>

      <div className="attention__list">
        {alerts.map((a) => (
          <div key={a.craneId} className="attention__row">
            <span className="dot" style={{ background: SEV_COLOR[a.severity] }} />
            <span className="attention__crane">{a.craneName}</span>
            <span className="attention__text">{a.text}</span>
            <span className="mono hint">{clock(a.time)}</span>
            <button type="button" className="link" onClick={() => onOpenCrane(a.craneId)}>
              Открыть
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
