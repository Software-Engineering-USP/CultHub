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
    <header className="relative z-5 mt-8 flex min-h-20 items-center gap-8 rounded-[44px] border border-line/60 bg-surface py-[14px] pr-6 pl-[30px] shadow-soft max-lg:gap-[22px] max-md:flex-wrap max-md:gap-5 max-md:rounded-[30px] max-md:px-[22px] max-md:py-4 max-sm:mt-[18px] max-sm:gap-4 max-sm:rounded-[26px] max-sm:px-[17px] max-sm:py-[15px]">
      <Link
        to={paths.home}
        aria-label="CultHub São Paulo, início"
        className="inline-flex shrink-0 items-center gap-[9px] text-maroon no-underline"
      >
        <MapPin strokeWidth={2.5} className="size-9 max-sm:size-7" />
        <span>
          <span className="block text-[26px] leading-[1.1] font-extrabold tracking-[-.055em] max-sm:text-[24px]">
            CultHub
          </span>
          <span className="mt-[3px] block text-[9px] leading-[1.2] font-bold tracking-[.24em] max-sm:text-[8px]">
            SÃO PAULO
          </span>
        </span>
      </Link>

      <form
        role="search"
        onSubmit={onFormSubmit((data) => api.events.search(text(data, 'busca')))}
        className="mx-auto flex w-[min(100%,500px)] items-center gap-[10px] rounded-[28px] border border-[#eae3d8] bg-[#f4f0e8] px-[18px] py-[10px] max-lg:max-w-[420px] max-md:order-3 max-md:w-full max-md:max-w-none max-sm:px-[13px]"
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
          className="w-full min-w-0 border-0 bg-transparent text-[13px] text-ink outline-offset-[6px] max-sm:text-[11px]"
        />
        <span className="sr-only" id="aviso-busca">
          Busca demonstrativa: a pesquisa só aparece no console e não filtra os eventos.
        </span>
      </form>

      <nav
        aria-label="Navegação principal"
        className="flex shrink-0 items-center gap-[22px] max-md:ml-auto max-sm:gap-[14px]"
      >
        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger className="flex min-h-11 items-center gap-[9px] rounded-full px-4 text-[13px] font-[650] transition-colors hover:bg-accent data-[state=open]:bg-accent max-sm:gap-[5px] max-sm:px-3 max-sm:text-[11px]">
            <SlidersHorizontal className="size-4.5 max-sm:size-4" />
            Filtros
          </PopoverTrigger>
          <PopoverContent aria-label="Filtrar eventos" className="w-80 bg-background p-5">
            <EventFilters onClose={() => setFiltersOpen(false)} />
          </PopoverContent>
        </Popover>

        {onSignIn ? (
          <NavLink to={paths.signIn} className="font-bold text-maroon no-underline">
            Entrar
          </NavLink>
        ) : (
          <NavLink
            to={paths.account}
            aria-label={`${onAccount ? 'Conta' : 'Ver conta'} de exemplo de ${user.name}`}
            className="rounded-full"
          >
            <InitialsAvatar initials={user.initials} className="max-sm:size-9.5" />
          </NavLink>
        )}
      </nav>
    </header>
  )
}
