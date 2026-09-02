import { useMemo, useState } from 'react'
import { CraneGlyph } from '../../components/CraneGlyph'
import { Donut } from '../../components/Donut'
import { MapPlaceholder } from '../../components/MapPlaceholder'
import { FLEET, STATUS_META, SYS_META } from '../../domain/fleet'
import { clock, hmsFromMin, humanDuration, num, pct, plural, tons } from '../../domain/format'
import { getDay } from '../../domain/telemetry'
import { DEMO_NOW_MIN, DEMO_TODAY_KEY, formatKeyRu } from '../../domain/time'
import type { Crane } from '../../domain/types'
import { fleetAlerts, fleetSummary, loadHeatmap } from './aggregate'
import { AttentionBlock } from './AttentionBlock'
import { ExtraPanels } from './ExtraPanels'
import { LoadHeatmap } from './LoadHeatmap'
import './dashboard.css'

const FILTERS: {
  key: string
  label: (n: number) => string
  test: (c: Crane) => boolean
  tone?: string
}[] = [
  { key: 'all', label: (n) => `Все ${n}`, test: () => true },
  {
    key: 'problem',
    label: (n) => `Проблемы ${n}`,
    test: (c) => c.status === 'alarm' || c.status === 'off',
    tone: 'danger',
  },
  {
    key: 'work',
    label: (n) => `В работе ${n}`,
    test: (c) => c.status === 'work' || c.status === 'warn' || c.status === 'alarm',
  },
  { key: 'idle', label: (n) => `Простой ${n}`, test: (c) => c.status === 'idle' },
]

interface Props {
  onOpenCrane: (id: string) => void
}

export function DashboardPage({ onOpenCrane }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({ '3026598': true })
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')

  const summary = useMemo(() => fleetSummary(DEMO_TODAY_KEY), [])
  const alerts = useMemo(() => fleetAlerts(DEMO_TODAY_KEY), [])
  const heat = useMemo(() => loadHeatmap(DEMO_TODAY_KEY, 15), [])

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0]!
    const q = query.trim().toLowerCase()
    return FLEET.filter(f.test).filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.plate.toLowerCase().includes(q) ||
        c.id.includes(q),
    )
  }, [filter, query])

  return (
    <>
      <header className="dash__head">
        <div>
          <div className="dash__title">Мониторинг кранов</div>
          <div className="dash__subtitle">
            Оперативное состояние парка · {summary.total}{' '}
            {plural(summary.total, 'кран', 'крана', 'кранов')}
          </div>
        </div>
        <div className="spacer" />
        <input
          className="dash__search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по кранам, ID…"
        />
        <div className="dash__icons">
          <button type="button" title="Обновить">
            ↻
          </button>
          <button type="button" title="Выгрузить">
            ↓
          </button>
        </div>
        <div className="dash__clock">
          <div className="mono">{`${clock(DEMO_NOW_MIN)}:02`}</div>
          <div className="hint">обновлено сейчас</div>
        </div>
      </header>

      <div className="dash__body">
        <AttentionBlock summary={summary} alerts={alerts} onOpenCrane={onOpenCrane} />

        <section className="card dash__strip">
          <Metric
            label="На связи"
            value={`${summary.online} / ${summary.total}`}
            note={pct(summary.onlinePct)}
            tone="ok"
          />
          <Metric
            label="Работают"
            value={String(summary.working)}
            note={`с грузом ${summary.withLoad}`}
          />
          <Metric label="Наработка" value={hmsFromMin(summary.workMin)} mono />
          <Metric label="Циклов" value={String(summary.cycles)} />
          <Metric label="Поднято" value={tons(summary.liftedT, 1)} mono />
          <Metric
            label="Макс. загрузка"
            value={pct(summary.maxLoadPct)}
            tone={(summary.maxLoadPct ?? 0) > 100 ? 'danger' : undefined}
          />
          <div className="spacer" />
          <div className="hint">за смену · {formatKeyRu(DEMO_TODAY_KEY)}</div>
        </section>

        <div className="dash__grid">
          <section className="card">
            <div className="dash__card-head">
              <div className="dash__card-title">Краны</div>
              <div className="dash__filters">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    data-on={filter === f.key}
                    data-tone={f.tone}
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label(FLEET.filter(f.test).length)}
                  </button>
                ))}
              </div>
              <div className="spacer" />
              <div className="hint">Карточка раскрывается по клику</div>
            </div>

            <div className="dash__cards">
              {visible.map((c) => (
                <CraneCard
                  key={c.id}
                  crane={c}
                  open={!!open[c.id]}
                  onToggle={() => setOpen((s) => ({ ...s, [c.id]: !s[c.id] }))}
                  onOpenCrane={onOpenCrane}
                />
              ))}
              {visible.length === 0 ? <div className="dash__empty">Ничего не найдено</div> : null}
            </div>
          </section>

          <div className="dash__side">
            <section className="card dash__map-card">
              <div className="dash__card-head">
                <div className="dash__card-title">Карта парка</div>
                <div className="spacer" />
                <span className="hint">схема · демо</span>
              </div>
              <MapPlaceholder
                cranes={FLEET}
                caption="Свердловская обл. / ХМАО · 8 объектов"
                onSelect={onOpenCrane}
              />
              <div className="dash__map-legend">
                <span>
                  <i style={{ background: 'var(--ok)' }} /> в работе{' '}
                  {countBy('work') + countBy('warn')}
                </span>
                <span>
                  <i style={{ background: 'var(--warn)' }} /> ожидание {countBy('idle')}
                </span>
                <span>
                  <i style={{ background: 'var(--danger)' }} /> нарушение {countBy('alarm')}
                </span>
                <span>
                  <i style={{ background: 'var(--neutral)' }} /> нет связи {countBy('off')}
                </span>
              </div>
            </section>

            <section className="card dash__state-card">
              <div className="dash__card-head">
                <div className="dash__card-title">Состояние парка</div>
                <div className="spacer" />
                <span className="hint">
                  на связи {summary.online} / {summary.total}
                </span>
              </div>
              <div className="dash__state-body">
                <Donut
                  value={(summary.working / summary.total) * 100}
                  color="var(--ok)"
                  label={String(summary.working)}
                  sub="работают"
                />
                <div className="dash__state-rows">
                  <StateRow color="var(--ok)" label="С грузом" value={summary.withLoad} />
                  <StateRow
                    color="var(--accent)"
                    label="Без груза"
                    value={summary.working - summary.withLoad}
                  />
                  <StateRow color="var(--warn)" label="Ожидание" value={summary.idleCranes} />
                  <StateRow color="var(--neutral)" label="Нет связи" value={summary.offline} />
                </div>
              </div>
            </section>
          </div>
        </div>

        <LoadHeatmap rows={heat} onOpenCrane={onOpenCrane} />

        <ExtraPanels summary={summary} />
      </div>
    </>
  )
}

function countBy(status: Crane['status']): number {
  return FLEET.filter((c) => c.status === status).length
}

function StateRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="dash__state-row">
      <span className="dot" style={{ background: color }} />
      <span>{label}</span>
      <span className="spacer" />
      <b>{value}</b>
    </div>
  )
}

function Metric({
  label,
  value,
  note,
  mono,
  tone,
}: {
  label: string
  value: string
  note?: string
  mono?: boolean
  tone?: 'ok' | 'danger'
}) {
  return (
    <div className="dash__metric">
      <span className="dash__metric-label">{label}</span>
      <span className={`dash__metric-value${mono ? ' mono' : ''}`} data-tone={tone}>
        {value}
      </span>
      {note ? <span className="dash__metric-note">{note}</span> : null}
    </div>
  )
}

function CraneCard({
  crane,
  open,
  onToggle,
  onOpenCrane,
}: {
  crane: Crane
  open: boolean
  onToggle: () => void
  onOpenCrane: (id: string) => void
}) {
  const st = STATUS_META[crane.status]
  const load = crane.current.loadPct
  const loadColor =
    load == null
      ? 'var(--neutral)'
      : load > 100
        ? 'var(--danger)'
        : load >= 90
          ? 'var(--warn)'
          : 'var(--ok)'
  const day = getDay(crane.id, DEMO_TODAY_KEY)
  const lastEvent = day.events[0]

  return (
    <article
      className="crane"
      data-open={open}
      style={{ borderColor: open ? 'var(--accent)' : st.border }}
    >
      <button type="button" className="crane__head" onClick={onToggle}>
        <span className="crane__photo">
          <CraneGlyph muted={crane.status === 'off'} />
        </span>
        <span className="crane__main">
          <span className="crane__name-row">
            <span className="dot" style={{ background: st.dot }} />
            <span className="crane__name">{crane.name}</span>
          </span>
          <span className="crane__plate mono">
            {crane.plate} · {crane.id}
          </span>
          <span className="crane__bar-row">
            <span className="bar-track">
              <span
                className="bar-fill"
                style={{ width: `${Math.min(load ?? 0, 100)}%`, background: loadColor }}
              />
            </span>
            <span className="crane__bar-label mono">{load == null ? 'нет данных' : pct(load)}</span>
          </span>
        </span>
        <span className="crane__aside">
          <span className="chip" style={{ background: st.bg, color: st.fg }}>
            {st.label}
          </span>
          <span className="crane__last" data-off={crane.status === 'off'}>
            {crane.lastSeen}
          </span>
          <span className="hint">{open ? '▲ свернуть' : '▼ детали'}</span>
        </span>
      </button>

      {open ? (
        <div className="crane__body">
          <div className="crane__cols">
            <DetailBox
              title="Текущие параметры"
              rows={[
                ['Режим', modeLabel(crane)],
                ['Масса груза', crane.status === 'off' ? '—' : tons(crane.current.massT)],
                ['Угол', crane.status === 'off' ? '—' : `${num(crane.current.boomAngleDeg, 2)}°`],
                ['Стрела', crane.status === 'off' ? '—' : `${num(crane.current.boomLenM, 2)} м`],
                ['Вылет', crane.status === 'off' ? '—' : `${num(crane.current.radiusM, 2)} м`],
                ['Высота', crane.status === 'off' ? '—' : `${num(crane.current.heightM, 1)} м`],
              ]}
            />
            <DetailBox
              title="Смена"
              rows={[
                ['Наработка', hmsFromMin(crane.shift.workMin)],
                ['Циклов', String(crane.shift.cycles)],
                ['Поднято', tons(crane.shift.liftedT, 2)],
                ['Простой', humanDuration(crane.shift.idleMin)],
                [
                  'Перегрузы',
                  String(crane.shift.overloads),
                  crane.shift.overloads > 0 ? 'var(--danger)' : undefined,
                ],
                [
                  'Макс. загрузка',
                  pct(crane.shift.maxLoadPct),
                  (crane.shift.maxLoadPct ?? 0) > 100 ? 'var(--danger)' : undefined,
                ],
              ]}
            />
            <DetailBox
              title="Паспорт и место"
              rows={[
                ['Грузоподъёмность', `${num(crane.passport.capacityT)} т`],
                ['Макс. стрела', `${num(crane.passport.maxBoomM, 1)} м`],
                ['Опорный контур', crane.passport.outriggers],
                ['Место', crane.place],
                ['Погода', `${crane.tempC}°C · ${num(crane.windMs, 1)} м/с`],
                ['Координаты', `${num(crane.coords.lat, 5)}, ${num(crane.coords.lon, 5)}`],
              ]}
            />
            <DetailBox
              title="Состояние систем"
              rows={[
                ['CAN', SYS_META[crane.systems.can].label, SYS_META[crane.systems.can].color],
                ['GPS', SYS_META[crane.systems.gps].label, SYS_META[crane.systems.gps].color],
                [
                  'Датчик угла',
                  SYS_META[crane.systems.angle].label,
                  SYS_META[crane.systems.angle].color,
                ],
                [
                  'Давление',
                  SYS_META[crane.systems.pressure].label,
                  SYS_META[crane.systems.pressure].color,
                ],
                [
                  'Связь',
                  crane.systems.link === 'ok' ? 'Данные' : 'Нет связи',
                  SYS_META[crane.systems.link].color,
                ],
              ]}
            />
          </div>

          {lastEvent ? (
            <div className="crane__event">
              <span className="mono">{clock(lastEvent.min)}</span>
              <span className="dot" style={{ background: sevColor(lastEvent.severity) }} />
              <b>{lastEvent.kind}</b>
              <span>{lastEvent.text}</span>
            </div>
          ) : null}

          <div className="crane__actions">
            <button type="button" className="primary-btn" onClick={() => onOpenCrane(crane.id)}>
              Открыть мониторинг
            </button>
            <button type="button" className="ghost-btn" disabled>
              Отчёт
            </button>
            <button type="button" className="ghost-btn" disabled>
              Журнал данных
            </button>
            <button type="button" className="ghost-btn" disabled>
              Диагностика
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}

function DetailBox({
  title,
  rows,
}: {
  title: string
  rows: (readonly [string, string, string?])[]
}) {
  return (
    <div className="crane__box">
      <div className="crane__box-title">{title}</div>
      <div className="crane__box-rows">
        {rows.map(([label, value, color]) => (
          <div key={label} className="crane__box-row">
            <span>{label}</span>
            <span className="mono" style={color ? { color } : undefined}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function modeLabel(c: Crane): string {
  if (c.status === 'off') return 'Нет связи'
  switch (c.current.mode) {
    case 'load':
      return `Работа с грузом · ${num(c.current.rpm)} об/мин`
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

export function sevColor(s: string): string {
  return s === 'alarm'
    ? 'var(--danger)'
    : s === 'warn'
      ? 'var(--warn)'
      : s === 'offline'
        ? 'var(--neutral)'
        : 'var(--ok)'
}
