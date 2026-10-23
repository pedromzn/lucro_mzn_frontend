/** A paginação é a do MKT — os mesmos tamanhos e a mesma recusa do lixo guardado. */
import { describe, expect, it } from 'vitest'
import { OPCOES_POR_PAGINA, porPaginaValido } from '@/components/Paginacao'

describe('paginação das tabelas', () => {
  it('oferece 10, 50, 100, 200 e 500 — e nada acima do teto do servidor', () => {
    expect([...OPCOES_POR_PAGINA]).toEqual([10, 50, 100, 200, 500])
  })
  it('só aceita um valor da lista; lixo guardado no navegador vira o padrão', () => {
    expect(porPaginaValido('200', 50)).toBe(200)
    expect(porPaginaValido('1000', 50)).toBe(50)
    expect(porPaginaValido(null, 50)).toBe(50)
    expect(porPaginaValido('abc', 10)).toBe(10)
  })
})

describe('a peça não quebra a tela', () => {
  it('sem total (API antiga no ar) não desenha nada, em vez de lançar', async () => {
    const { createElement } = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { Paginacao } = await import('@/components/Paginacao')
    const desenhar = (total: unknown) => renderToStaticMarkup(createElement(Paginacao, {
      pagina: 1, porPagina: 50, total: total as number, aoMudarPagina: () => undefined, aoMudarPorPagina: () => undefined,
    }))
    expect(desenhar(undefined)).toBe('')
    expect(desenhar(65)).toContain('1–50 de 65')
  })
})
