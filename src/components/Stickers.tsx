interface StickerProps {
  className?: string
}

export function KuromiSticker({ className }: StickerProps) {
  return (
    <svg
      viewBox="0 0 128 128"
      width="128"
      height="128"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g strokeLinejoin="round" strokeLinecap="round">
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="11">
          <path d="M52 44 C40 34 27 24 25 14 C24 7 31 7 37 15 C44 24 54 34 60 40 Z" />
          <path d="M76 44 C88 34 101 24 103 14 C104 7 97 7 91 15 C84 24 74 34 68 40 Z" />
          <circle cx="24" cy="12" r="6.5" />
          <circle cx="104" cy="12" r="6.5" />
          <circle cx="64" cy="76" r="42" />
        </g>
        <path
          d="M52 44 C40 34 27 24 25 14 C24 7 31 7 37 15 C44 24 54 34 60 40 Z"
          fill="#1b1130"
        />
        <path
          d="M76 44 C88 34 101 24 103 14 C104 7 97 7 91 15 C84 24 74 34 68 40 Z"
          fill="#1b1130"
        />
        <circle cx="64" cy="76" r="42" fill="#1b1130" />
        <circle cx="24" cy="12" r="6.5" fill="#ff4fa3" />
        <circle cx="104" cy="12" r="6.5" fill="#ff4fa3" />
        <circle cx="21.8" cy="9.8" r="2" fill="#ffffff" opacity="0.65" />
        <circle cx="101.8" cy="9.8" r="2" fill="#ffffff" opacity="0.65" />

        <ellipse cx="64" cy="86" rx="29" ry="25" fill="#fff2f8" />

        <circle cx="64" cy="48" r="12.5" fill="#f7f2fb" />
        <rect x="56.5" y="57" width="15" height="9" rx="3.5" fill="#f7f2fb" />
        <ellipse cx="59.5" cy="49" rx="3" ry="3.6" fill="#1b1130" />
        <ellipse cx="68.5" cy="49" rx="3" ry="3.6" fill="#1b1130" />
        <path d="M61.4 53 H66.6 L64 57.4 Z" fill="#1b1130" />

        <g fill="#ff4fa3" stroke="#ffffff" strokeWidth="1.6">
          <path d="M47 50 L38 45 L38 55 Z" />
          <path d="M47 50 L54 46 L54 54 Z" />
          <circle cx="47" cy="50" r="3" />
        </g>

        <ellipse cx="52" cy="84" rx="7.5" ry="8.5" fill="#17101f" />
        <ellipse cx="76" cy="84" rx="7.5" ry="8.5" fill="#17101f" />
        <circle cx="54.5" cy="80.5" r="3" fill="#ffffff" />
        <circle cx="49.5" cy="87" r="1.5" fill="#ffffff" opacity="0.85" />
        <circle cx="78.5" cy="80.5" r="3" fill="#ffffff" />
        <circle cx="73.5" cy="87" r="1.5" fill="#ffffff" opacity="0.85" />
        <ellipse cx="39" cy="94" rx="6.5" ry="3.6" fill="#ff8ac6" opacity="0.6" />
        <ellipse cx="89" cy="94" rx="6.5" ry="3.6" fill="#ff8ac6" opacity="0.6" />
        <path d="M56 96 C59 103 69 103 72 96 C67 99.5 61 99.5 56 96 Z" fill="#17101f" />
        <path d="M59.5 97.5 L62 101.5 L63.5 97 Z" fill="#ffffff" />
      </g>
    </svg>
  )
}

export function SkullBowSticker({ className }: StickerProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width="64"
      height="64"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g strokeLinejoin="round">
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="8">
          <circle cx="32" cy="34" r="16" />
          <rect x="23" y="45" width="18" height="11" rx="4" />
          <path d="M44 16 L36 11 L36 21 Z" />
          <path d="M44 16 L52 11 L52 21 Z" />
        </g>
        <circle cx="32" cy="34" r="16" fill="#f7f2fb" />
        <rect x="23" y="45" width="18" height="11" rx="4" fill="#f7f2fb" />
        <ellipse cx="26" cy="34" rx="4" ry="4.8" fill="#1b1130" />
        <ellipse cx="38" cy="34" rx="4" ry="4.8" fill="#1b1130" />
        <path d="M29.5 40 H34.5 L32 44 Z" fill="#1b1130" />
        <g fill="#ff4fa3" stroke="#ffffff" strokeWidth="1.8">
          <path d="M44 16 L36 11 L36 21 Z" />
          <path d="M44 16 L52 11 L52 21 Z" />
          <circle cx="44" cy="16" r="3.5" />
        </g>
      </g>
    </svg>
  )
}

export function StarSticker({ className }: StickerProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width="48"
      height="48"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M24 6 L29 17.1 L41.1 18.4 L32.1 26.6 L34.6 38.6 L24 32.5 L13.4 38.6 L15.9 26.6 L6.9 18.4 L19 17.1 Z"
        fill="#ffa8d3"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="21" r="2.4" fill="#ffffff" opacity="0.8" />
    </svg>
  )
}

export function HeartSticker({ className }: StickerProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width="48"
      height="48"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M24 41 C10 32 4 24.5 4 17 C4 10.6 9 6 15.4 6 C19 6 22.2 7.9 24 11 C25.8 7.9 29 6 32.6 6 C39 6 44 10.6 44 17 C44 24.5 38 32 24 41 Z"
        fill="#ff4fa3"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <ellipse cx="15" cy="15" rx="4" ry="2.8" fill="#ffffff" opacity="0.55" transform="rotate(-28 15 15)" />
    </svg>
  )
}

export function BatSticker({ className }: StickerProps) {
  return (
    <svg
      viewBox="0 0 64 40"
      width="64"
      height="40"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="#ffffff" strokeWidth="2.6" strokeLinejoin="round">
        <path d="M27 15 C20 9 12 8 4 12 C9 13 11 16 11 19 C15 16 19 18 22 22 C23 19 25 17 27 17 Z" fill="#b98fe6" />
        <path d="M37 15 C44 9 52 8 60 12 C55 13 53 16 53 19 C49 16 45 18 42 22 C41 19 39 17 37 17 Z" fill="#b98fe6" />
        <path d="M28 13 L26 5 L31.5 10 Z" fill="#b98fe6" />
        <path d="M36 13 L38 5 L32.5 10 Z" fill="#b98fe6" />
        <ellipse cx="32" cy="21" rx="6.5" ry="9" fill="#b98fe6" />
      </g>
      <circle cx="29.4" cy="18" r="1.8" fill="#1b1130" />
      <circle cx="34.6" cy="18" r="1.8" fill="#1b1130" />
      <path d="M30.5 24 L32 26.5 L33.5 24" fill="none" stroke="#1b1130" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function SparkleSticker({ className }: StickerProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      width="40"
      height="40"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M20 3 C21.5 12 28 18.5 37 20 C28 21.5 21.5 28 20 37 C18.5 28 12 21.5 3 20 C12 18.5 18.5 12 20 3 Z"
        fill="#ffffff"
      />
    </svg>
  )
}

export function MoonSticker({ className }: StickerProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      width="40"
      height="40"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M26 4 A16 16 0 1 0 26 36 A13 13 0 1 1 26 4 Z"
        fill="#b98fe6"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}
