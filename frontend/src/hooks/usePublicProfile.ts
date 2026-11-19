import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/services/api'
import { toPublicProfile } from '@/services/users'
import type { PublicProfile } from '@/types'

interface PublicProfileState {
  id?: string
  profile?: PublicProfile
  error: ApiError | Error | null
}

/** Carrega o perfil público do usuário `id`. Sem `id` (ou com `enabled` falso), não chama a API. */
export function usePublicProfile(id: string | undefined, enabled = true) {
  const [state, setState] = useState<PublicProfileState>({ error: null })
  const [attempt, setAttempt] = useState(0)
  const [prevEnabled, setPrevEnabled] = useState(enabled)
  // Ao reativar, descarta o resultado anterior para não mostrá-lo enquanto busca de novo.
  if (enabled !== prevEnabled) {
    setPrevEnabled(enabled)
    setState({ error: null })
  }

  useEffect(() => {
    if (!id || !enabled) return
    let active = true
    api.users
      .profile(id)
      .then((profile) => {
        if (active) setState({ id, profile: toPublicProfile(profile), error: null })
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            id,
            error: error instanceof Error ? error : new Error('Não foi possível carregar o perfil.'),
          })
        }
      })
    return () => {
      active = false
    }
  }, [id, enabled, attempt])

  /** Busca de novo (ex.: depois de uma falha de rede), mostrando o carregamento enquanto isso. */
  const retry = useCallback(() => {
    setState({ error: null })
    setAttempt((n) => n + 1)
  }, [])

  if (!id)
    return { loading: false, profile: undefined, error: new ApiError('Perfil não encontrado.', 404), retry }
  if (state.id !== id) return { loading: enabled, profile: undefined, error: null, retry }
  return { loading: false, profile: state.profile, error: state.error, retry }
}
