import { Link, NavLink, useLocation } from 'react-router-dom'
import { currentUser } from '../../data/events'
import { categories, categoryOrder } from '../../lib/categories'
import { avatarClass } from '../../lib/classes'
import CategoryDot from '../ui/CategoryDot'
import { BrandMark, FiltersIcon, SearchIcon } from '../ui/Icons'

export default function Header() {
  const { pathname } = useLocation()
  const onAccount = pathname === '/conta'
  const onSignIn = pathname === '/entrar'

  return (
    <header className="relative z-[5] mt-8 flex min-h-20 items-center gap-8 rounded-[44px] border border-line/60 bg-surface py-[14px] pl-[30px] pr-6 shadow-soft max-lg:gap-[22px] max-md:flex-wrap max-md:gap-5 max-md:rounded-[30px] max-md:px-[22px] max-md:py-4 max-sm:mt-[18px] max-sm:gap-4 max-sm:rounded-[26px] max-sm:px-[17px] max-sm:py-[15px]">
      <Link
        to="/"
        aria-label="CultHub São Paulo, início"
        className="inline-flex shrink-0 items-center gap-[9px] text-maroon no-underline"
      >
        <BrandMark className="h-9 w-[30px] max-sm:w-[26px]" />
        <span>
          <span className="block text-[26px] font-extrabold leading-[1.1] tracking-[-.055em] max-sm:text-[24px]">
            CultHub
          </span>
          <span className="mt-[3px] block text-[9px] font-bold leading-[1.2] tracking-[.24em] max-sm:text-[8px]">
            SÃO PAULO
          </span>
        </span>
      </Link>

      <div
        role="search"
        className="mx-auto flex w-[min(100%,500px)] items-center gap-[10px] rounded-[28px] border border-[#eae3d8] bg-[#f4f0e8] px-[18px] py-[10px] max-lg:max-w-[420px] max-md:order-3 max-md:w-full max-md:max-w-none max-sm:px-[13px]"
      >
        <SearchIcon className="h-[19px] w-[19px] shrink-0" />
        <label className="sr-only" htmlFor="busca">
          Buscar eventos (campo demonstrativo, sem filtragem)
        </label>
        <input
          id="busca"
          type="search"
          placeholder="Busque eventos, artistas ou lugares"
          aria-describedby="aviso-busca"
          className="w-full min-w-0 border-0 bg-transparent text-[13px] text-ink outline-offset-[6px] max-sm:text-[11px]"
        />
        <span className="sr-only" id="aviso-busca">
          Busca demonstrativa, não filtra os eventos.
        </span>
      </div>

      <nav aria-label="Navegação principal" className="flex shrink-0 items-center gap-[22px] max-md:ml-auto max-sm:gap-[14px]">
        <details className="relative max-sm:static">
          <summary className="flex min-h-11 list-none items-center gap-[9px] text-[13px] font-[650] max-sm:gap-[5px] max-sm:text-[11px] [&::-webkit-details-marker]:hidden">
            <FiltersIcon className="h-[18px] w-[18px] max-sm:w-4" />
            Filtros
          </summary>
          <div className="absolute right-0 top-[calc(100%+14px)] w-[280px] rounded-[20px] border border-line bg-surface p-[22px] shadow-popover max-sm:right-3 max-sm:top-[calc(100%+8px)] max-sm:w-[min(280px,calc(100vw-72px))]">
            <strong className="mb-3 block text-maroon">Categorias culturais</strong>
            <ul className="mb-4 grid grid-cols-2 gap-3">
              {categoryOrder.map((id) => (
                <li key={id}>
                  <CategoryDot id={id} />
                  {categories[id].label}
                </li>
              ))}
            </ul>
            <small className="block text-muted">
              Exibição demonstrativa. As categorias e a busca não alteram os resultados.
            </small>
          </div>
        </details>

        {onSignIn ? (
          <NavLink to="/entrar" className="font-bold text-maroon no-underline">
            Entrar
          </NavLink>
        ) : (
          <NavLink
            to="/conta"
            aria-label={`${onAccount ? 'Conta' : 'Ver conta'} de exemplo de ${currentUser.name}`}
            className={avatarClass('md')}
          >
            {currentUser.initials}
          </NavLink>
        )}
      </nav>
    </header>
  )
}
