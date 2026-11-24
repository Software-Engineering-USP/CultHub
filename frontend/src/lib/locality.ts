/** "Cidade, UF"; só a cidade ou só a UF quando falta a outra; "" sem nenhuma. */
export function formatLocality(city: string, state: string): string {
  return [city, state].filter(Boolean).join(', ')
}

/** Nome para comparar sem caixa, acento, tipo de apóstrofo nem espaço repetido. */
export function normalizePlaceName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

/** Cidades da lista que combinam com o texto: as que começam com ele primeiro. */
export function matchCities(cities: string[], query: string, limit: number): string[] {
  const term = normalizePlaceName(query)
  if (!term) return []
  const starts: string[] = []
  const contains: string[] = []
  for (const city of cities) {
    const name = normalizePlaceName(city)
    if (name.startsWith(term)) starts.push(city)
    else if (name.includes(term)) contains.push(city)
  }
  return [...starts, ...contains].slice(0, limit)
}

/** A cidade da lista com esse nome (nome oficial), ou undefined. */
export function findCity(cities: string[], name: string): string | undefined {
  const term = normalizePlaceName(name)
  return cities.find((city) => normalizePlaceName(city) === term)
}
