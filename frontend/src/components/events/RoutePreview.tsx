import { ArrowRight, Car, Footprints } from 'lucide-react'
import { Link } from 'react-router-dom'
import Surface from '@/components/common/Surface'
import { Button } from '@/components/ui/button'
import { paths } from '@/lib/paths'
import type { CultEvent } from '@/types'

/** Chamada para planejar a rota na página do evento; o cálculo começa pela partida. */
export default function RoutePreview({ event }: Readonly<{ event: CultEvent }>) {
  return (
    <Surface as="section" aria-labelledby="rota-titulo" className="bg-cream">
      <h3 id="rota-titulo" className="text-lg">
        Planejar rota
      </h3>
      <p className="mt-2 text-xs">Compare o trajeto de carro e a pé da sua partida até o {event.venue}.</p>

      <ul className="my-5 grid gap-2.5 text-xs">
        <li className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <Car aria-hidden="true" className="size-4 text-maroon" /> Carro, com tempo estimado sem trânsito
        </li>
        <li className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <Footprints aria-hidden="true" className="size-4 text-maroon" /> A pé
        </li>
      </ul>

      <Button asChild block>
        <Link to={paths.eventOrigin(event.id)}>
          Definir partida <ArrowRight />
        </Link>
      </Button>
    </Surface>
  )
}
