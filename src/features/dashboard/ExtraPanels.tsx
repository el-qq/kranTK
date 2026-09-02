import { useState } from 'react'
import { hms, hmsFromMin, num, pct, tons } from '../../domain/format'
import type { FleetSummary } from './aggregate'

interface Tile {
  label: string
  value: string
  note?: string
  tone?: 'ok' | 'warn' | 'danger'
  mono?: boolean
}

interface PanelDef {
  key: string
  title: string
  hint: string
  hintTone?: 'ok' | 'warn' | 'danger'
  action: string
  scale?: boolean
  tiles: Tile[]
}

function panels(s: FleetSummary): PanelDef[] {
  return [
    {
      key: 'safety',
      title: 'Безопасность парка',
      hint: `${s.overloads} перегруза · макс. ${pct(s.maxLoadPct)}`,
      hintTone: s.overloads > 0 ? 'danger' : 'ok',
      action: 'Контроль нарушений',
      scale: true,
      tiles: [
        {
          label: 'Перегрузы',
          value: String(s.overloads),
          note: 'за смену',
          tone: s.overloads > 0 ? 'danger' : 'ok',
        },
        { label: 'Время перегрузов', value: hms(s.overloadSec), note: 'суммарно', mono: true },
        {
          label: 'Предупреждения 90–105%',
          value: String(s.warnings),
          note: `${s.warnCranes} кран(а)`,
          tone: 'warn',
        },
        {
          label: 'Перегрузы / 100 циклов',
          value: num(s.overloadsPer100, 1),
          note: 'порог 10',
          tone: s.overloadsPer100 > 10 ? 'danger' : undefined,
        },
      ],
    },
    {
      key: 'perf',
      title: 'Производительность парка',
      hint: `${s.cycles} цикла · ${tons(s.liftedT, 0)} за смену`,
      action: 'Отчёты',
      tiles: [
        {
          label: 'Завершено циклов',
          value: String(s.cycles),
          note: `${num(s.cycles / Math.max(1, s.workMin / 60), 2)} / ч`,
        },
        {
          label: 'Поднятый вес',
          value: tons(s.liftedT, 1),
          note: `средняя масса ${num(s.avgMassT, 2)} т`,
        },
        { label: 'Средний цикл', value: hms(s.avgCycleSec), mono: true },
        {
          label: 'Наработка общая',
          value: hmsFromMin(s.workMin),
          note: `${s.workedCranes} кранов`,
          mono: true,
        },
      ],
    },
    {
      key: 'usage',
      title: 'Использование парка',
      hint: `полезное время ${pct(s.usefulPct)}`,
      action: 'Баланс времени',
      tiles: [
        {
          label: 'Полезное время',
          value: pct(s.usefulPct),
          note: 'цель 60%',
          tone: s.usefulPct < 60 ? 'warn' : 'ok',
        },
        { label: 'Работало кранов', value: `${s.workedCranes} / ${s.total}`, note: 'за смену' },
        {
          label: 'Простой с двигателем',
          value: hmsFromMin(s.idleAfterLoadMin),
          note: 'суммарно',
          mono: true,
        },
        { label: 'Работа без груза', value: hmsFromMin(s.engineNoLoadMin), mono: true },
      ],
    },
    {
      key: 'systems',
      title: 'Состояние систем и связь',
      hint: `${s.offline} крана без связи · ${s.sensorErrors} ошибка датчика`,
      hintTone: 'danger',
      action: 'Диагностика',
      tiles: [
        {
          label: 'Связь',
          value: `${s.online} / ${s.total}`,
          note: `нет связи ${s.offline}`,
          tone: 'danger',
        },
        {
          label: 'GPS',
          value: `${s.gpsOk} / ${s.total}`,
          note: `нет сигнала ${s.total - s.gpsOk}`,
          tone: 'warn',
        },
        {
          label: 'CAN',
          value: `${s.canOk} / ${s.total}`,
          note: `нет данных ${s.total - s.canOk}`,
          tone: 'warn',
        },
        {
          label: 'Датчики',
          value: `${s.sensorErrors} ошибка`,
          note: 'КС-45717К-3 · угол',
          tone: 'danger',
        },
      ],
    },
  ]
}

export function ExtraPanels({ summary }: { summary: FleetSummary }) {
  const defs = panels(summary)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const allOpen = defs.every((d) => open[d.key])

  return (
    <>
      <div className="dash__divider">
        <span className="eyebrow">Дополнительно</span>
        <span className="dash__line" />
        <button
          type="button"
          className="link"
          onClick={() => setOpen(Object.fromEntries(defs.map((d) => [d.key, !allOpen])))}
        >
          {allOpen ? 'Свернуть всё' : 'Раскрыть всё'}
        </button>
      </div>

      {defs.map((d) => (
        <section key={d.key} className="card panel">
          <button
            type="button"
            className="panel__head"
            onClick={() => setOpen((s) => ({ ...s, [d.key]: !s[d.key] }))}
          >
            <span className="panel__caret">{open[d.key] ? '▲' : '▼'}</span>
            <span className="panel__title">{d.title}</span>
            <span className="panel__hint" data-tone={d.hintTone}>
              {d.hint}
            </span>
            <span className="spacer" />
            <span className="link">{d.action}</span>
          </button>

          {open[d.key] ? (
            <div className="panel__body">
              <div className="panel__tiles">
                {d.tiles.map((t) => (
                  <div key={t.label} className="tile" data-tone={t.tone}>
                    <div className="tile__label">{t.label}</div>
                    <div className={`tile__value${t.mono ? ' mono' : ''}`} data-tone={t.tone}>
                      {t.value}
                    </div>
                    <div className="tile__note">{t.note ?? ''}</div>
                  </div>
                ))}
              </div>
              {d.scale ? (
                <div className="panel__scale">
                  <span className="hint">Норма</span>
                  <span className="panel__scale-bar">
                    <i style={{ width: '74%', background: 'var(--ok-soft)' }} />
                    <i style={{ width: '12%', background: 'var(--warn-soft)' }} />
                    <i style={{ width: '8%', background: 'var(--danger-soft)' }} />
                    <i style={{ width: '6%', background: 'var(--danger)' }} />
                  </span>
                  <span className="hint">120%+</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ))}
    </>
  )
}
