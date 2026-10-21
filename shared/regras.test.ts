/**
 * As regras puras do estoque, das etiquetas e da ajuda — as partes do
 * `release.test.ts` do mock que não precisam de banco. O que precisa (venda
 * atômica, idempotência, isolamento) está nos `verify:*` do backend.
 */

import { describe, expect, it } from 'vitest'
import { buscarNaAjuda, ARTIGOS_DE_AJUDA } from './ajuda.js'
import { conferirQuantidade, mudancaDeSaldo } from './estoque.js'
import { MODELOS_DE_FABRICA, aplicarDeslocamento, layoutDeEtiquetaSchema, pedidoDeEtiquetasSchema } from './etiquetas.js'

describe('o custo médio do estoque', () => {
  it('a entrada recalcula a média ponderada', () => {
    const primeira = mudancaDeSaldo({ quantidade: '0', valorEmEstoque: '0' }, '10', '5')
    expect(primeira).toMatchObject({ quantidade: '10.000000', valorEmEstoque: '50.00000000' })
    const segunda = mudancaDeSaldo({ quantidade: primeira.quantidade, valorEmEstoque: primeira.valorEmEstoque }, '10', '7')
    expect(segunda.valorEmEstoque).toBe('120.00000000')
  })
  it('a saída usa a média de antes', () => {
    const saida = mudancaDeSaldo({ quantidade: '20', valorEmEstoque: '120' }, '-5', '999')
    expect(saida.custoUnitario).toBe('6.00000000')
    expect(saida.valorEmEstoque).toBe('90.00000000')
  })
  it('zerar o saldo zera o valor, sem resto de centavo', () => {
    expect(mudancaDeSaldo({ quantidade: '3', valorEmEstoque: '10' }, '-3', '0').valorEmEstoque).toBe('0.00000000')
  })
  it('saldo negativo é recusado', () => {
    expect(() => mudancaDeSaldo({ quantidade: '1', valorEmEstoque: '5' }, '-2', '0')).toThrow(/supera o estoque/)
  })
  it('unidade contável só aceita inteiro; peso aceita fração', () => {
    expect(() => conferirQuantidade('unidade', '1.5')).toThrow()
    expect(() => conferirQuantidade('kg', '1.5')).not.toThrow()
  })
})

describe('os modelos de etiqueta', () => {
  it('os de fábrica cabem na folha', () => {
    for (const m of MODELOS_DE_FABRICA) expect(() => layoutDeEtiquetaSchema.parse(m.layout)).not.toThrow()
  })
  it('modelo que passa da folha é recusado', () => {
    expect(() => layoutDeEtiquetaSchema.parse({ ...MODELOS_DE_FABRICA[0]!.layout, colunas: 4 })).toThrow(/ultrapassam a folha/)
  })
  it('o deslocamento entra nas margens e continua conferido', () => {
    expect(aplicarDeslocamento(MODELOS_DE_FABRICA[0]!.layout, 1, -1).margemEsquerda).toBeCloseTo(8.25)
    /* a folha de 65 usa 205,25 mm de largura: mais 5 mm passa dos 210 */
    expect(() => aplicarDeslocamento(MODELOS_DE_FABRICA[1]!.layout, 5, 0)).toThrow()
  })
  it('até 500 etiquetas e cada produto uma vez', () => {
    const chave = '00000000-0000-4000-8000-000000000000'
    expect(() => pedidoDeEtiquetasSchema.parse({ chaveDaOperacao: chave, modeloId: 'a4-21', itens: [{ produtoId: 'a', copias: 300 }, { produtoId: 'b', copias: 201 }] })).toThrow()
    expect(() => pedidoDeEtiquetasSchema.parse({ chaveDaOperacao: chave, modeloId: 'a4-21', itens: [{ produtoId: 'a', copias: 1 }, { produtoId: 'a', copias: 1 }] })).toThrow()
  })
})

describe('a busca da ajuda', () => {
  it('tem os 28 artigos', () => expect(ARTIGOS_DE_AJUDA).toHaveLength(28))
  it('ignora acento e caixa', () => {
    expect(buscarNaAjuda('COMISSAO').length).toBeGreaterThan(0)
    expect(buscarNaAjuda('comissão').map((a) => a.id)).toEqual(buscarNaAjuda('comissao').map((a) => a.id))
  })
  it('exige todas as palavras', () => {
    expect(buscarNaAjuda('imprimir etiqueta').every((a) => a.categoria === 'Etiquetas')).toBe(true)
  })
  it('filtra pela categoria', () => {
    expect(buscarNaAjuda('', 'Estoque e vendas').every((a) => a.categoria === 'Estoque e vendas')).toBe(true)
  })
})
