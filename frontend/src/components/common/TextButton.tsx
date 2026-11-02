import type { ButtonHTMLAttributes } from 'react'
import { textButtonClass } from '../../lib/classes'
import { cn } from '@/lib/utils'

export default function TextButton({
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cn(textButtonClass, className)} {...rest} />
}
