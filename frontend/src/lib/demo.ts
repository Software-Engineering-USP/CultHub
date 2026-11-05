/**
 * Registra no console uma ação que ainda só existe na demonstração e não depende do backend
 * (pedir localização, compartilhar, abrir o app de mapas...).
 */
export function logDemoAction(action: string, details?: Record<string, unknown>): void {
  console.info(`[CultHub demo] ${action}`, details ?? '')
}
