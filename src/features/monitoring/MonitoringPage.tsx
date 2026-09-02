import { useMemo, useState } from 'react'
import { STATUS_META, getCrane } from '../../domain/fleet'
import { clock } from '../../domain/format'
import { getDay } from '../../domain/telemetry'
import {
  DEMO_TODAY_KEY,
  POLL_INTERVAL_SEC,
  dateKey as toKey,
  formatKeyRu,
  isFutureKey,
  isTodayKey,
  shiftKey,
  tsOf,
} from '../../domain/time'
import { CraneList } from './CraneList'
import { OverviewTab } from './OverviewTab'
import { TimelineTab } from './TimelineTab'
import { useTimeline, type RangeKey } from './useTimeline'
import './monitoring.css'

type TabKey = 'overview' | 'timeline' | 'diag' | 'log'

const TABS: { key: TabKey; label: string; enabled: boolean; badge?: string }[] = [
  { key: 'overview', label: 'Обзор', enabled: true },
  { key: 'timeline', label: 'Хронология', enabled: true },
  { key: 'diag', label: 'Диагностика', enabled: false, badge: '1' },
  { key: 'log', label: 'Журнал данных', enabled: false },
]

interface Props {
  craneId: string
  onSelectCrane: (id: string) => void
}

export function MonitoringPage({ craneId, onSelectCrane }: Props) {
  const crane = getCrane(craneId)
  const [tab, setTab] = useState<TabKey>('overview')
  const [mode, setMode] = useState<'live' | 'archive'>('live')
  const [dateKey, setDateKey] = useState(DEMO_TODAY_KEY)
  const [range, setRange] = useState<RangeKey>('24h')

  const live = mode === 'live'
  const activeKey = live ? DEMO_TODAY_KEY : dateKey
  const tl = useTimeline(craneId, activeKey, range, live)

  const cursorDayKey = toKey(new Date(tl.cursorTs))
  const cursorMin = (tl.cursorTs - tsOf(cursorDayKey, 0)) / 60000
  const events = useMemo(
    () => getDay(craneId, cursorDayKey).events.filter((e) => e.min <= cursorMin + 0.01),
    [craneId, cursorDayKey, cursorMin],
  )

  // Пик загрузки с начала суток до курсора: блок «Перегрузы за смену»
  // должен показывать то же, что видно на хронологии слева от курсора.
  const peakLoadPct = useMemo(() => {
    let peak: number | null = null
    for (const s of getDay(craneId, cursorDayKey).samples) {
      if (s.min > cursorMin) break
      if (s.loadPct != null && (peak == null || s.loadPct > peak)) peak = s.loadPct
    }
    return peak
  }, [craneId, cursorDayKey, cursorMin])

  const st = STATUS_META[crane.status]
  const sample = tl.sample

  const goDate = (delta: number) => {
    const next = shiftKey(dateKey, delta)
    if (isFutureKey(next)) return
    setDateKey(next)
  }

  return (
    <div className="mon">
      <CraneList selectedId={craneId} onSelect={onSelectCrane} />

      <div className="mon__main">
        <header className="mon__head">
          <div>
            <div className="mon__title-row">
              <span className="mon__title">{crane.name}</span>
              <span className="chip" style={{ background: st.bg, color: st.fg }}>
                {st.label}
              </span>
            </div>
            <div className="mono hint">
              {crane.plate} · ID {crane.id}
            </div>
          </div>
          <div className="spacer" />

          <div className="mon__mode">
            <button type="button" data-on={live} onClick={() => setMode('live')}>
              <span
                className="dot"
                style={{ background: live ? '#86efac' : 'var(--neutral-bar)' }}
              />
              Live
            </button>
            <button type="button" data-on={!live} onClick={() => setMode('archive')}>
              Архив
            </button>
          </div>

          {!live ? (
            <div className="mon__date">
              <button type="button" onClick={() => goDate(-1)} title="Предыдущий день">
                ‹
              </button>
              <span className="mono">{formatKeyRu(dateKey)}</span>
              <button
                type="button"
                onClick={() => goDate(1)}
                disabled={isTodayKey(dateKey)}
                title="Следующий день"
              >
                ›
              </button>
            </div>
          ) : null}

          <div className="mon__note hint">
            {live
              ? `Обновлено ${crane.lastSeen}\nопрос каждые ${POLL_INTERVAL_SEC} сек`
              : `Архив за ${formatKeyRu(dateKey)}\nданные не обновляются`}
          </div>

          <div className="mon__head-actions">
            <button type="button" className="ghost-btn" disabled>
              Экспорт
            </button>
            <button type="button" className="ghost-btn" disabled>
              Настройки
            </button>
          </div>
        </header>

        <nav className="mon__tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              data-on={tab === t.key}
              disabled={!t.enabled}
              title={t.enabled ? undefined : 'Вкладка не входит в демонстрационный стенд'}
              onClick={() => t.enabled && setTab(t.key)}
            >
              {t.label}
              {t.badge ? <span className="mon__badge">{t.badge}</span> : null}
            </button>
          ))}
        </nav>

        <div className="mon__status">
          <StatusCell label="Режим" value={modeText(sample)} />
          <StatusCell
            label="Связь"
            value={sample?.online ? 'Данные' : 'Нет связи'}
            tone={sample?.online ? 'ok' : 'danger'}
          />
          <StatusCell
            label="CAN"
            value={crane.systems.can === 'ok' ? 'OK' : 'Нет'}
            tone={crane.systems.can === 'ok' ? 'ok' : 'danger'}
          />
          <StatusCell label="Оператор" value={crane.operator} />
          <StatusCell label="Место" value={crane.place} />
          <div className="spacer" />
          <StatusCell
            label="Курсор"
            value={`${formatKeyRu(cursorDayKey)} ${clock(cursorMin)}`}
            mono
            tone={tl.atLive && live ? 'ok' : undefined}
          />
        </div>

        <div className="mon__content">
          {tab === 'overview' ? (
            <OverviewTab
              crane={crane}
              sample={sample}
              cursorMin={cursorMin}
              peakLoadPct={peakLoadPct}
              events={events}
              onGotoTimeline={() => setTab('timeline')}
            />
          ) : (
            <TimelineTab
              dateKey={activeKey}
              range={range}
              onRange={setRange}
              from={tl.from}
              to={tl.to}
              samples={tl.samples}
              intervals={tl.intervals}
              cursorTs={tl.cursorTs}
              playing={tl.playing}
              speed={tl.speed}
              onSpeed={tl.setSpeed}
              onToggle={tl.toggle}
              onSeek={tl.seek}
              onStep={tl.stepInterval}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function StatusCell({
  label,
  value,
  tone,
  mono,
}: {
  label: string
  value: string
  tone?: string
  mono?: boolean
}) {
  return (
    <div className="mon__status-cell">
      <span className="hint">{label}</span>
      <span className={mono ? 'mono' : ''} data-tone={tone}>
        {value}
      </span>
    </div>
  )
}

function modeText(s: { mode: string; online: boolean } | null): string {
  if (!s || !s.online) return 'Нет связи'
  switch (s.mode) {
    case 'load':
      return 'Работа с грузом'
    case 'noload':
      return 'Работа без груза'
    case 'idle':
      return 'Простой'
    case 'warmup':
      return 'Прогрев'
    default:
      return 'Двигатель выключен'
  }
}
