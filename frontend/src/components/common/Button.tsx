import type { ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import type { LinkProps } from 'react-router-dom'
import { buttonClass } from '../../lib/classes'
import type { ButtonVariant } from '../../lib/classes'
import { cn } from '../../lib/cn'

interface StyleProps {
  variant?: ButtonVariant
  block?: boolean
}

export function Button({
  variant,
  block,
  className,
  type = 'button',
  ...rest
}: StyleProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cn(buttonClass(variant, block), className)} {...rest} />
}

export function ButtonLink({ variant, block, className, ...rest }: StyleProps & LinkProps) {
  return <Link className={cn(buttonClass(variant, block), className)} {...rest} />
}
