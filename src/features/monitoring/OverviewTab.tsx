import { useState } from 'react'
import { Donut } from '../../components/Donut'
import { MapPlaceholder } from '../../components/MapPlaceholder'
import {
  clock,
  clockSec,
  hms,
  hmsFromMin,
  humanDuration,
  num,
  pct,
  tons,
} from '../../domain/format'
import { POLL_INTERVAL_SEC } from '../../domain/time'
import { SYS_META } from '../../domain/fleet'
import type { Crane, Sample, TimelineEvent } from '../../domain/types'
import { CraneScheme } from './CraneScheme'

interface Props {
  crane: Crane
  sample: Sample | null
  cursorMin: number
  /** Максимум загрузки с начала суток до курсора, %. */
  peakLoadPct: number | null
  events: TimelineEvent[]
  onGotoTimeline: () => void
}

const STATE_BOX = {
  ok: {
    title: 'НОРМА',
    note: 'безопасная работа',
    color: 'var(--ok-text)',
    bg: '#f2fbf5',
    border: '#c8ecd4',
  },
  warn: {
    title: 'ВНИМАНИЕ',
    note: 'загрузка 90–100%',
    color: 'var(--warn-text)',
    bg: '#fffbeb',
    border: '#f4dda6',
  },
  alarm: {
    title: 'ПЕРЕГРУЗ',
    note: 'работа запрещена',
    color: 'var(--danger-text)',
    bg: '#fff5f5',
    border: '#f6b9b9',
  },
  offline: {
    title: 'НЕТ СВЯЗИ',
    note: 'данные не поступают',
    color: 'var(--ink-4)',
    bg: 'var(--surface-neutral)',
    border: 'var(--border)',
  },
  idle: {
    title: 'ПРОСТОЙ',
    note: 'груза нет',
    color: 'var(--ink-3)',
    bg: 'var(--surface-neutral)',
    border: 'var(--border)',
  },
} as const

export function OverviewTab({
  crane,
  sample,
  cursorMin,
  peakLoadPct,
  events,
  onGotoTimeline,
}: Props) {
  const [openExtra, setOpenExtra] = useState<Record<string, boolean>>({})
  const online = sample?.online ?? false
  const load = sample?.loadPct ?? null
  const state = STATE_BOX[sample?.severity ?? 'offline']
  const loadColor =
    load == null
      ? 'var(--neutral)'
      : load > 100
        ? 'var(--danger)'
        : load >= 90
          ? 'var(--warn)'
          : 'var(--ok)'
  const reserve = sample ? sample.allowedT - sample.massT : 0

  const toggle = (k: string) => setOpenExtra((s) => ({ ...s, [k]: !s[k] }))

  return (
    <div className="mon__stack">
      <div className="mon__top">
        {/* Загрузка */}
        <section className="card card-pad mon__load">
          <div className="eyebrow">Загрузка</div>
          <div className="mon__load-body">
            <Donut value={load} color={loadColor} label={pct(load)} size={92} />
            <div className="mon__load-rows">
              <span>Груз</span>
              <span className="mono">{online ? tons(sample!.massT) : '—'}</span>
              <span>Допустимо</span>
              <span className="mono">{online ? tons(sample!.allowedT) : '—'}</span>
              <span>Запас</span>
              <span
                className="mono"
                style={{ color: reserve < 0 ? 'var(--danger)' : 'var(--ok-text)' }}
              >
                {online ? tons(reserve) : '—'}
              </span>
            </div>
          </div>
          <div className="mon__state" style={{ background: state.bg, borderColor: state.border }}>
            <b style={{ color: state.color }}>{state.title}</b>
            <span className="hint">{state.note}</span>
          </div>
        </section>

        {/* Схема */}
        <section className="card card-pad mon__scheme">
          <div className="mon__scheme-head">
            <span className="eyebrow">Схема крана</span>
            <div className="spacer" />
            <span className="mono hint">{clockSec(cursorMin)}</span>
          </div>
          <div className="scheme">
            <CraneScheme crane={crane} sample={sample} />
          </div>
        </section>

        {/* Геометрия */}
        <section className="card card-pad">
          <div className="eyebrow">Геометрия</div>
          <div className="mon__geo">
            <GeoRow
              label="Угол стрелы"
              value={online ? `${num(sample!.boomAngleDeg, 2)}°` : '—'}
              note="предел 80°"
            />
            <GeoRow
              label="Длина стрелы"
              value={online ? `${num(sample!.boomLenM, 2)} м` : '—'}
              note={`из ${num(crane.passport.maxBoomM, 1)} м`}
            />
            <GeoRow
              label="Вылет"
              value={online ? `${num(sample!.radiusM, 2)} м` : '—'}
              note="предел 14 м"
            />
            <GeoRow
              label="Высота крюка"
              value={online ? `${num(sample!.heightM, 2)} м` : '—'}
              note={`из ${num(crane.passport.maxHeightM, 1)} м`}
            />
            <GeoRow label="Азимут" value={online ? `${sample!.azimuthDeg}°` : '—'} note="поворот" />
          </div>
        </section>
      </div>

      {/* Показатели */}
      <section className="card card-pad">
        <div className="mon__section-head">
          <span className="eyebrow">Показатели</span>
          <span className="mon__line" />
          <span className="hint">пороги показаны серым</span>
        </div>
        <div className="mon__groups mon__groups--4">
          <Group
            title="Смена"
            rows={[
              ['Наработка', online ? hmsFromMin(sample!.workMin) : '—', '8 ч'],
              [
                'Циклов',
                online ? String(sample!.cyclesDone) : '—',
                crane.shift.cycles > 0
                  ? `${num(crane.shift.cycles / Math.max(0.1, crane.shift.workMin / 60), 2)}/ч`
                  : '',
              ],
              ['Средний цикл', crane.shift.avgCycleSec ? hms(crane.shift.avgCycleSec) : '—'],
              ['Поднято', online ? tons(sample!.liftedT) : '—'],
              ['Простой', online ? humanDuration(sample!.idleMin) : '—'],
              [
                'Перегрузов',
                online ? String(sample!.overloads) : '—',
                '',
                (sample?.overloads ?? 0) > 0 ? 'var(--danger)' : 'var(--ok-text)',
              ],
            ]}
          />
          <Group
            title="Двигатель"
            rows={[
              ['Обороты', online ? num(sample!.rpm) : '—', 'rpm'],
              [
                'Масло',
                online ? num(sample!.oilTempC, 1) : '—',
                '≤95 °C',
                warnAbove(sample?.oilTempC, 95),
              ],
              [
                'Охл. жидкость',
                online ? num(sample!.coolantTempC, 1) : '—',
                '≤100 °C',
                warnAbove(sample?.coolantTempC, 100),
              ],
              [
                'Топливо',
                online ? pct(sample!.fuelPct) : '—',
                '',
                (sample?.fuelPct ?? 100) < 20 ? 'var(--warn)' : undefined,
              ],
              ['Моточасы', `${num(crane.passport.totalHours)} ч`],
              ['Напряжение', online ? `${num(sample!.voltageV, 1)} В` : '—'],
            ]}
          />
          <Group
            title="Гидравлика"
            rows={[
              ['Давление', online ? num(sample!.hydPressureKpa) : '—', 'kPa'],
              [
                'Темп. гидромасла',
                online ? `${num(sample!.hydOilTempC, 1)} °C` : '—',
                '≤80',
                warnAbove(sample?.hydOilTempC, 80),
              ],
              ['Лебёдка', online ? (sample!.mode === 'load' ? 'работа' : 'стоп') : '—'],
              ['Тормоз', online && sample!.mode === 'load' ? 'снят' : 'установлен'],
              ['Опоры', online && sample!.mode !== 'off' ? 'выдвинуты' : 'убраны'],
              ['Противовес', `${num(crane.passport.counterweightT, 2)} т`],
            ]}
          />
          <Group
            title="Системы"
            rows={[
              ['CAN', SYS_META[crane.systems.can].label, '', SYS_META[crane.systems.can].color],
              [
                'GPS',
                SYS_META[crane.systems.gps].label,
                crane.systems.satellites ? `${crane.systems.satellites} спутн.` : '',
                SYS_META[crane.systems.gps].color,
              ],
              [
                'Датчик угла',
                SYS_META[crane.systems.angle].label,
                '',
                SYS_META[crane.systems.angle].color,
              ],
              [
                'Датчик давления',
                SYS_META[crane.systems.pressure].label,
                '',
                SYS_META[crane.systems.pressure].color,
              ],
              [
                'Крен X / Y',
                online ? `${num(sample!.tiltXDeg, 2)}° / ${num(sample!.tiltYDeg, 2)}°` : '—',
              ],
              [
                'Связь',
                crane.systems.link === 'ok' ? 'Данные' : 'Нет связи',
                '',
                SYS_META[crane.systems.link].color,
              ],
            ]}
          />
        </div>
      </section>

      {/* Перегрузы + события */}
      <div className="mon__pair">
        <section className="card card-pad">
          <div className="mon__scheme-head">
            <span className="eyebrow">Перегрузы за смену</span>
            <div className="spacer" />
            <button type="button" className="link" onClick={onGotoTimeline}>
              Разбор по хронологии →
            </button>
          </div>
          <div className="mon__ov-row">
            <Big
              label="Перегрузов"
              value={online ? String(sample!.overloads) : '—'}
              tone={(sample?.overloads ?? 0) > 0 ? 'danger' : 'ok'}
            />
            <Big label="Длительность" value={hms((sample?.overloads ?? 0) * 15)} mono />
            <Big
              label="Предупреждений"
              value={String(events.filter((e) => e.severity === 'warn').length)}
              tone="warn"
            />
            <Big
              label="Макс. загрузка"
              value={pct(peakLoadPct)}
              tone={
                (peakLoadPct ?? 0) > 100 ? 'danger' : (peakLoadPct ?? 0) >= 90 ? 'warn' : undefined
              }
            />
          </div>
          <div className="mon__scale">
            <span className="hint">Норма</span>
            <span className="panel__scale-bar">
              <i style={{ width: '82%', background: 'var(--ok-soft)' }} />
              <i style={{ width: '12%', background: 'var(--warn-soft)' }} />
              <i style={{ width: '6%', background: 'var(--danger-soft)' }} />
            </span>
            <span className="hint">120%+</span>
          </div>
        </section>

        <section className="card card-pad">
          <div className="mon__scheme-head">
            <span className="eyebrow">Последние события</span>
            <div className="spacer" />
            <span className="hint">до {clock(cursorMin)}</span>
          </div>
          <div className="mon__events">
            {events.slice(0, 6).map((e, i) => (
              <div key={`${e.min}-${i}`} className="mon__event">
                <span className="mono">{clock(e.min)}</span>
                <span className="dot" style={{ background: sevDot(e.severity) }} />
                <span className="mon__event-kind">{e.kind}</span>
                <span className="mon__event-text">{e.text}</span>
              </div>
            ))}
            {events.length === 0 ? <div className="hint">Событий за период нет</div> : null}
          </div>
        </section>
      </div>

      {/* Дополнительно */}
      <div className="dash__divider">
        <span className="eyebrow">Дополнительно</span>
        <span className="dash__line" />
      </div>

      <ExtraPanel
        open={!!openExtra.map}
        onToggle={() => toggle('map')}
        title="Местоположение и трек"
        hint={`${crane.place} · ${num(crane.coords.lat, 6)}, ${num(crane.coords.lon, 6)}`}
        action="Яндекс Карты"
      >
        <MapPlaceholder
          cranes={[crane]}
          height={280}
          selectedId={crane.id}
          caption={`трек ${num(crane.systems.trackPoints)} точек · ${crane.place}`}
        />
      </ExtraPanel>

      <ExtraPanel
        open={!!openExtra.passport}
        onToggle={() => toggle('passport')}
        title="Паспорт и опоры"
        hint={`${num(crane.passport.capacityT)} т · стрела ${num(crane.passport.maxBoomM, 1)} м`}
        action="Карточка крана"
      >
        <div className="mon__groups">
          <Group
            title="Паспорт"
            rows={[
              ['Грузоподъёмность', `${num(crane.passport.capacityT)} т`],
              ['Макс. стрела', `${num(crane.passport.maxBoomM, 1)} м`],
              ['Высота подъёма', `${num(crane.passport.maxHeightM, 1)} м`],
              ['Опорный контур', crane.passport.outriggers],
            ]}
          />
          <Group
            title="Устойчивость"
            rows={[
              ['Противовес', `${num(crane.passport.counterweightT, 2)} т`],
              ['Опоры', online && sample!.mode !== 'off' ? 'выдвинуты' : 'убраны'],
              ['Крен X', online ? `${num(sample!.tiltXDeg, 2)}°` : '—'],
              ['Крен Y', online ? `${num(sample!.tiltYDeg, 2)}°` : '—'],
            ]}
          />
          <Group
            title="Обслуживание"
            rows={[
              ['Наработка всего', `${num(crane.passport.totalHours)} ч`],
              ['Циклов всего', num(crane.passport.totalCycles)],
              ['Калибровка', crane.passport.calibration],
              [
                'ТО',
                crane.passport.serviceInHours < 0
                  ? `просрочено ${num(-crane.passport.serviceInHours)} ч`
                  : `через ${num(crane.passport.serviceInHours)} ч`,
                '',
                crane.passport.serviceInHours < 60 ? 'var(--danger)' : 'var(--warn)',
              ],
            ]}
          />
        </div>
      </ExtraPanel>

      <ExtraPanel
        open={!!openExtra.conditions}
        onToggle={() => toggle('conditions')}
        title="Условия и связь"
        hint={`${crane.tempC}°C · ветер ${num(crane.windMs, 1)} м/с`}
        action="История связи"
      >
        <div className="mon__groups">
          <Group
            title="Погода"
            rows={[
              ['Температура', `${crane.tempC} °C`],
              ['Ветер', `${num(crane.windMs, 1)} м/с`],
              ['Осадки', crane.weather === 'Дождь' ? 'дождь' : 'нет'],
              ['Видимость', crane.visibility],
            ]}
          />
          <Group
            title="Связь"
            rows={[
              [
                'Связь',
                crane.systems.link === 'ok' ? 'Данные' : 'Нет связи',
                '',
                SYS_META[crane.systems.link].color,
              ],
              ['GSM', crane.systems.gsmDbm != null ? `${crane.systems.gsmDbm} dBm` : '—'],
              [
                'GPS',
                crane.systems.satellites != null ? `${crane.systems.satellites} спутников` : '—',
              ],
              ['Точек трека', num(crane.systems.trackPoints)],
            ]}
          />
          <Group
            title="Телеметрия"
            rows={[
              [
                'Последние данные',
                crane.lastSeenMin != null ? clock(crane.lastSeenMin) : clockSec(cursorMin),
              ],
              ['Интервал опроса', `${POLL_INTERVAL_SEC} сек`],
              ['Пропусков', crane.status === 'off' ? '—' : '0'],
              ['Часовой пояс', 'UTC+5'],
            ]}
          />
        </div>
      </ExtraPanel>
    </div>
  )
}

function warnAbove(v: number | undefined, limit: number): string | undefined {
  return v != null && v > limit ? 'var(--danger)' : undefined
}

function sevDot(s: string): string {
  return s === 'alarm'
    ? 'var(--danger)'
    : s === 'warn'
      ? 'var(--warn)'
      : s === 'offline'
        ? 'var(--neutral)'
        : 'var(--ok)'
}

function GeoRow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="mon__geo-row">
      <span>{label}</span>
      <span>
        <b className="mono">{value}</b>
        <i>{note}</i>
      </span>
    </div>
  )
}

function Big({
  label,
  value,
  mono,
  tone,
}: {
  label: string
  value: string
  mono?: boolean
  tone?: string
}) {
  return (
    <div className="mon__big">
      <span className="hint">{label}</span>
      <b className={mono ? 'mono' : ''} data-tone={tone}>
        {value}
      </b>
    </div>
  )
}

function Group({
  title,
  rows,
}: {
  title: string
  rows: (readonly [string, string, string?, string?])[]
}) {
  return (
    <div className="mon__group">
      <div className="mon__group-title">{title}</div>
      {rows.map(([label, value, limit, color]) => (
        <div key={label} className="mon__group-row">
          <span>{label}</span>
          <span className="mon__group-val">
            <b className="mono" style={color ? { color } : undefined}>
              {value}
            </b>
            {limit ? <i className="mono">{limit}</i> : null}
          </span>
        </div>
      ))}
    </div>
  )
}

function ExtraPanel({
  open,
  onToggle,
  title,
  hint,
  action,
  children,
}: {
  open: boolean
  onToggle: () => void
  title: string
  hint: string
  action: string
  children: React.ReactNode
}) {
  return (
    <section className="card panel">
      <button type="button" className="panel__head" onClick={onToggle}>
        <span className="panel__caret">{open ? '▲' : '▼'}</span>
        <span className="panel__title" style={{ fontSize: 14 }}>
          {title}
        </span>
        <span className="panel__hint" style={{ fontSize: 12 }}>
          {hint}
        </span>
        <span className="spacer" />
        <span className="link">{action}</span>
      </button>
      {open ? <div className="panel__body">{children}</div> : null}
    </section>
  )
}
