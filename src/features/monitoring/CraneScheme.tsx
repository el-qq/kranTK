import { num } from '../../domain/format'
import type { Crane, Sample } from '../../domain/types'

interface Props {
  crane: Crane
  sample: Sample | null
}

/**
 * Схема крана: положение стрелы, вылет и высота крюка на момент курсора.
 * Рисуется из тех же чисел, что и панель «Геометрия», поэтому при
 * перемотке хронологии картинка двигается вместе с показателями.
 */
export function CraneScheme({ crane, sample }: Props) {
  const W = 640
  const H = 300
  const groundY = H - 46
  const pivotX = 152
  const pivotY = groundY - 42

  const online = sample?.online ?? false
  const angle = online ? sample!.boomAngleDeg : 24
  const boomLen = online && sample!.boomLenM > 0 ? sample!.boomLenM : crane.passport.maxBoomM * 0.35
  const maxSpan = Math.max(crane.passport.maxBoomM, 1)
  // Масштаб: самая длинная стрела крана занимает почти всю ширину схемы.
  const scale = Math.min((W - pivotX - 90) / maxSpan, (pivotY - 24) / maxSpan)

  const rad = (angle * Math.PI) / 180
  const tipX = pivotX + Math.cos(rad) * boomLen * scale
  const tipY = pivotY - Math.sin(rad) * boomLen * scale
  const hookLen = online ? Math.max(18, (sample!.heightM - 2) * scale * 0.45) : 40
  const hookY = Math.min(groundY - 12, tipY + hookLen)

  const loadPct = sample?.loadPct ?? null
  const boomColor =
    loadPct == null
      ? '#9fb0c4'
      : loadPct > 100
        ? 'var(--danger)'
        : loadPct >= 90
          ? 'var(--warn)'
          : '#c2410c'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="scheme__svg" role="img" aria-label="схема крана">
      <defs>
        <pattern id="schemegrid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0v24" fill="none" stroke="var(--border-card)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#schemegrid)" />

      {/* грунт */}
      <line x1="16" y1={groundY} x2={W - 16} y2={groundY} stroke="#b9c6d6" strokeWidth="2" />
      {Array.from({ length: 22 }, (_, i) => (
        <line
          key={i}
          x1={18 + i * 28}
          y1={groundY}
          x2={8 + i * 28}
          y2={groundY + 9}
          stroke="#cfd9e5"
          strokeWidth="1.5"
        />
      ))}

      {/* шасси и опоры */}
      <rect x={pivotX - 84} y={groundY - 34} width="150" height="20" rx="4" fill="#7c8ca1" />
      <rect x={pivotX - 60} y={groundY - 50} width="42" height="18" rx="3" fill="#f0a500" />
      <line
        x1={pivotX - 96}
        y1={groundY - 14}
        x2={pivotX - 96}
        y2={groundY}
        stroke="#7c8ca1"
        strokeWidth="5"
      />
      <line
        x1={pivotX + 78}
        y1={groundY - 14}
        x2={pivotX + 78}
        y2={groundY}
        stroke="#7c8ca1"
        strokeWidth="5"
      />
      <circle cx={pivotX - 52} cy={groundY - 8} r="7" fill="#54637a" />
      <circle cx={pivotX - 20} cy={groundY - 8} r="7" fill="#54637a" />
      <circle cx={pivotX + 34} cy={groundY - 8} r="7" fill="#54637a" />

      {/* стрела */}
      <line
        x1={pivotX}
        y1={pivotY}
        x2={tipX}
        y2={tipY}
        stroke={boomColor}
        strokeWidth="11"
        strokeLinecap="round"
      />
      <line
        x1={pivotX}
        y1={pivotY}
        x2={tipX}
        y2={tipY}
        stroke="rgba(255,255,255,.35)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx={pivotX} cy={pivotY} r="7" fill="#54637a" />

      {/* трос и крюк */}
      <line x1={tipX} y1={tipY} x2={tipX} y2={hookY} stroke="#6b7c92" strokeWidth="1.5" />
      <circle cx={tipX} cy={hookY} r="5" fill="none" stroke="#6b7c92" strokeWidth="2" />
      {loadPct != null && loadPct > 0 ? (
        <rect
          x={tipX - 17}
          y={hookY + 5}
          width="34"
          height="20"
          rx="3"
          fill={boomColor}
          opacity="0.85"
        />
      ) : null}

      {/* размеры */}
      <line
        x1={pivotX}
        y1={groundY + 22}
        x2={tipX}
        y2={groundY + 22}
        stroke="#94a3b8"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <text x={(pivotX + tipX) / 2} y={groundY + 36} textAnchor="middle" className="scheme__dim">
        вылет {online ? `${num(sample!.radiusM, 2)} м` : '—'}
      </text>

      <line
        x1={tipX + 26}
        y1={tipY}
        x2={tipX + 26}
        y2={groundY}
        stroke="#94a3b8"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <text x={tipX + 32} y={(tipY + groundY) / 2} className="scheme__dim">
        {online ? `${num(sample!.heightM, 1)} м` : '—'}
      </text>

      <text x={pivotX + 26} y={pivotY - 12} className="scheme__dim">
        {online ? `${num(angle, 2)}°` : '—'}
      </text>
      <text x={(pivotX + tipX) / 2 - 10} y={(pivotY + tipY) / 2 - 14} className="scheme__dim">
        L {online ? `${num(boomLen, 2)} м` : '—'}
      </text>
      <text x={W - 18} y={26} textAnchor="end" className="scheme__dim">
        азимут {online ? `${sample!.azimuthDeg}°` : '—'}
      </text>
      <text x={18} y={26} className="scheme__dim">
        {online ? `${num(sample!.massT, 2)} т` : 'нет данных'}
      </text>
    </svg>
  )
}
