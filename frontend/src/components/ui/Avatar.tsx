import type { HTMLAttributes } from 'react'
import { avatarClass } from '../../lib/classes'
import type { AvatarSize } from '../../lib/classes'

interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  size?: AvatarSize
}

export default function Avatar({ size = 'md', ...rest }: AvatarProps) {
  return <span className={avatarClass(size)} {...rest} />
}
