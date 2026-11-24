import { useCallback, useEffect, useState } from 'react'
import { api } from '@/services/api'
import type { ApiState } from '@/services/api'

// A lista do IBGE só muda com uma nova versão do backend: cada consulta é feita uma vez por sessão.
let statesRequest: Promise<ApiState[]> | undefined
const citiesRequests = new Map<string, Promise<string[]>>()

function loadStates() {
  statesRequest ??= api.localities.states().catch((error: unknown) => {
    statesRequest = undefined
    throw error
  })
  return statesRequest
}

function loadCities(state: string) {
  let request = citiesRequests.get(state)
  if (!request) {
    request = api.localities.cities(state).catch((error: unknown) => {
      citiesRequests.delete(state)
      throw error
    })
    citiesRequests.set(state, request)
  }
  return request
}

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

/** As 27 UFs. */
export function useStates() {
  const [state, setState] = useState<{ states: ApiState[]; error: string | null }>({
    states: [],
    error: null,
  })

  useEffect(() => {
    let active = true
    loadStates()
      .then((states) => {
        if (active) setState({ states, error: null })
      })
      .catch((error: unknown) => {
        if (active) setState({ states: [], error: message(error, 'Não foi possível carregar os estados.') })
      })
    return () => {
      active = false
    }
  }, [])

  return state
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
