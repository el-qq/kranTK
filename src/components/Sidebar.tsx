import type { Route, Section } from '../app/router'
import './sidebar.css'

interface Item {
  key: Section | 'log' | 'diag' | 'reports'
  label: string
  enabled: boolean
}

const ITEMS: Item[] = [
  { key: 'dashboard', label: 'Главный\nэкран', enabled: true },
  { key: 'monitoring', label: 'Мониторинг', enabled: true },
  { key: 'log', label: 'Журнал', enabled: false },
  { key: 'diag', label: 'Диагностика', enabled: false },
  { key: 'reports', label: 'Отчёты', enabled: false },
]

interface Props {
  route: Route
  onNavigate: (section: Section) => void
  onSignOut: () => void
}

export function Sidebar({ route, onNavigate, onSignOut }: Props) {
  return (
    <nav className="sidebar">
      <div className="sidebar__logo">
        <span className="sidebar__logo-mark" />
        <span className="sidebar__logo-text">
          CRANE
          <br />
          MONITOR
        </span>
      </div>

      <div className="sidebar__menu">
        {ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className="sidebar__item"
            data-on={item.key === route.section}
            data-off={!item.enabled}
            disabled={!item.enabled}
            title={item.enabled ? undefined : 'Раздел не входит в демонстрационный стенд'}
            onClick={() => item.enabled && onNavigate(item.key as Section)}
          >
            {item.label.split('\n').map((line, i) => (
              <span key={i}>{line}</span>
            ))}
          </button>
        ))}
      </div>

      <div className="spacer" />
      <div className="sidebar__brand">DEMO</div>
      <button type="button" className="sidebar__exit" onClick={onSignOut}>
        Выход
      </button>
    </nav>
  )
}
