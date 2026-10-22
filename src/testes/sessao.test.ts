/**
 * MOD-24-F05 — contrato da sessão do painel no navegador.
 *
 * O token não pode voltar ao `localStorage` nem ao cabeçalho. O único valor
 * legível pelo JavaScript é a prova de origem, devolvida junto da preferência
 * de espaço de trabalho — e o `x-aplicativo`, que diz ao Núcleo de que app são
 * os espaços desta tela (os espaços são por app desde 21/10/2026).
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('sessão do painel', () => {
  it('manda a prova de origem, nunca Authorization', async () => {
    const remover = vi.fn()
    vi.stubGlobal('localStorage', {
      getItem: (chave: string) => chave === 'lucro.espaco' ? 'ws_principal' : 'token-antigo',
      setItem: vi.fn(),
      removeItem: remover,
    })
    vi.stubGlobal('document', { cookie: 'tema=claro; mzn_csrf=prova%20segura' })

    const { cabecalhosDeSessao } = await import('@/lib/sessao')
    const cabecalhos = cabecalhosDeSessao()

    expect(cabecalhos).toEqual({
      'x-aplicativo': 'lucro',
      'x-csrf-token': 'prova segura',
      'x-workspace-id': 'ws_principal',
    })
    expect(cabecalhos).not.toHaveProperty('Authorization')
  })

  it('não inventa prova de origem quando o cookie não existe', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
    vi.stubGlobal('document', { cookie: 'tema=claro' })

    const { cabecalhosDeSessao } = await import('@/lib/sessao')

    expect(cabecalhosDeSessao()).toEqual({ 'x-aplicativo': 'lucro' })
  })
})

describe('revogação da sessão', () => {
  it('aguarda o servidor antes de esquecer o usuário', async () => {
    let concluir!: (resposta: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { concluir = resolve })))
    const { useSessao } = await import('@/lib/sessao')
    const retrato = { usuario: { id: 'pessoa' } } as any
    useSessao.setState({ retrato })
    const saida = useSessao.getState().sair()
    expect(useSessao.getState().retrato).toBe(retrato)
    concluir(new Response('{}', { status: 200 }))
    await saida
    expect(useSessao.getState().retrato).toBeNull()
  })
  it('mantém a sessão local e informa falha quando não revogou', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sem rede')))
    const { useSessao } = await import('@/lib/sessao')
    const retrato = { usuario: { id: 'pessoa' } } as any
    useSessao.setState({ retrato })
    await expect(useSessao.getState().sair()).rejects.toThrow('sem rede')
    expect(useSessao.getState().retrato).toBe(retrato)
  })
})
