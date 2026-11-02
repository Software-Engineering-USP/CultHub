// Strings de classe Tailwind reutilizadas em vários componentes.

export const inputClass = 'rounded-[11px] border border-line bg-[#fffefa] px-[14px] py-3 text-[12px] text-ink'

export const checkboxClass = 'mt-[2px] h-4 w-4 shrink-0 accent-maroon'

/** Anel de foco para <label> estilizado como "chip" (usado com peer). */
export const peerFocusRing =
  'peer-focus-visible:[outline:3px_solid_#761918] peer-focus-visible:outline-offset-[3px]'

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
