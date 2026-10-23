/** Fluxo e colisões da Assistente — PLANO-ESTOQUE-3D.md, evolução 6. */
import { describe, expect, it } from 'vitest'
import { centroDaPosicao, plantaPadrao, type Estrutura, type Tema } from '@shared/enderecos'
import { criarNavegacao, descansoDaAssistente, portaDaRua, retiradaNaRua, comprimentoDoCaminho, percorrerCaminho } from '@/estoque3d/caminhos'
import { planejarTarefa } from '@/estoque3d/tarefas'

const ambiente = { largura: 12, profundidade: 10 }
const estante = (x: number, z: number): Estrutura => ({ id: `${x}:${z}`, nome: 'Estante', tipo: 'estante', zona: 'deposito', x, z, rotacao: 0, niveis: 4, vaos: 3 })
describe('os caminhos de trabalho', () => {
  for (const tema of ['loja_fofa', 'armazem', 'shopping'] as Tema[]) {
    it.each([1, 5, 12])(`alcança as posições da planta ${tema} com %i categorias sem atravessar estruturas`, (categorias) => {
      const planta = plantaPadrao(tema, categorias)
      const estruturas = planta.estruturas.map((e, i) => ({ ...e, id: String(i) }))
      const nav = criarNavegacao(planta.ambiente, estruturas, tema)
      for (const e of estruturas) for (let vao = 0; vao < e.vaos; vao++) {
        const caminho = nav.caminho(descansoDaAssistente(planta.ambiente), centroDaPosicao(e, 0, vao))
        expect(caminho, `${e.nome}, vão ${vao}`).not.toBeNull()
        for (let i = 1; i < caminho!.length; i++) expect(nav.segmentoLivre(caminho![i - 1]!, caminho![i]!)).toBe(true)
      }
    })
  }
  it('desvia da estante entre origem e destino', () => {
    const nav = criarNavegacao(ambiente, [estante(0, 0)])
    const caminho = nav.caminho({ x: 0, y: 0, z: -2 }, { x: 0, y: 0, z: 2 })!
    expect(comprimentoDoCaminho(caminho)).toBeGreaterThan(4.5)
    expect(caminho.some(p => Math.abs(p.x) > 1.5)).toBe(true)
    expect(percorrerCaminho(caminho, 1000).ponto).toEqual(caminho.at(-1))
  })
  it('não atravessa uma barreira sem passagem', () => {
    const parede = { ...estante(0, 0), vaos: 12 }
    const nav = criarNavegacao(ambiente, [parede])
    expect(nav.caminho({ x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: -3 })).toBeNull()
  })
  it('uma planta alterada libera o trajeto que estava bloqueado', () => {
    const origem = { x: 0, y: 0, z: 3 }, destino = { x: 0, y: 0, z: -3 }
    expect(criarNavegacao(ambiente, [{ ...estante(0, 0), vaos: 12 }]).caminho(origem, destino)).toBeNull()
    expect(criarNavegacao(ambiente, []).caminho(origem, destino)).not.toBeNull()
  })
})
describe('etapas de recebimento e coleta', () => {
  const nav = criarNavegacao(ambiente, [])
  it('recebe da porta, carrega e guarda antes de voltar', () => {
    const t = planejarTarefa({ produtoId: 'p', de: portaDaRua(ambiente), para: { x: 0, y: 0.3, z: 0 }, unidades: 3, atraso: 0, operacao: 'receber' }, descansoDaAssistente(ambiente), nav, ambiente)!
    expect(t.etapas.map(e => e.fase)).toEqual(['buscar', 'pegar', 'levar', 'guardar', 'voltar', 'orientar'])
  })
  it('caminhão espera acomodar a encomenda antes de partir', () => {
    const t = planejarTarefa({ produtoId: 'p', de: { x: 0, y: 2.3, z: 0 }, para: retiradaNaRua(ambiente), unidades: 1, atraso: 0, operacao: 'entregar' }, descansoDaAssistente(ambiente), nav, ambiente)!
    expect(t.etapas.map(e => e.fase)).toEqual(['caminhao_chega', 'buscar', 'pegar', 'levar', 'guardar', 'caminhao_sai', 'voltar', 'orientar'])
    expect(t.etapas[2]!.duracao).toBeGreaterThan(2)
  })
})
