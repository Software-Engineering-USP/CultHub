import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AttendeesList from '@/components/events/AttendeesList'
import { paths } from '@/lib/paths'
import { api, ApiError } from '@/services/api'
import { apiAttendee } from '@tests/fixtures/attendees'
import { commentPage as page } from '@tests/fixtures/comments'
import { renderWithRouter } from '@tests/render'

const EVENT_ID = 'sp-jazz-blues-festival'
const bia = apiAttendee({ id: 'bia', nome: 'Bia Lima', iniciais: 'BL' })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AttendeesList', () => {
  it('mostra iniciais e nomes com link para o perfil de cada pessoa', async () => {
    vi.spyOn(api.agenda, 'attendees').mockResolvedValue(page([apiAttendee(), bia]))
    renderWithRouter(<AttendeesList eventId={EVENT_ID} />)

    expect(screen.getByRole('heading', { name: 'Quem vai' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
    expect(await screen.findByRole('link', { name: 'Rafael Martins' })).toHaveAttribute(
      'href',
      paths.user('rafael-martins'),
    )
    expect(screen.getByRole('link', { name: 'Bia Lima' })).toHaveAttribute('href', paths.user('bia'))
    expect(screen.getByText('BL')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver mais' })).not.toBeInTheDocument()
  })

  it('Ver mais carrega a página seguinte', async () => {
    const list = vi
      .spyOn(api.agenda, 'attendees')
      .mockResolvedValueOnce(page([apiAttendee()], 'next', 2))
      .mockResolvedValueOnce(page([bia], null, 2))
    const { user } = renderWithRouter(<AttendeesList eventId={EVENT_ID} />)

    await user.click(await screen.findByRole('button', { name: 'Ver mais' }))

    expect(list).toHaveBeenLastCalledWith(EVENT_ID, 2)
    expect(await screen.findByRole('link', { name: 'Bia Lima' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Rafael Martins' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver mais' })).not.toBeInTheDocument()
  })

  it('mostra o erro de Ver mais sem perder a lista', async () => {
    vi.spyOn(api.agenda, 'attendees')
      .mockResolvedValueOnce(page([apiAttendee()], 'next', 2))
      .mockRejectedValueOnce(new ApiError('Falha ao carregar.', 500))
    const { user } = renderWithRouter(<AttendeesList eventId={EVENT_ID} />)

    await user.click(await screen.findByRole('button', { name: 'Ver mais' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao carregar.')
    expect(screen.getByRole('link', { name: 'Rafael Martins' })).toBeInTheDocument()
  })

  it('mostra o erro da primeira página', async () => {
    vi.spyOn(api.agenda, 'attendees').mockRejectedValue(new TypeError('offline'))
    renderWithRouter(<AttendeesList eventId={EVENT_ID} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar quem vai ao evento.',
    )
  })

  it('avisa quando ninguém confirmou presença', async () => {
    vi.spyOn(api.agenda, 'attendees').mockResolvedValue(page([]))
    renderWithRouter(<AttendeesList eventId={EVENT_ID} />)

    expect(await screen.findByText('Ninguém confirmou presença ainda.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('não mostra nada nem busca a lista para visitantes', () => {
    const list = vi.spyOn(api.agenda, 'attendees')
    const { container } = renderWithRouter(<AttendeesList eventId={EVENT_ID} />, { authUser: null })

    expect(container).toBeEmptyDOMElement()
    expect(list).not.toHaveBeenCalled()
  })
})
