/** A mercadoria andando na cena — PLANO-ESTOQUE-3D.md, fatia 4. */

import { describe, expect, it } from 'vitest'
import { voosDaDiferenca, voosDoMovimento, type Lugares } from '@/estoque3d/voos'
import type { MovimentoNoMapa } from '@/lib/api'

const lugares: Lugares = {
  posicao: (e) => ({ x: e.estruturaId === 'loja' ? 5 : -5, y: e.nivel, z: e.vao }),
  chao: { x: 0, y: 0, z: -9 },
  entrada: { x: 0, y: 0, z: -10 },
  saida: { x: 0, y: 0, z: 10 },
}
const pos = (estruturaId: string, quantidade: string) => ({ estruturaId, nivel: 0, vao: 0, produtoId: 'p', quantidade })

describe('a diferença entre dois mapas', () => {
  it('mover da prateleira para a loja é um voo de uma para a outra', () => {
    const v = voosDaDiferenca(
      { posicoes: [pos('dep', '5')], produtos: [{ id: 'p', aGuardar: '0' }] },
      { posicoes: [pos('dep', '3'), pos('loja', '2')], produtos: [{ id: 'p', aGuardar: '0' }] },
      lugares,
    )
    expect(v).toHaveLength(1)
    expect(v[0]!.de.x).toBe(-5)
    expect(v[0]!.para.x).toBe(5)
    expect(v[0]!.unidades).toBe(2)
  })
  it('vender sai pela expedição; receber chega pela doca e cai no chão', () => {
    const vendeu = voosDaDiferenca({ posicoes: [pos('loja', '4')], produtos: [{ id: 'p', aGuardar: '0' }] }, { posicoes: [pos('loja', '1')], produtos: [{ id: 'p', aGuardar: '0' }] }, lugares)
    expect(vendeu[0]!.para).toEqual(lugares.saida)
    const chegou = voosDaDiferenca({ posicoes: [], produtos: [{ id: 'p', aGuardar: '0' }] }, { posicoes: [], produtos: [{ id: 'p', aGuardar: '10' }] }, lugares)
    expect(chegou[0]!.de).toEqual(lugares.entrada)
    expect(chegou[0]!.para).toEqual(lugares.chao)
    expect(chegou[0]!.unidades).toBe(3)
  })
  it('nada mudou, nada voa', () => {
    const r = { posicoes: [pos('dep', '5')], produtos: [{ id: 'p', aGuardar: '1' }] }
    expect(voosDaDiferenca(r, r, lugares)).toEqual([])
  })
})

describe('o replay de um movimento', () => {
  const mov = (tipo: string, quantidade: string, linhas: MovimentoNoMapa['linhas']): MovimentoNoMapa => ({ id: 'm', tipo, produtoId: 'p', quantidade, criadoEm: '', linhas })
  const linha = (estruturaId: string, quantidade: string) => ({ estruturaId, nivel: 0, vao: 0, quantidade, rotulo: estruturaId })

  it('guardar: do chão para a prateleira', () => {
    const v = voosDoMovimento(mov('transferencia', '0', [linha('dep', '4')]), lugares)
    expect(v.map((x) => [x.de, x.para])).toEqual([[lugares.chao, { x: -5, y: 0, z: 0 }]])
  })
  it('venda de 3 com 2 na loja: 2 saem da loja e 1 do chão, os dois para a expedição', () => {
    const v = voosDoMovimento(mov('venda', '-3', [linha('loja', '-2')]), lugares)
    expect(v.map((x) => x.de.x).sort()).toEqual([0, 5])
    expect(v.every((x) => x.para === lugares.saida)).toBe(true)
  })
  it('devolução volta pelo caixa e fica a guardar', () => {
    const v = voosDoMovimento(mov('devolucao', '2', []), lugares, 500)
    expect(v).toEqual([{ produtoId: 'p', de: lugares.saida, para: lugares.chao, unidades: 2, atraso: 500 }])
  })
})
