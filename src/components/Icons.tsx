interface IconProps {
  className?: string
}

const base = {
  viewBox: '0 0 24 24',
  width: 24,
  height: 24,
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: 'false' as const,
}

export function PictureIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="2" />
      <path d="M4 17.5 9.5 13l3.5 3 3-2.5L20 17" />
    </svg>
  )
}

export function BinderIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="5" y="3" width="15" height="18" rx="2.5" />
      <path d="M9 3v18" />
      <path d="M6.5 7h1M6.5 12h1M6.5 17h1" />
      <path d="M13 8.5h3.5M13 12.5h3.5" />
    </svg>
  )
}

export function PencilIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z" />
      <path d="M14.5 6.5l3 3" />
    </svg>
  )
}

export function ClipboardIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="5" y="4.5" width="14" height="17" rx="2.5" />
      <path d="M9 4.5a3 3 0 0 1 6 0" />
      <path d="M9 11h6M9 15h4" />
    </svg>
  )
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4v10" />
      <path d="M8 11l4 4 4-4" />
      <path d="M4 17v1.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V17" />
    </svg>
  )
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function CameraIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.2-2h5.2l1.2 2h1.7A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </svg>
  )
}

export function ImagesIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="7" y="3.5" width="14" height="13" rx="2.5" />
      <path d="M17 20.5H6.5A2.5 2.5 0 0 1 4 18V7.5" />
      <circle cx="11.5" cy="8" r="1.6" />
      <path d="M8 14l3.5-3.5L15 14l2-1.7 3 2.7" />
    </svg>
  )
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  )
}
