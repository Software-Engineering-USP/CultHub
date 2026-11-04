import { useCallback, useEffect, useState } from 'react'

/**
 * Qual seção da página está sendo lida agora (para destacar o item certo num menu de âncoras).
 * Ao rolar, é a última seção cujo topo já passou de 35% da altura da tela; no fim da página, a última.
 * Ao clicar num item (`select`), ele fica ativo até a pessoa rolar por conta própria, porque a
 * rolagem até a seção pode nem acontecer (por exemplo, quando a página já está no fim).
 */
export function useActiveSection(ids: string[]) {
  const [scrolled, setScrolled] = useState(ids[0])
  const [selected, setSelected] = useState<string | null>(null)
  const key = ids.join()

  useEffect(() => {
    const sectionIds = key.split(',')

    function update() {
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      if (atBottom) {
        setScrolled(sectionIds[sectionIds.length - 1])
        return
      }
      const line = window.innerHeight * 0.35
      let current = sectionIds[0]
      for (const id of sectionIds) {
        const top = document.getElementById(id)?.getBoundingClientRect().top
        if (top !== undefined && top <= line) current = id
      }
      setScrolled(current)
    }

    let frame = requestAnimationFrame(update)
    function onScroll() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    // Rolagem feita pela pessoa (e não pelo clique no menu) volta a seguir a posição da página
    function onUserScroll() {
      setSelected(null)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    window.addEventListener('wheel', onUserScroll, { passive: true })
    window.addEventListener('touchmove', onUserScroll, { passive: true })
    window.addEventListener('keydown', onUserScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('wheel', onUserScroll)
      window.removeEventListener('touchmove', onUserScroll)
      window.removeEventListener('keydown', onUserScroll)
    }
  }, [key])

  const select = useCallback((id: string) => setSelected(id), [])

  return { active: selected ?? scrolled, select }
}
