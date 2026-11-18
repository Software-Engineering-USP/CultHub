import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useComments, useUserComments } from '@/hooks/useComments'
import { api, ApiError } from '@/services/api'
import type { ApiComment } from '@/services/api'
import type { Paginated } from '@/services/catalog'
import { AuthTestProvider } from '@tests/auth'
import { apiComment, apiMyComment, commentPage } from '@tests/fixtures/comments'

const loggedIn = ({ children }: { children: ReactNode }) => <AuthTestProvider>{children}</AuthTestProvider>

afterEach(() => {
  vi.restoreAllMocks()
})

async function renderComments(results = [apiComment()], next: string | null = null) {
  const list = vi.spyOn(api.comments, 'list').mockResolvedValue(commentPage(results, next))
  const hook = renderHook(() => useComments('sp-jazz-blues-festival'))
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return { ...hook, list }
}

describe('useComments', () => {
  it('carrega a primeira página e converte os campos', async () => {
    const reply = apiComment({ id: 'r1', nivel: 1, resposta_a: 'c1', texto: 'Também!' })
    const { result, list } = await renderComments([apiComment({ respostas: [reply] })])

    expect(list).toHaveBeenCalledWith('sp-jazz-blues-festival', 1)
    expect(result.current.count).toBe(1)
    expect(result.current.hasMore).toBe(false)
    const [comment] = result.current.comments
    expect(comment).toMatchObject({
      id: 'c1',
      eventId: 'sp-jazz-blues-festival',
      author: { id: 'rafael-martins', name: 'Rafael Martins', initials: 'RM' },
      text: 'Gostei da proposta!',
    })
    expect(comment.replies[0]).toMatchObject({ id: 'r1', parentId: 'c1', level: 1, text: 'Também!' })
  })

  it('não busca nada sem id do evento', () => {
    const list = vi.spyOn(api.comments, 'list')
    const { result } = renderHook(() => useComments(undefined))
    expect(result.current).toMatchObject({ comments: [], loading: false })
    expect(list).not.toHaveBeenCalled()
  })

  it('mostra a mensagem da API quando a lista falha', async () => {
    vi.spyOn(api.comments, 'list').mockRejectedValue(new ApiError('Evento não encontrado.', 404))
    const { result } = renderHook(() => useComments('x'))
    await waitFor(() => expect(result.current.error).toBe('Evento não encontrado.'))
  })

  it('carrega mais páginas sem repetir comentários', async () => {
    const { result, list } = await renderComments([apiComment()], 'next')
    expect(result.current.hasMore).toBe(true)

    list.mockResolvedValue(commentPage([apiComment(), apiComment({ id: 'c2' })], null, 2))
    await act(() => result.current.loadMore())

    expect(list).toHaveBeenLastCalledWith('sp-jazz-blues-festival', 2)
    expect(result.current.comments.map((comment) => comment.id)).toEqual(['c1', 'c2'])
    expect(result.current.hasMore).toBe(false)
  })

  it('criar põe o comentário no topo e conta mais um', async () => {
    const { result } = await renderComments()
    vi.spyOn(api.comments, 'create').mockResolvedValue(
      apiComment({ id: 'novo', texto: 'Que noite!', meu: true }),
    )

    await act(() => result.current.create('Que noite!'))

    expect(api.comments.create).toHaveBeenCalledWith('sp-jazz-blues-festival', 'Que noite!')
    expect(result.current.comments.map((comment) => comment.id)).toEqual(['novo', 'c1'])
    expect(result.current.count).toBe(2)
  })

  it('responder anexa a resposta ao comentário', async () => {
    const { result } = await renderComments()
    vi.spyOn(api.comments, 'reply').mockResolvedValue(apiComment({ id: 'r1', nivel: 1, resposta_a: 'c1' }))

    await act(() => result.current.reply('c1', 'Também!'))

    expect(api.comments.reply).toHaveBeenCalledWith('c1', 'Também!')
    expect(result.current.comments[0].replies.map((reply) => reply.id)).toEqual(['r1'])
    expect(result.current.count).toBe(1)
  })

  it('editar troca o texto e mantém as respostas', async () => {
    const reply = apiComment({ id: 'r1', nivel: 1, resposta_a: 'c1' })
    const { result } = await renderComments([apiComment({ meu: true, respostas: [reply] })])
    vi.spyOn(api.comments, 'update').mockResolvedValue(
      apiComment({ meu: true, texto: 'Novo texto', editado_em: '2026-11-16T10:00:00Z' }),
    )

    await act(() => result.current.update('c1', 'Novo texto'))

    expect(result.current.comments[0]).toMatchObject({ text: 'Novo texto', editedAt: '2026-11-16T10:00:00Z' })
    expect(result.current.comments[0].replies).toHaveLength(1)
  })

  it('remover sem respostas tira o comentário; com respostas, marca como removido', async () => {
    const reply = apiComment({ id: 'r1', nivel: 1, resposta_a: 'c1' })
    const { result } = await renderComments([
      apiComment({ meu: true, respostas: [reply] }),
      apiComment({ id: 'c2', meu: true }),
    ])
    vi.spyOn(api.comments, 'remove').mockResolvedValue()

    await act(() => result.current.remove('c2'))
    expect(result.current.comments.map((comment) => comment.id)).toEqual(['c1'])
    expect(result.current.count).toBe(1)

    await act(() => result.current.remove('c1'))
    expect(result.current.comments[0]).toMatchObject({ removed: true, text: null, author: null, mine: false })

    // Sem a última resposta, o removido também sai da lista.
    await act(() => result.current.remove('r1'))
    expect(result.current.comments).toEqual([])
    expect(result.current.count).toBe(0)
  })

  it('mostra uma mensagem genérica quando a lista falha sem ApiError', async () => {
    vi.spyOn(api.comments, 'list').mockRejectedValue(new Error('rede'))
    const { result } = renderHook(() => useComments('x'))
    await waitFor(() => expect(result.current.error).toBe('Não foi possível carregar os comentários.'))
    expect(result.current).toMatchObject({ comments: [], count: 0, loading: false, hasMore: false })
  })

  it('carregar mais sem próxima página não busca nada', async () => {
    const { result, list } = await renderComments()
    await act(() => result.current.loadMore())
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('mantém os comentários e mostra o erro quando carregar mais falha', async () => {
    const { result, list } = await renderComments([apiComment()], 'next')
    list.mockRejectedValue(new ApiError('Muitas requisições.', 429))

    await act(() => result.current.loadMore())

    expect(result.current.error).toBe('Muitas requisições.')
    expect(result.current.comments.map((comment) => comment.id)).toEqual(['c1'])
    expect(result.current.hasMore).toBe(true)
    expect(result.current.loadingMore).toBe(false)
  })

  it('segue para a página 3 quando a página 2 ainda tem próxima', async () => {
    const { result, list } = await renderComments([apiComment()], 'next')
    list.mockResolvedValue(commentPage([apiComment({ id: 'c2' })], 'next', 3))
    await act(() => result.current.loadMore())
    expect(result.current.hasMore).toBe(true)

    list.mockResolvedValue(commentPage([apiComment({ id: 'c3' })], null, 3))
    await act(() => result.current.loadMore())

    expect(list).toHaveBeenLastCalledWith('sp-jazz-blues-festival', 3)
    expect(result.current.comments.map((comment) => comment.id)).toEqual(['c1', 'c2', 'c3'])
    expect(result.current.count).toBe(3)
  })

  it('ignora a resposta da lista que chega depois de trocar de evento', async () => {
    let resolveFirst: (page: Paginated<ApiComment>) => void = () => {}
    vi.spyOn(api.comments, 'list')
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(commentPage([apiComment({ id: 'b1', evento: 'b' })]))
    const { result, rerender } = renderHook(({ id }) => useComments(id), { initialProps: { id: 'a' } })

    rerender({ id: 'b' })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => resolveFirst(commentPage([apiComment({ id: 'a1', evento: 'a' })])))

    expect(result.current.comments.map((comment) => comment.id)).toEqual(['b1'])
  })

  it('criar sem id do evento não chama a API', async () => {
    const create = vi.spyOn(api.comments, 'create')
    const { result } = renderHook(() => useComments(undefined))
    await act(() => result.current.create('oi'))
    expect(create).not.toHaveBeenCalled()
  })

  it('responder encontra o comentário depois de outros com respostas', async () => {
    const r1 = apiComment({ id: 'r1', nivel: 1, resposta_a: 'c1' })
    const { result } = await renderComments([apiComment({ respostas: [r1] }), apiComment({ id: 'c2' })])
    vi.spyOn(api.comments, 'reply').mockResolvedValue(apiComment({ id: 'r2', nivel: 1, resposta_a: 'c2' }))

    await act(() => result.current.reply('c2', 'Oi'))

    expect(result.current.comments[0].replies.map((reply) => reply.id)).toEqual(['r1'])
    expect(result.current.comments[1].replies.map((reply) => reply.id)).toEqual(['r2'])
    expect(result.current.count).toBe(2)
  })

  it('remover uma resposta mantém o comentário que ainda tem outras', async () => {
    const respostas = [
      apiComment({ id: 'r1', nivel: 1, resposta_a: 'c1' }),
      apiComment({ id: 'r2', nivel: 1, resposta_a: 'c1' }),
    ]
    const { result } = await renderComments([apiComment({ respostas })])
    vi.spyOn(api.comments, 'remove').mockResolvedValue()

    await act(() => result.current.remove('r1'))

    expect(result.current.comments[0].replies.map((reply) => reply.id)).toEqual(['r2'])
    expect(result.current.count).toBe(1)
  })

  it('repassa o erro das ações para quem chamou', async () => {
    const { result } = await renderComments()
    vi.spyOn(api.comments, 'create').mockRejectedValue(new ApiError('Muitas requisições.', 429))
    await expect(result.current.create('oi')).rejects.toThrow('Muitas requisições.')
    expect(result.current.comments).toHaveLength(1)
  })
})

describe('useUserComments', () => {
  it('não busca nada para visitantes', () => {
    const mine = vi.spyOn(api.comments, 'mine')
    const { result } = renderHook(() => useUserComments(), {
      wrapper: ({ children }) => <AuthTestProvider initialUser={null}>{children}</AuthTestProvider>,
    })
    expect(result.current).toMatchObject({ comments: [], loading: false, error: null })
    expect(mine).not.toHaveBeenCalled()
  })

  it('busca todas as páginas do usuário logado', async () => {
    const mine = vi
      .spyOn(api.comments, 'mine')
      .mockResolvedValueOnce(commentPage([apiMyComment()], 'next', 2))
      .mockResolvedValueOnce(commentPage([apiMyComment({ id: 'm2', nivel: 1, resposta_a: 'c1' })], null, 2))
    const { result } = renderHook(() => useUserComments(), { wrapper: loggedIn })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mine).toHaveBeenCalledWith(1)
    expect(mine).toHaveBeenCalledWith(2)
    expect(result.current.comments[0]).toMatchObject({
      id: 'm1',
      event: { id: 'sp-jazz-blues-festival', title: 'São Paulo Jazz & Blues Festival' },
    })
    expect(result.current.comments[1]).toMatchObject({ id: 'm2', level: 1, parentId: 'c1' })
  })

  it('editar e remover atualizam a lista', async () => {
    vi.spyOn(api.comments, 'mine').mockResolvedValue(
      commentPage([apiMyComment(), apiMyComment({ id: 'm2' })]),
    )
    vi.spyOn(api.comments, 'update').mockResolvedValue(
      apiComment({ id: 'm1', texto: 'Editado', editado_em: '2026-11-16T10:00:00Z' }),
    )
    vi.spyOn(api.comments, 'remove').mockResolvedValue()
    const { result } = renderHook(() => useUserComments(), { wrapper: loggedIn })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.update('m1', 'Editado'))
    expect(result.current.comments[0]).toMatchObject({ text: 'Editado', editedAt: '2026-11-16T10:00:00Z' })

    await act(() => result.current.remove('m2'))
    expect(result.current.comments.map((comment) => comment.id)).toEqual(['m1'])
  })

  it('busca as páginas restantes pelo total da primeira', async () => {
    const mine = vi
      .spyOn(api.comments, 'mine')
      .mockResolvedValueOnce(commentPage([apiMyComment(), apiMyComment({ id: 'm2' })], 'next', 5))
      .mockResolvedValueOnce(commentPage([apiMyComment({ id: 'm3' }), apiMyComment({ id: 'm4' })], 'next', 5))
      .mockResolvedValueOnce(commentPage([apiMyComment({ id: 'm5' })], null, 5))
    const { result } = renderHook(() => useUserComments(), { wrapper: loggedIn })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mine.mock.calls).toEqual([[1], [2], [3]])
    expect(result.current.comments.map((comment) => comment.id)).toEqual(['m1', 'm2', 'm3', 'm4', 'm5'])
  })

  it('mostra carregando até a lista chegar', () => {
    vi.spyOn(api.comments, 'mine').mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useUserComments(), { wrapper: loggedIn })
    expect(result.current).toMatchObject({ comments: [], loading: true, error: null })
  })

  it('editar usa o texto enviado se a resposta não trouxer o texto', async () => {
    vi.spyOn(api.comments, 'mine').mockResolvedValue(commentPage([apiMyComment()]))
    vi.spyOn(api.comments, 'update').mockResolvedValue(
      apiComment({ id: 'm1', texto: null, editado_em: '2026-11-16T10:00:00Z' }),
    )
    const { result } = renderHook(() => useUserComments(), { wrapper: loggedIn })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.update('m1', 'Enviado'))
    expect(result.current.comments[0].text).toBe('Enviado')
  })

  it('mostra a mensagem da API quando a lista falha', async () => {
    vi.spyOn(api.comments, 'mine').mockRejectedValue(new ApiError('Faça login.', 403))
    const { result } = renderHook(() => useUserComments(), { wrapper: loggedIn })
    await waitFor(() => expect(result.current.error).toBe('Faça login.'))
  })

  it('mostra erro quando a lista falha', async () => {
    vi.spyOn(api.comments, 'mine').mockRejectedValue(new Error('rede'))
    const { result } = renderHook(() => useUserComments(), { wrapper: loggedIn })
    await waitFor(() => expect(result.current.error).toBe('Não foi possível carregar seus comentários.'))
  })
})
