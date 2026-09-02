interface Props {
  /** 0..100+, null — нет данных. */
  value: number | null
  size?: number
  stroke?: number
  color: string
  label: string
  sub?: string
}

/** Кольцевой индикатор загрузки. */
export function Donut({ value, size = 92, stroke = 12, color, label, sub }: Props) {
  const r = size / 2 - stroke / 2 - 1
  const circ = 2 * Math.PI * r
  const filled = value == null ? 0 : (circ * Math.min(value, 100)) / 100

  return (
    <div style={{ position: 'relative', width: size, height: size, flex: `0 0 ${size}px` }}>
      <svg width={size} height={size} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border-soft)"
          strokeWidth={stroke}
        />
        {filled > 0.5 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled.toFixed(1)} ${circ.toFixed(1)}`}
          />
        ) : null}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
        }}
      >
        <div style={{ fontSize: size > 80 ? 23 : 17, fontWeight: 700, lineHeight: 1 }}>{label}</div>
        {sub ? <div style={{ fontSize: 10, color: 'var(--ink-muted)' }}>{sub}</div> : null}
      </div>
    </div>
  )
}
