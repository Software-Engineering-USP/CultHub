import { useCallback, useEffect, useState } from 'react'
import { api } from '@/services/api'
import type { ApiState } from '@/services/api'

// A lista do IBGE só muda com uma nova versão do backend: cada consulta é feita uma vez por sessão.
let statesRequest: Promise<ApiState[]> | undefined
const citiesRequests = new Map<string, Promise<string[]>>()

/** Sem resposta nesse tempo, a consulta conta como falha (e pode ser repetida). */
export const LOCALITIES_TIMEOUT_MS = 15_000

/** Esquece as listas já carregadas (para os testes começarem do zero). */
export function clearLocalitiesCache() {
  statesRequest = undefined
  citiesRequests.clear()
}

function withTimeout<T>(request: Promise<T>, failure: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(failure)), LOCALITIES_TIMEOUT_MS)
    request.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

function loadStates() {
  statesRequest ??= withTimeout(api.localities.states(), 'Os estados demoraram a carregar.').catch(
    (error: unknown) => {
      statesRequest = undefined
      throw error
    },
  )
  return statesRequest
}

function loadCities(state: string) {
  let request = citiesRequests.get(state)
  if (!request) {
    request = withTimeout(api.localities.cities(state), 'As cidades demoraram a carregar.').catch(
      (error: unknown) => {
        citiesRequests.delete(state)
        throw error
      },
    )
    citiesRequests.set(state, request)
  }
  return request
}

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

interface StatesState {
  attempt: number
  states: ApiState[]
  error: string | null
}

/** As 27 UFs. `retry` consulta de novo depois de um erro. */
export function useStates() {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<StatesState>({ attempt: -1, states: [], error: null })

  useEffect(() => {
    let active = true
    loadStates()
      .then((states) => {
        if (active) setResult({ attempt, states, error: null })
      })
      .catch((error: unknown) => {
        if (active) {
          setResult({ attempt, states: [], error: message(error, 'Não foi possível carregar os estados.') })
        }
      })
    return () => {
      active = false
    }
  }, [attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  // Enquanto a nova tentativa não responde, o erro anterior some.
  const current = result.attempt === attempt
  return {
    states: current ? result.states : [],
    error: current ? result.error : null,
    retry,
  }
}

interface CitiesState {
  /** UF e tentativa a que a resposta se refere */
  key: string
  cities: string[]
  error: string | null
}

/** Municípios da UF `state`; sem UF, lista vazia. `retry` consulta de novo depois de um erro. */
export function useCities(state: string) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<CitiesState>({ key: '', cities: [], error: null })
  const key = `${state}|${attempt}`

  useEffect(() => {
    if (!state) return
    let active = true
    loadCities(state)
      .then((cities) => {
        if (active) setResult({ key, cities, error: null })
      })
      .catch((error: unknown) => {
        if (active) {
          setResult({ key, cities: [], error: message(error, 'Não foi possível carregar as cidades.') })
        }
      })
    return () => {
      active = false
    }
  }, [state, key])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  // Resposta de outra UF (ou de uma tentativa anterior) não vale para a atual.
  const current = state !== '' && result.key === key
  return {
    cities: current ? result.cities : [],
    error: current ? result.error : null,
    loading: state !== '' && !current,
    retry,
  }
}
