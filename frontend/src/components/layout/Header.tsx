import { MapPin, Search, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import InitialsAvatar from '@/components/common/InitialsAvatar'
import EventFilters from '@/components/events/EventFilters'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { onFormSubmit, text } from '@/lib/forms'
import { paths } from '@/lib/paths'
import { api } from '@/services/api'

export default function Header() {
  const { pathname } = useLocation()
  const user = useCurrentUser()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const onAccount = pathname === paths.account
  const onSignIn = pathname === paths.signIn

  return (
    <header className="relative z-5 mt-8 flex min-h-20 items-center gap-8 rounded-full border border-border/60 bg-card py-3.5 pr-6 pl-7.5 shadow-soft max-lg:gap-5.5 max-md:flex-wrap max-md:gap-5 max-md:rounded-4xl max-md:px-5.5 max-md:py-4 max-sm:mt-4.5 max-sm:gap-4 max-sm:rounded-3xl max-sm:px-4 max-sm:py-4">
      <Link
        to={paths.home}
        aria-label="CultHub São Paulo, início"
        className="inline-flex shrink-0 items-center gap-2 text-maroon no-underline"
      >
        <MapPin strokeWidth={2.5} className="size-9 max-sm:size-7" />
        <span>
          <span className="block text-2xl leading-none font-extrabold tracking-tighter">CultHub</span>
          <span className="mt-1 block text-2xs leading-tight font-bold tracking-wordmark">SÃO PAULO</span>
        </span>
      </Link>

      <form
        role="search"
        onSubmit={onFormSubmit((data) => void api.events.search(text(data, 'busca')))}
        className="mx-auto flex w-full max-w-125 items-center gap-2.5 rounded-full border border-border bg-background px-4.5 py-2.5 max-lg:max-w-105 max-md:order-3 max-md:w-full max-md:max-w-none max-sm:px-3"
      >
        <Search className="size-5 shrink-0" />
        <label className="sr-only" htmlFor="busca">
          Buscar eventos
        </label>
        <input
          id="busca"
          name="busca"
          type="search"
          placeholder="Busque eventos, artistas ou lugares"
          aria-describedby="aviso-busca"
          className="w-full min-w-0 border-0 bg-transparent text-sm text-foreground outline-offset-6 max-sm:text-xs"
        />
        <span className="sr-only" id="aviso-busca">
          Busca demonstrativa: a pesquisa só aparece no console e não filtra os eventos.
        </span>
      </form>

      <nav
        aria-label="Navegação principal"
        className="flex shrink-0 items-center gap-5.5 max-md:ml-auto max-sm:gap-3.5"
      >
        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger className="flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors hover:bg-accent data-[state=open]:bg-accent max-sm:gap-1 max-sm:px-3 max-sm:text-xs">
            <SlidersHorizontal className="size-4.5 max-sm:size-4" />
            Filtros
          </PopoverTrigger>
          <PopoverContent aria-label="Filtrar eventos" className="w-80 bg-background p-5">
            <EventFilters onClose={() => setFiltersOpen(false)} />
          </PopoverContent>
        </Popover>

        {onSignIn || !user ? (
          <NavLink to={paths.signIn} className="font-bold text-maroon no-underline">
            Entrar
          </NavLink>
        ) : (
          <NavLink
            to={paths.account}
            aria-label={`${onAccount ? 'Conta' : 'Ver conta'} de ${user.name}`}
            className="rounded-full"
          >
            <InitialsAvatar initials={user.initials} className="max-sm:size-9.5" />
          </NavLink>
        )}
      </nav>
    </header>
  )
}
