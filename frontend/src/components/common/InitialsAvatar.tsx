import type { ComponentProps } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface InitialsAvatarProps extends ComponentProps<typeof Avatar> {
  initials: string
}

/** Avatar com as iniciais do usuário (os perfis da demonstração não têm foto). */
export default function InitialsAvatar({ initials, ...rest }: InitialsAvatarProps) {
  return (
    <Avatar {...rest}>
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}
