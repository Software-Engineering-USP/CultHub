import { screen, within } from '@testing-library/react'
import { Link } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { paths } from '@/lib/paths'
import { renderWithRouter } from '@tests/render'

function renderBreadcrumb() {
  return renderWithRouter(
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to={paths.home}>Explorar</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>Música</BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Jazz &amp; Blues</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>,
  )
}

describe('Breadcrumb', () => {
  it('é uma navegação com nome em português', () => {
    renderBreadcrumb()
    expect(screen.getByRole('navigation', { name: 'Caminho da página' })).toBeInTheDocument()
  })

  it('usa o Link do router no item com asChild', () => {
    renderBreadcrumb()
    expect(screen.getByRole('link', { name: 'Explorar' })).toHaveAttribute('href', paths.home)
  })

  it('marca a página atual e esconde os separadores de leitores de tela', () => {
    renderBreadcrumb()
    expect(screen.getByText('Jazz & Blues')).toHaveAttribute('aria-current', 'page')

    const list = screen.getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(within(list).getAllByText('/')).toHaveLength(2)
    for (const separator of within(list).getAllByText('/')) {
      expect(separator).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('BreadcrumbLink sem asChild é um <a> comum', () => {
    renderWithRouter(<BreadcrumbLink href="/x">Início</BreadcrumbLink>)
    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/x')
  })
})
