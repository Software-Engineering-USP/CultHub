import { ApiError, apiGet } from '@/services/catalog'
import type { Coordinates } from '@/types'

/** Sugestão de endereço do autocomplete (`GET /api/rotas/origem/busca/`). */
export interface EnderecoSugerido extends Coordinates {
  rotulo: string
}

/** Tamanho mínimo do texto aceito pela busca de endereços. */
export const MINIMO_BUSCA = 3
/** Tamanho máximo do texto aceito pela busca de endereços. */
export const MAXIMO_BUSCA = 200

/** Status 0: a requisição nem chegou ao backend (sem rede ou servidor fora do ar). */
export const SEM_CONEXAO = 0

const mensagens: Record<number, string> = {
  [SEM_CONEXAO]: 'Não foi possível conectar ao CultHub. Verifique sua conexão e tente de novo.',
  429: 'Muitas consultas seguidas. Aguarde um instante e tente de novo.',
  502: 'O serviço de endereços está indisponível agora. Use sua localização ou marque o ponto no mapa.',
}

async function get<T>(path: string, params: URLSearchParams, signal?: AbortSignal): Promise<T> {
  try {
    return await apiGet<T>(`/rotas${path}?${params.toString()}`, {
      signal,
      describe: (status, detail) => mensagens[status] ?? detail ?? 'Não foi possível consultar o endereço.',
    })
  } catch (error) {
    // Abortos seguem como estão; outras falhas do fetch (ex.: "Failed to fetch") viram ApiError.
    if (error instanceof ApiError || signal?.aborted) throw error
    throw new ApiError(mensagens[SEM_CONEXAO], SEM_CONEXAO)
  }
}

function coordenada({ latitude, longitude }: Coordinates): [string, string][] {
  return [
    ['latitude', String(latitude)],
    ['longitude', String(longitude)],
  ]
}

export const rotasApi = {
  /** Autocomplete do endereço de partida; `perto` só puxa os resultados para perto desse ponto. */
  buscarOrigem: async (texto: string, perto?: Coordinates, signal?: AbortSignal) => {
    const params = new URLSearchParams([['q', texto.trim()], ...(perto ? coordenada(perto) : [])])
    const { resultados } = await get<{ resultados: EnderecoSugerido[] }>('/origem/busca/', params, signal)
    return resultados
  },

  /** Endereço legível de um ponto; `null` quando não há (por exemplo, no mar). */
  reversa: async (ponto: Coordinates, signal?: AbortSignal) => {
    const { rotulo } = await get<{ rotulo: string | null }>(
      '/origem/reversa/',
      new URLSearchParams(coordenada(ponto)),
      signal,
    )
    return rotulo
  },
}
