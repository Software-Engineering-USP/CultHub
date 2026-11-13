import { useEffect, useState } from 'react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { ApiError } from '@/services/catalog'
import { MAXIMO_BUSCA, MINIMO_BUSCA, rotasApi } from '@/services/rotas'
import type { EnderecoSugerido } from '@/services/rotas'
import type { Coordinates } from '@/types'

/** Espera a pessoa parar de digitar antes de consultar (o Photon público pede uso razoável). */
export const ESPERA_DIGITACAO_MS = 400

interface Resposta {
  /** Consulta a que esta resposta se refere (ver `chaveDe`) */
  chave: string
  resultados: EnderecoSugerido[]
  error: string | null
}

function buscavel(texto: string) {
  return texto.length >= MINIMO_BUSCA && texto.length <= MAXIMO_BUSCA
}

function chaveDe(texto: string, latitude?: number, longitude?: number) {
  return `${texto}|${latitude ?? ''}|${longitude ?? ''}`
}

/**
 * Sugestões de endereço para o texto digitado.
 * Só consulta com `ativo` e de 3 a 200 caracteres; `perto` (o local do evento) puxa os
 * resultados para perto dele.
 */
export function useOrigemBusca(
  texto: string,
  { perto, ativo = true }: { perto?: Coordinates; ativo?: boolean } = {},
) {
  const digitado = ativo ? texto.trim() : ''
  const consulta = useDebouncedValue(digitado, ESPERA_DIGITACAO_MS)
  const latitude = perto?.latitude
  const longitude = perto?.longitude
  const [resposta, setResposta] = useState<Resposta>({ chave: '', resultados: [], error: null })

  useEffect(() => {
    if (!buscavel(consulta)) return
    const chave = chaveDe(consulta, latitude, longitude)
    const controller = new AbortController()
    const ponto = latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined
    rotasApi
      .buscarOrigem(consulta, ponto, controller.signal)
      .then((resultados) => setResposta({ chave, resultados, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setResposta({
          chave,
          resultados: [],
          error: error instanceof ApiError ? error.message : 'Não foi possível buscar o endereço.',
        })
      })
    return () => controller.abort()
  }, [consulta, latitude, longitude])

  // Só há respostas para textos buscáveis, então isto também cobre o texto curto e a espera do debounce.
  const atual = resposta.chave === chaveDe(digitado, latitude, longitude)
  return {
    resultados: atual ? resposta.resultados : [],
    error: atual ? resposta.error : null,
    /** Há texto suficiente e a resposta para ele ainda não chegou */
    loading: buscavel(digitado) && !atual,
    /** A resposta corresponde ao texto atual */
    pronto: atual,
  }
}
