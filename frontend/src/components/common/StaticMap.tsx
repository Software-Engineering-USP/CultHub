import type { ReactNode } from 'react'
import DemoNote from '@/components/common/DemoNote'

export interface StaticMapProps {
  /** Caminho em public/assets */
  src: string
  alt: string
  width: number
  height: number
  /** Aviso de que o mapa é só uma imagem */
  caption: ReactNode
  /** Conteúdo antes do aviso na legenda (por exemplo, as categorias do mapa) */
  legend?: ReactNode
  className?: string
}

/** Imagem de mapa estática com legenda (os mapas ainda não são interativos). */
export default function StaticMap({
  src,
  alt,
  width,
  height,
  caption,
  legend,
  className,
}: Readonly<StaticMapProps>) {
  return (
    <figure className={className}>
      <img
        className="block w-full rounded-3xl border border-border max-sm:rounded-2xl"
        src={src}
        width={width}
        height={height}
        alt={alt}
      />
      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 max-sm:gap-2.5">
        {legend}
        <DemoNote>{caption}</DemoNote>
      </figcaption>
    </figure>
  )
}
