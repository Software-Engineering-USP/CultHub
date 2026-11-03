import { useEffect } from 'react'
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
        className="fixed top-2 left-3 z-100 translate-y-[-160%] rounded-[10px] bg-maroon px-[18px] py-[10px] text-white focus:translate-y-0"
      >
        Pular para o conteúdo
      </a>

      <div className="mx-auto w-full max-w-[1440px] px-20 max-lg:px-9 max-md:px-7 max-sm:px-[18px]">
        <Header />
        <main id="conteudo" className="pt-[42px] pb-16 max-md:pt-[30px] max-sm:pt-7 max-sm:pb-10">
          <Outlet />
        </main>
        <Footer />
      </div>
    </>
  )
}
