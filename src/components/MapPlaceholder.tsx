import type { Crane } from '../domain/types'
import { STATUS_META } from '../domain/fleet'
import './map.css'

interface Props {
  cranes: Crane[]
  height?: number
  caption: string
  selectedId?: string
  onSelect?: (id: string) => void
}

/**
 * Схематичная карта парка. Реальная Яндекс.Карта в демо-стенде не
 * подключается (нужен ключ и сеть), поэтому рисуем сетку и маркеры —
 * как в макете, но с настоящими координатами кранов в подписи.
 */
export function MapPlaceholder({ cranes, height = 420, caption, selectedId, onSelect }: Props) {
  return (
    <div className="map" style={{ height }}>
      <svg className="grid-svg" width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          <pattern id="mapgrid" width="26" height="26" patternUnits="userSpaceOnUse">
            <path d="M26 0H0v26" fill="none" stroke="#d8e0ea" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mapgrid)" />
        <path
          d="M2 62 C 18 48, 30 58, 44 44 S 70 30, 96 34"
          fill="none"
          stroke="#c3d1e0"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          transform="scale(1,1)"
          style={{ transformBox: 'fill-box' }}
        />
      </svg>

      {cranes.map((c) => (
        <button
          key={c.id}
          type="button"
          className="map__pin"
          data-on={c.id === selectedId}
          style={{ left: `${c.mapXY[0]}%`, top: `${c.mapXY[1]}%` }}
          onClick={() => onSelect?.(c.id)}
          title={`${c.name} · ${c.place}`}
        >
          <span className="dot" style={{ background: STATUS_META[c.status].dot }} />
          <span className="map__pin-name">{c.name}</span>
        </button>
      ))}

      <div className="map__caption mono">{caption}</div>
      <div className="map__zoom">
        <span>+</span>
        <span>−</span>
      </div>
    </div>
  )
}
