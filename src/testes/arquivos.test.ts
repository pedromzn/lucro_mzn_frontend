/** Arquivos autenticados levam o espaço selecionado — PLANO-LUCRO-CERTO, D2. */
import { afterEach, expect, it, vi } from 'vitest'
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })
it('envia o espaço em fotos e em todos os downloads', async () => {
  vi.stubGlobal('localStorage', { getItem: () => 'ws_loja_b' })
  const buscar = vi.fn().mockImplementation(() => Promise.resolve(new Response('arquivo')))
  vi.stubGlobal('fetch', buscar)
  const { arquivo, enderecos } = await import('@/lib/api')
  const caminhos = [enderecos.imagem('foto'), ...(['csv', 'xlsx', 'pdf', 'json'] as const).map(enderecos.exportar), enderecos.modeloDeImportacao, enderecos.estoqueEmCsv]
  for (const caminho of caminhos) await arquivo(caminho)
  expect(buscar).toHaveBeenCalledTimes(7)
  for (const [url, opcoes] of buscar.mock.calls) {
    expect(url).toMatch(/^\/api\//)
    expect(opcoes.headers['x-workspace-id']).toBe('ws_loja_b')
    expect(opcoes.headers['x-aplicativo']).toBe('lucro')
  }
})
