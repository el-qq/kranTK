interface Props {
  width?: number
  height?: number
  tone?: string
  muted?: boolean
}

/**
 * Силуэт автокрана вместо фотографии. Фотографий техники в выгрузке нет,
 * а внешние картинки в статическом стенде тянуть неоткуда — рисуем сами.
 */
export function CraneGlyph({ width = 58, height = 44, tone = '#8aa2bd', muted = false }: Props) {
  const body = muted ? '#c3ccd8' : tone
  const accent = muted ? '#d5dce5' : '#f0a500'
  return (
    <svg width={width} height={height} viewBox="0 0 58 44" role="img" aria-label="автокран">
      <rect width="58" height="44" fill="#f1f5f9" />
      <path d="M6 34h46" stroke="#dbe3ec" strokeWidth="2" />
      <path d="M12 14 L44 6" stroke={body} strokeWidth="3" strokeLinecap="round" />
      <path d="M44 6 v7" stroke={body} strokeWidth="1.5" />
      <circle cx="44" cy="14.5" r="1.8" fill={accent} />
      <path d="M8 30h20l4-6h10l3 6h4v4H8z" fill={body} />
      <rect x="10" y="20" width="9" height="7" rx="1.5" fill={accent} />
      <circle cx="16" cy="36" r="4" fill="#54637a" />
      <circle cx="30" cy="36" r="4" fill="#54637a" />
      <circle cx="43" cy="36" r="4" fill="#54637a" />
      <circle cx="16" cy="36" r="1.6" fill="#9aa8ba" />
      <circle cx="30" cy="36" r="1.6" fill="#9aa8ba" />
      <circle cx="43" cy="36" r="1.6" fill="#9aa8ba" />
    </svg>
  )
}
