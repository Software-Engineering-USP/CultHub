import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import BackLink from '@/components/common/BackLink'
import SectionHeading from '@/components/common/SectionHeading'
import StaticMap from '@/components/common/StaticMap'
import type { StaticMapProps } from '@/components/common/StaticMap'
import Surface from '@/components/common/Surface'
import type { SurfaceProps } from '@/components/common/Surface'
import EventStrip from '@/components/events/EventStrip'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import WeatherStrip from '@/components/weather/WeatherStrip'
import { shortName } from '@/lib/events'
import { paths } from '@/lib/paths'
import { cn } from '@/lib/utils'
import type { CultEvent } from '@/types'

interface PlanVisitLayoutProps {
  event: CultEvent
  /** Texto abaixo do título "Como chegar" */
  description: string
  /** Selo à direita do título */
  status: ReactNode
  /** Mapa estático da coluna da direita */
  map: Omit<StaticMapProps, 'legend' | 'className'>
  /** Painel da coluna da esquerda (use PlanVisitPanel) */
  children: ReactNode
}

/** Estrutura comum às páginas "Como chegar": definir origem e rota de exemplo. */
export default function PlanVisitLayout({
  event,
  description,
  status,
  map,
  children,
}: Readonly<PlanVisitLayoutProps>) {
  return (
    <>
      <BackLink to={paths.event(event.id)}>Voltar para o evento</BackLink>
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={paths.home}>Explorar</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={paths.event(event.id)}>{shortName(event)}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Como chegar</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <SectionHeading as="h1" title="Como chegar" description={description} className="mb-7">
        {status}
      </SectionHeading>

      <EventStrip event={event} />

      <div className="grid grid-cols-[minmax(300px,400fr)_minmax(0,856fr)] items-start gap-6 max-lg:grid-cols-[minmax(300px,.9fr)_minmax(0,1.5fr)] max-md:grid-cols-1">
        {children}
        <StaticMap {...map} />
      </div>

      <WeatherStrip event={event} />
    </>
  )
}

/** Painel da coluna da esquerda do PlanVisitLayout. */
export function PlanVisitPanel({ className, ...props }: Readonly<SurfaceProps>) {
  return <Surface as="section" className={cn('p-6 max-md:p-7 max-sm:p-5', className)} {...props} />
}
