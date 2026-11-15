import { ApiError, apiGet } from '@/services/catalog'
import type { CalculatedRoute, Coordinates } from '@/types'

/** Sugestão de endereço do autocomplete (`GET /api/rotas/origem/busca/`). */
export interface EnderecoSugerido extends Coordinates {
  rotulo: string
}

/** Resposta de `GET /api/rotas/eventos/<id>/`; `rotas` vem vazia quando não há caminho. */
export interface RotaEvento {
  modo: 'carro' | 'a_pe'
  destino: Coordinates
  rotas: CalculatedRoute[]
}

/** Tamanho mínimo do texto aceito pela busca de endereços. */
export const MINIMO_BUSCA = 3
/** Tamanho máximo do texto aceito pela busca de endereços. */
export const MAXIMO_BUSCA = 200

/** Status 0: a requisição nem chegou ao backend (sem rede ou servidor fora do ar). */
export const SEM_CONEXAO = 0

const SEM_CONEXAO_MENSAGEM = 'Não foi possível conectar ao CultHub. Verifique sua conexão e tente de novo.'
const LIMITE_MENSAGEM = 'Muitas consultas seguidas. Aguarde um instante e tente de novo.'

/** Mensagem para a pessoa a partir do status e do detalhe do backend. */
type Describe = (status: number, detail: string | null) => string

const descreverEndereco: Describe = (status, detail) => {
  if (status === 429) return LIMITE_MENSAGEM
  if (status === 502) {
    return 'O serviço de endereços está indisponível agora. Use sua localização ou marque o ponto no mapa.'
  }
  return detail ?? 'Não foi possível consultar o endereço.'
}

// 400 (partida longe demais), 404, 422 e 502 já vêm com `detail` pronto para mostrar.
// O 429 tem mensagem própria: o `detail` dele é a tradução padrão do DRF.
const descreverRota: Describe = (status, detail) => {
  if (status === 429) return LIMITE_MENSAGEM
  return detail ?? 'Não foi possível calcular a rota.'
}

async function get<T>(
  path: string,
  params: URLSearchParams,
  describe: Describe,
  signal?: AbortSignal,
): Promise<T> {
  try {
    return await apiGet<T>(`/rotas${path}?${params.toString()}`, { signal, describe })
  } catch (error) {
    // Abortos seguem como estão; outras falhas do fetch (ex.: "Failed to fetch") viram ApiError.
    if (error instanceof ApiError || signal?.aborted) throw error
    throw new ApiError(SEM_CONEXAO_MENSAGEM, SEM_CONEXAO)
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
    const { resultados } = await get<{ resultados: EnderecoSugerido[] }>(
      '/origem/busca/',
      params,
      descreverEndereco,
      signal,
    )
    return resultados
  },

  /** Endereço legível de um ponto; `null` quando não há (por exemplo, no mar). */
  reversa: async (ponto: Coordinates, signal?: AbortSignal) => {
    const { rotulo } = await get<{ rotulo: string | null }>(
      '/origem/reversa/',
      new URLSearchParams(coordenada(ponto)),
      descreverEndereco,
      signal,
    )
    return rotulo
  },

  /** Rotas da partida até o local do evento (o destino vem do backend); a primeira é a recomendada. */
  rotaEvento: (eventId: string, partida: Coordinates, modo: 'carro' | 'a_pe', signal?: AbortSignal) =>
    get<RotaEvento>(
      `/eventos/${encodeURIComponent(eventId)}/`,
      new URLSearchParams([...coordenada(partida), ['modo', modo]]),
      descreverRota,
      signal,
    ),
}
