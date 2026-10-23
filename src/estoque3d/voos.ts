/**
 * A mercadoria andando — PLANO-ESTOQUE-3D.md, fatia 4.
 *
 * Uma conta só para duas coisas: a ação de quem está na tela e a de outra
 * pessoa (que chega quando o mapa é relido). O replay das últimas
 * movimentações saiu em 22/10/2026 (pedido do Pedro). Nas duas, cada produto tem FONTES (onde diminuiu) e DESTINOS
 * (onde aumentou); o par vira um voo. O que sobra sem par saiu pela expedição
 * (o estoque diminuiu) ou chegou pela doca (aumentou) — e a devolução, que
 * volta pelo caixa, chega pela expedição.
 *
 * Contas puras, testadas em `testes/voos.test.ts`.
 */

import { chaveDoEndereco, type Endereco } from '@shared/enderecos'
import type { MovimentoNoMapa, PosicaoNoMapa } from '@/lib/api'

export interface Ponto { x: number; y: number; z: number }

export interface Voo {
  operacao?: 'receber' | 'mover' | 'entregar' | 'retirar'
  legenda?: string
  produtoId: string
  de: Ponto
  para: Ponto
  /** quantas caixinhas voam — no máximo 3, por mais que a quantidade seja grande */
  unidades: number
  /** quando sai, em milissegundos a partir do início da leva */
  atraso: number
}

export interface Lugares {
  /** o centro de uma posição, ou `null` se ela não existe mais na planta */
  posicao: (e: Endereco) => Ponto | null
  /** o "a guardar", no chão do recebimento */
  chao: Ponto
  /** a doca, a porta dos fundos: por onde a mercadoria chega */
  entrada: Ponto
  /** o caixa, a expedição: por onde ela sai */
  saida: Ponto
}

const CHAO = 'chao'
const TETO_DE_VOOS = 18
const INTERVALO = 140

type Pontas = Map<string, number>

function parear(produtoId: string, fontes: Pontas, destinos: Pontas, lugares: Lugares, chegaPor: Ponto): Array<Omit<Voo, 'atraso'>> {
  const ponto = (chave: string): Ponto | null => {
    if (chave === CHAO) return lugares.chao
    const [estruturaId, nivel, vao] = chave.split(':')
    return lugares.posicao({ estruturaId: estruturaId!, nivel: Number(nivel), vao: Number(vao) })
  }
  const unidades = (q: number) => Math.max(1, Math.min(3, Math.ceil(q)))
  const voos: Array<Omit<Voo, 'atraso'>> = []
  const f = [...fontes].filter(([, q]) => q > 1e-9)
  const d = [...destinos].filter(([, q]) => q > 1e-9)
  while (f.length && d.length) {
    const q = Math.min(f[0]![1], d[0]![1])
    const de = ponto(f[0]![0]), para = ponto(d[0]![0])
    if (de && para) voos.push({ produtoId, de, para, operacao: 'mover', unidades: unidades(q) })
    f[0]![1] -= q
    d[0]![1] -= q
    if (f[0]![1] <= 1e-9) f.shift()
    if (d[0]![1] <= 1e-9) d.shift()
  }
  for (const [chave, q] of f) { const de = ponto(chave); if (de) voos.push({ produtoId, de, para: lugares.saida, operacao: 'entregar', unidades: unidades(q) }) }
  for (const [chave, q] of d) { const para = ponto(chave); if (para) voos.push({ produtoId, de: chegaPor, para, operacao: 'receber', unidades: unidades(q) }) }
  return voos
}

const comAtraso = (voos: Array<Omit<Voo, 'atraso'>>, inicio = 0): Voo[] =>
  voos.slice(0, TETO_DE_VOOS).map((v, i) => ({ ...v, atraso: inicio + i * INTERVALO }))

export interface RetratoDoEstoque {
  posicoes: PosicaoNoMapa[]
  produtos: Array<{ id: string; aGuardar: string }>
}

/** O que mudou entre dois retratos do mapa, em voos. */
export function voosDaDiferenca(antes: RetratoDoEstoque, depois: RetratoDoEstoque, lugares: Lugares): Voo[] {
  const porProduto = new Map<string, Map<string, number>>()
  const somar = (produtoId: string, chave: string, q: number) => {
    const m = porProduto.get(produtoId) ?? new Map<string, number>()
    m.set(chave, (m.get(chave) ?? 0) + q)
    porProduto.set(produtoId, m)
  }
  for (const p of antes.posicoes) somar(p.produtoId, chaveDoEndereco(p), -Number(p.quantidade))
  for (const p of depois.posicoes) somar(p.produtoId, chaveDoEndereco(p), Number(p.quantidade))
  for (const p of antes.produtos) somar(p.id, CHAO, -Number(p.aGuardar))
  for (const p of depois.produtos) somar(p.id, CHAO, Number(p.aGuardar))

  const voos: Array<Omit<Voo, 'atraso'>> = []
  for (const [produtoId, deltas] of porProduto) {
    const fontes: Pontas = new Map(), destinos: Pontas = new Map()
    for (const [chave, d] of deltas) {
      if (d < -1e-9) fontes.set(chave, -d)
      else if (d > 1e-9) destinos.set(chave, d)
    }
    voos.push(...parear(produtoId, fontes, destinos, lugares, lugares.entrada))
  }
  return comAtraso(voos)
}
