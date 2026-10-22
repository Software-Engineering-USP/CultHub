import { cn } from '../../lib/cn'

interface IconProps {
  className?: string
}

export function BrandMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 30 36" fill="none" aria-hidden="true" className={className}>
      <path d="M15 34S3 21 3 13a12 12 0 0 1 24 0c0 8-12 21-12 21Z" stroke="currentColor" strokeWidth="2.7" />
      <circle cx="15" cy="13" r="4.5" stroke="currentColor" strokeWidth="2.7" />
    </svg>
  )
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" className={className}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </svg>
  )
}

export function FiltersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" className={className}>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="2.5" fill="#fffdf9" />
      <circle cx="15" cy="17" r="2.5" fill="#fffdf9" />
    </svg>
  )
}

export function PinIcon({ className = 'h-[18px] w-4 shrink-0' }: IconProps) {
  return (
    <svg viewBox="0 0 20 22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={className}>
      <path d="M10 20S3 12 3 8a7 7 0 0 1 14 0c0 4-7 12-7 12Z" />
      <circle cx="10" cy="8" r="2" />
    </svg>
  )
}

export function CalendarIcon({ className = 'h-[18px] w-4 shrink-0' }: IconProps) {
  return (
    <svg viewBox="0 0 20 22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={className}>
      <rect x="2" y="4" width="16" height="15" rx="2" />
      <path d="M6 1v6M14 1v6M2 10h16" />
    </svg>
  )
}

export function LocateIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 1v4m0 14v4M1 12h4m14 0h4" />
    </svg>
  )
}

export function SunIcon({ className = 'h-12 w-12' }: IconProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
      className={cn('text-[#bd6612]', className)}
    >
      <circle cx="24" cy="24" r="10" />
      <path d="M24 3v6m0 30v6M3 24h6m30 0h6M9 9l4 4m22 22 4 4M9 39l4-4m22-22 4-4" />
    </svg>
  )
}
