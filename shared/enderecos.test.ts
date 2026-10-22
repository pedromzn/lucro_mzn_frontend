/** As regras do estoque com endereço — PLANO-ESTOQUE-3D.md, fatia 1. */

import { describe, expect, it } from 'vitest'
import {
  MEDIDAS, TEMAS, centroDaPosicao, conferirEstrutura, lugarLivre, planoDeSaida, plantaPadrao, retanguloDa, sobrepoe, sugerirGuarda,
  type Estrutura, type PosicaoComSaldo,
} from './enderecos.js'

describe('as plantas prontas', () => {
  for (const tema of TEMAS) {
    for (const categorias of [1, 4, 12]) {
      it(`${tema} com ${categorias} categoria(s): tudo cabe e nada se sobrepõe`, () => {
        const { ambiente, estruturas } = plantaPadrao(tema, categorias)
        expect(ambiente.tema).toBe(tema)
        for (const e of estruturas) expect(conferirEstrutura(e, ambiente), e.nome).toBeNull()
        for (let i = 0; i < estruturas.length; i++) {
          for (let j = i + 1; j < estruturas.length; j++) {
            expect(sobrepoe(retanguloDa(estruturas[i]!), retanguloDa(estruturas[j]!)), `${estruturas[i]!.nome} × ${estruturas[j]!.nome}`).toBe(false)
          }
        }
        expect(estruturas.some((e) => e.zona === 'deposito')).toBe(true)
        expect(estruturas.some((e) => e.zona === 'recebimento')).toBe(true)
      })
    }
  }

  it('mais categorias dão mais estrutura de exposição', () => {
    const conta = (n: number) => plantaPadrao('loja_fofa', n).estruturas.filter((e) => e.tipo === 'expositor').length
    expect(conta(10)).toBeGreaterThan(conta(1))
  })
})

describe('a pegada e o centro', () => {
  const base = { tipo: 'estante' as const, x: 2, z: -1, vaos: 3 }
  it('girar 90° troca largura e profundidade', () => {
    const reta = retanguloDa({ ...base, rotacao: 0 })
    const deitada = retanguloDa({ ...base, rotacao: 90 })
    expect(reta.x1 - reta.x0).toBeCloseTo(3 * MEDIDAS.estante.vao)
    expect(deitada.z1 - deitada.z0).toBeCloseTo(3 * MEDIDAS.estante.vao)
  })
  it('o vão do meio fica no centro da estrutura, e o nível sobe pela altura do tipo', () => {
    const c = centroDaPosicao({ ...base, rotacao: 0 }, 2, 1)
    expect(c.x).toBeCloseTo(2)
    expect(c.z).toBeCloseTo(-1)
    expect(c.y).toBeCloseTo(MEDIDAS.estante.base + 2 * MEDIDAS.estante.nivel)
  })
  it('recusa nível fora do tipo e estrutura fora do espaço', () => {
    const amb = { largura: 10, profundidade: 8 }
    expect(conferirEstrutura({ ...base, zona: 'deposito', nome: 'E', rotacao: 0, niveis: 9 }, amb)).toMatch(/nível/)
    expect(conferirEstrutura({ ...base, zona: 'deposito', nome: 'E', rotacao: 0, niveis: 2, x: 4.8 }, amb)).toMatch(/sai do espaço/)
  })
})

describe('de onde sai uma saída', () => {
  const pos = (estruturaId: string, zona: PosicaoComSaldo['zona'], quantidade: string): PosicaoComSaldo => ({ estruturaId, nivel: 0, vao: 0, zona, quantidade })
  const posicoes = [pos('dep', 'deposito', '10'), pos('loja-cheia', 'loja', '5'), pos('loja-pouca', 'loja', '2')]

  it('venda: a loja primeiro, a posição com menos antes, depois o a guardar, por último o depósito', () => {
    const plano = planoDeSaida({ posicoes, aGuardar: '3', quantidade: '11' })
    expect(plano.map((l) => [l.endereco?.estruturaId ?? 'chão', l.quantidade])).toEqual([
      ['loja-pouca', '2.000000'], ['loja-cheia', '5.000000'], ['chão', '3.000000'], ['dep', '1.000000'],
    ])
  })
  it('ajuste: o a guardar primeiro, que é o que ninguém conferiu', () => {
    expect(planoDeSaida({ posicoes, aGuardar: '3', quantidade: '2', ordem: 'ajuste' })).toEqual([{ endereco: null, quantidade: '2.000000' }])
  })
  it('com posição escolhida, sai só dali — e recusa se ali não houver o bastante', () => {
    const escolhido = { estruturaId: 'dep', nivel: 0, vao: 0 }
    expect(planoDeSaida({ posicoes, aGuardar: '0', quantidade: '4', escolhido })).toEqual([{ endereco: escolhido, quantidade: '4.000000' }])
    expect(() => planoDeSaida({ posicoes, aGuardar: '100', quantidade: '11', escolhido })).toThrow(/nesta posição/)
  })
  it('recusa tirar mais do que existe', () => {
    expect(() => planoDeSaida({ posicoes, aGuardar: '0', quantidade: '18' })).toThrow(/supera/)
  })
})

describe('onde guardar o que chegou', () => {
  const estruturas: Estrutura[] = [
    { id: 'rec', tipo: 'mesa', zona: 'recebimento', nome: 'Chegada', x: 4, z: -3, rotacao: 0, niveis: 1, vaos: 1 },
    { id: 'dep', tipo: 'estante', zona: 'deposito', nome: 'Prateleira', x: 2, z: -3.5, rotacao: 0, niveis: 2, vaos: 2 },
    { id: 'cx', tipo: 'balcao', zona: 'expedicao', nome: 'Caixa', x: 4, z: 3, rotacao: 0, niveis: 1, vaos: 1 },
  ]
  it('onde já está o mesmo produto vem primeiro', () => {
    const s = sugerirGuarda({ produtoId: 'p1', categoria: 'Blusas', estruturas, ocupacao: [{ estruturaId: 'dep', nivel: 1, vao: 1, produtoId: 'p1', categoria: 'Blusas', quantidade: '3' }] })
    expect(s[0]!.endereco).toEqual({ estruturaId: 'dep', nivel: 1, vao: 1 })
    expect(s[0]!.motivo).toMatch(/Já guarda/)
  })
  it('sem o produto: vazia, no depósito, embaixo — e nunca no balcão do caixa', () => {
    const s = sugerirGuarda({ produtoId: 'p2', categoria: 'Blusas', estruturas, ocupacao: [], limite: 20 })
    expect(s[0]!.endereco.estruturaId).toBe('dep')
    expect(s[0]!.endereco.nivel).toBe(0)
    expect(s.some((x) => x.endereco.estruturaId === 'cx')).toBe(false)
  })
  it('a posição com outro produto fica para o fim', () => {
    const ocupacao = [0, 1].flatMap((nivel) => [0, 1].map((vao) => ({ estruturaId: 'dep', nivel, vao, produtoId: 'outro', categoria: 'Calças', quantidade: '1' })))
    const s = sugerirGuarda({ produtoId: 'p2', categoria: 'Blusas', estruturas, ocupacao })
    expect(s[0]!.endereco.estruturaId).toBe('rec')
  })
})

describe('a vaga para uma estrutura nova', () => {
  const nova = { tipo: 'estante' as const, zona: 'deposito' as const, nome: 'Nova', rotacao: 0 as const, niveis: 2, vaos: 2 }
  it('no espaço vazio, vai para o centro', () => {
    expect(lugarLivre(nova, [], { largura: 10, profundidade: 8 })).toEqual({ x: 0, z: 0 })
  })
  it('numa planta pronta, acha uma vaga que cabe e não bate em nada', () => {
    const { ambiente, estruturas } = plantaPadrao('loja_fofa', 4)
    const vaga = lugarLivre(nova, estruturas, ambiente)!
    expect(vaga).not.toBeNull()
    const r = retanguloDa({ ...nova, ...vaga })
    expect(conferirEstrutura({ ...nova, ...vaga }, ambiente)).toBeNull()
    expect(estruturas.some((e) => sobrepoe(r, retanguloDa(e)))).toBe(false)
  })
  it('nasce perto das estruturas da mesma zona', () => {
    const { ambiente, estruturas } = plantaPadrao('loja_fofa', 4)
    const vaga = lugarLivre(nova, estruturas, ambiente)!
    const deposito = estruturas.filter((e) => e.zona === 'deposito')
    const zMedio = deposito.reduce((s, e) => s + e.z, 0) / deposito.length
    expect(Math.abs(vaga.z - zMedio)).toBeLessThan(ambiente.profundidade / 2)
    expect(vaga.z).toBeLessThan(0)
  })
  it('espaço cheio: não há vaga', () => {
    const cheia = { ...nova, vaos: 12 }
    expect(lugarLivre(cheia, [], { largura: 6, profundidade: 6 })).toBeNull()
  })
})
