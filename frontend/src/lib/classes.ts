// Strings de classe Tailwind ainda compartilhadas. Saem quando SignIn, Account e Origin
// passarem a usar Checkbox e ToggleGroup do shadcn/ui.

/** Base dos chips de categoria (preferências em Minha conta e no perfil público). */
export const chipClass = 'rounded-[30px] border border-line bg-chip text-[12px]'

export const checkboxClass = 'mt-[2px] h-4 w-4 shrink-0 accent-maroon'

/** Anel de foco para <label> estilizado como "chip" (usado com peer). */
export const peerFocusRing =
  'peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-ring'
