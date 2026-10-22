import { Link } from 'react-router-dom'
import type { LinkProps } from 'react-router-dom'
import { textLinkClass } from '../../lib/classes'
import { cn } from '../../lib/cn'

/** Link de texto em bordô (".text-link" do CSS original). */
export default function TextLink({ className, ...rest }: LinkProps) {
  return <Link className={cn(textLinkClass, className)} {...rest} />
}
