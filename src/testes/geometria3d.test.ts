/** As contas da mercadoria na cena 3D — PLANO-ESTOQUE-3D.md. */

import { describe, expect, it } from 'vitest'
import { MEDIDAS } from '@shared/enderecos'
import { formaDa, repartir, tetoDa, unidadesDaPosicao } from '@/estoque3d/geometria'

describe('repartir a posição entre os produtos', () => {
  it('com folga, cada unidade é uma caixa', () => {
    expect(repartir([{ produtoId: 'a', quantidade: 2 }, { produtoId: 'b', quantidade: 1.4 }], 6)).toEqual([{ produtoId: 'a', unidades: 2 }, { produtoId: 'b', unidades: 2 }])
  })
  it('acima do teto, ninguém passa dele e todo produto aparece', () => {
    const r = repartir([{ produtoId: 'muito', quantidade: 300 }, { produtoId: 'pouco', quantidade: 1 }, { produtoId: 'medio', quantidade: 40 }], 7)
    expect(r.reduce((s, p) => s + p.unidades, 0)).toBeLessThanOrEqual(7)
    expect(r.every((p) => p.unidades >= 1)).toBe(true)
    expect(r.find((p) => p.produtoId === 'muito')!.unidades).toBeGreaterThan(r.find((p) => p.produtoId === 'pouco')!.unidades)
  })
  it('produto zerado não aparece', () => {
    expect(repartir([{ produtoId: 'a', quantidade: 0 }], 6)).toEqual([])
  })
})

describe('as unidades de uma posição', () => {
  it('cabem no vão e na altura do nível, em todo tema e tipo', () => {
    for (const tema of ['loja_fofa', 'armazem', 'shopping'] as const) {
      for (const tipo of ['estante', 'expositor', 'vitrine', 'mesa', 'balcao'] as const) {
        const m = MEDIDAS[tipo]
        const u = unidadesDaPosicao(tema, tipo, [{ produtoId: 'a', quantidade: 999 }])
        expect(u.length, `${tema}/${tipo}`).toBe(tetoDa(formaDa(tema, tipo)))
        for (const x of u) {
          expect(Math.abs(x.x) + x.largura / 2, `${tema}/${tipo} largura`).toBeLessThanOrEqual(m.vao / 2)
          expect(Math.abs(x.z) + x.profundidade / 2, `${tema}/${tipo} fundo`).toBeLessThanOrEqual(m.profundidade / 2)
          expect(x.y - x.altura / 2, `${tema}/${tipo} chão`).toBeGreaterThanOrEqual(0)
          expect(x.y + x.altura / 2, `${tema}/${tipo} teto`).toBeLessThanOrEqual(m.nivel + 0.001)
        }
      }
    }
  })
  it('cada produto fica em colunas próprias', () => {
    const u = unidadesDaPosicao('armazem', 'estante', [{ produtoId: 'a', quantidade: 2 }, { produtoId: 'b', quantidade: 2 }])
    const xa = new Set(u.filter((x) => x.produtoId === 'a').map((x) => x.x.toFixed(3)))
    const xb = new Set(u.filter((x) => x.produtoId === 'b').map((x) => x.x.toFixed(3)))
    expect([...xa].some((x) => xb.has(x))).toBe(false)
  })
})
