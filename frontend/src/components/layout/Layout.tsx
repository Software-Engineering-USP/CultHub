import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Footer from './Footer'
import Header from './Header'

export default function Layout() {
  const { pathname } = useLocation()

  // Ao trocar de página, volta ao topo (âncoras como #dados não passam por aqui).
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <>
      <a
        href="#conteudo"
        className="fixed top-2 left-3 z-100 -translate-y-16 rounded-xl bg-maroon px-4.5 py-2.5 text-white focus:translate-y-0"
      >
        Pular para o conteúdo
      </a>

      <div className="mx-auto w-full max-w-360 px-20 max-lg:px-9 max-md:px-7 max-sm:px-4.5">
        <Header />
        <main id="conteudo" className="pt-10 pb-16 max-md:pt-7.5 max-sm:pt-7 max-sm:pb-10">
          <Suspense
            fallback={
              <output className="text-muted-foreground">
                Carregando…
              </output>
            }
          >
            <Outlet />
          </Suspense>
        </main>
        <Footer />
      </div>
    </>
  )
}
