// Strings de classe Tailwind reutilizadas em vários componentes.

export const inputClass =
  'rounded-[11px] border border-line bg-[#fffefa] px-[14px] py-3 text-[12px] text-ink'

export const checkboxClass = 'mt-[2px] h-4 w-4 shrink-0 accent-maroon'

export const textLinkClass = 'text-[13px] font-[650] text-maroon underline'

export const textButtonClass = 'py-[5px] text-[12px] text-[#68717d] underline underline-offset-[3px]'

/** Anel de foco para <label> estilizado como "chip" (usado com peer). */
export const peerFocusRing =
  'peer-focus-visible:[outline:3px_solid_#761918] peer-focus-visible:outline-offset-[3px]'

export type ButtonVariant = 'primary' | 'secondary'

const buttonBase =
  'inline-flex min-h-[46px] items-center justify-center gap-[10px] rounded-[14px] border px-5 py-3 text-center text-[13px] font-bold leading-[1.45] no-underline'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-accent text-maroon [&:not(:disabled):hover]:bg-[#ffb361] disabled:border-[#e6c39c] disabled:bg-[#f7d3ac] disabled:text-[#6c3c25]',
  secondary:
    'border-line bg-surface text-ink [&:not(:disabled):hover]:bg-[#f8f2e8] disabled:bg-[#f3efe7] disabled:text-[#667080]',
}

export function buttonClass(variant: ButtonVariant = 'primary', block = false): string {
  return `${buttonBase} ${buttonVariants[variant]}${block ? ' w-full' : ''}`
}

const avatarBase =
  'inline-flex shrink-0 items-center justify-center rounded-full bg-[#f3dbbd] font-[750] text-maroon no-underline'

const avatarSizes = {
  md: 'h-11 w-11 max-sm:h-[38px] max-sm:w-[38px] max-sm:text-[12px]',
  sm: 'h-[38px] w-[38px] max-sm:text-[12px]',
  lg: 'mb-4 h-[76px] w-[76px] text-[25px] max-md:float-left max-md:mr-[18px] max-md:h-[65px] max-md:w-[65px] max-sm:float-none max-sm:mb-[14px] max-sm:mr-0',
} as const

export type AvatarSize = keyof typeof avatarSizes

export function avatarClass(size: AvatarSize = 'md'): string {
  return `${avatarBase} ${avatarSizes[size]}`
}
