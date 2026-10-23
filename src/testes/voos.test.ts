/** A mercadoria andando na cena — PLANO-ESTOQUE-3D.md, fatia 4. */

import { describe, expect, it } from 'vitest'
import { voosDaDiferenca, type Lugares } from '@/estoque3d/voos'

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
