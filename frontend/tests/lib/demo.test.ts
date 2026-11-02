import { describe, expect, it, vi } from 'vitest'
import { logDemoAction } from '@/lib/demo'

describe('logDemoAction', () => {
  it('registra a ação e os detalhes no console', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    logDemoAction('Compartilhar evento', { eventId: 'sp-jazz' })
    expect(info).toHaveBeenCalledWith('[CultHub demo] Compartilhar evento', { eventId: 'sp-jazz' })
    info.mockRestore()
  })
})
