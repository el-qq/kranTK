import { useMemo, useState } from 'react'
import { FLEET, STATUS_META } from '../../domain/fleet'
import { pct } from '../../domain/format'
import type { Crane } from '../../domain/types'

interface Props {
  selectedId: string
  onSelect: (id: string) => void
}

const FILTERS = [
  { key: 'all', label: (n: number) => `Все ${n}`, test: () => true },
  {
    key: 'problem',
    label: (n: number) => `Проблемы ${n}`,
    test: (c: Crane) => c.status === 'alarm' || c.status === 'off',
    tone: 'danger',
  },
  {
    key: 'work',
    label: (n: number) => `В работе ${n}`,
    test: (c: Crane) => c.status === 'work' || c.status === 'warn' || c.status === 'alarm',
  },
] as const

export function CraneList({ selectedId, onSelect }: Props) {
  const [open, setOpen] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [query, setQuery] = useState('')

  const online = FLEET.filter((c) => c.status !== 'off').length
  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0]
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
    <aside className="cranelist" data-open={open}>
      <div className="cranelist__head">
        {open ? (
          <div className="cranelist__head-text">
            <div className="cranelist__title">Краны</div>
            <div className="hint">
              {online} из {FLEET.length} на связи
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="cranelist__toggle"
          onClick={() => setOpen((v) => !v)}
          title={open ? 'Свернуть список' : 'Развернуть список'}
        >
          {open ? '‹' : '›'}
        </button>
      </div>

      {open ? (
        <div className="cranelist__filters">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по кранам, ID…"
          />
          <div className="cranelist__chips">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                data-on={filter === f.key}
                data-tone={'tone' in f ? f.tone : undefined}
                onClick={() => setFilter(f.key)}
              >
                {f.label(FLEET.filter(f.test).length)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="cranelist__items">
        {visible.map((c) => {
          const st = STATUS_META[c.status]
          const load = c.current.loadPct
          const color =
            load == null
              ? 'var(--neutral)'
              : load > 100
                ? 'var(--danger)'
                : load >= 90
                  ? 'var(--warn)'
                  : 'var(--ok)'
          return (
            <button
              key={c.id}
              type="button"
              className="cranelist__item"
              data-on={c.id === selectedId}
              onClick={() => onSelect(c.id)}
              title={c.name}
            >
              <span className="dot" style={{ background: st.dot }} />
              {open ? (
                <span className="cranelist__item-body">
                  <span className="cranelist__item-name">{c.name}</span>
                  <span className="cranelist__item-plate mono">{c.plate}</span>
                  <span className="cranelist__item-bar">
                    <span className="bar-track">
                      <span
                        className="bar-fill"
                        style={{ width: `${Math.min(load ?? 0, 100)}%`, background: color }}
                      />
                    </span>
                    <span className="mono">{load == null ? '—' : pct(load)}</span>
                  </span>
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </aside>
  )
}
