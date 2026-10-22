/**
 * As cores da mercadoria — PLANO-ESTOQUE-3D.md, fatia 5.
 *
 * Por padrão, a cor é a da categoria. Os outros modos são o mapa de calor do
 * Warehouse Theatre 3D (MIT), com as perguntas de quem tem loja: o que precisa
 * comprar, o que gira, onde está o dinheiro parado, o que ninguém mexe há tempo.
 *
 * Giro e valor usam QUANTIS deste estoque, não números fixos: "gira muito" é
 * muito em relação ao resto da loja — dez vendas no mês é muito numa lojinha e
 * nada num armazém.
 */

import type { Tema } from '@shared/enderecos'
import type { ProdutoNoMapa } from '@/lib/api'
import { corDaCategoria, hashDe } from './temas'

export type ModoDeCor = 'categoria' | 'situacao' | 'giro' | 'valor' | 'parado'

const SEM_DADO = '#a9b0b8'

export const MODOS_DE_COR: Record<ModoDeCor, { nome: string; legenda: Array<[string, string]> }> = {
  categoria: { nome: 'Por categoria', legenda: [] },
  situacao: { nome: 'Situação do saldo', legenda: [['#3fa37d', 'Em dia'], ['#e7a33e', 'Perto do mínimo'], ['#d4485f', 'Repor']] },
  giro: { nome: 'Giro em 30 dias', legenda: [[SEM_DADO, 'Sem venda'], ['#5fb4e6', 'Pouco'], ['#8f7be0', 'Médio'], ['#f08a3c', 'Bom'], ['#e0444f', 'O que mais vende']] },
  valor: { nome: 'Dinheiro parado', legenda: [['#8fd1b8', 'Pouco'], ['#f2c14e', 'Médio'], ['#f08a3c', 'Alto'], ['#d6455d', 'O maior valor']] },
  parado: { nome: 'Dias sem movimento', legenda: [['#3fa37d', 'Até 7'], ['#f2c14e', 'Até 30'], ['#f08a3c', 'Até 90'], ['#d6455d', 'Mais de 90'], [SEM_DADO, 'Nunca']] },
}

/** Os cortes de 25%, 50% e 75% entre os valores positivos. */
export function quartis(valores: number[]): [number, number, number] | null {
  const v = valores.filter((x) => x > 0).sort((a, b) => a - b)
  if (!v.length) return null
  const q = (p: number) => v[Math.min(v.length - 1, Math.floor(p * (v.length - 1)))]!
  return [q(0.25), q(0.5), q(0.75)]
}

function naRampa(valor: number, cortes: [number, number, number] | null, rampa: string[]): string {
  if (!cortes || valor <= 0) return rampa.length === 5 ? rampa[0]! : SEM_DADO
  const ini = rampa.length === 5 ? 1 : 0
  if (valor <= cortes[0]) return rampa[ini]!
  if (valor <= cortes[1]) return rampa[ini + 1]!
  if (valor <= cortes[2]) return rampa[ini + 2]!
  return rampa[ini + 3]!
}

/** Um pouco mais clara ou escura por produto: dois produtos da mesma categoria lado a lado não se fundem. */
function variar(hex: string, semente: string): string {
  const n = parseInt(hex.slice(1), 16)
  const fator = ((hashDe(semente) % 21) - 10) / 100
  const canal = (c: number) => Math.max(0, Math.min(255, Math.round(fator > 0 ? c + (255 - c) * fator : c * (1 + fator))))
  const r = canal((n >> 16) & 255), g = canal((n >> 8) & 255), b = canal(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function coresDosProdutos(modo: ModoDeCor, tema: Tema, produtos: ProdutoNoMapa[]): Map<string, string> {
  const cores = new Map<string, string>()
  const legenda = MODOS_DE_COR[modo].legenda.map(([cor]) => cor)
  const cortesDoGiro = modo === 'giro' ? quartis(produtos.map((p) => Number(p.vendidos30d))) : null
  const cortesDoValor = modo === 'valor' ? quartis(produtos.map((p) => Number(p.valorEmEstoque))) : null
  for (const p of produtos) {
    let cor: string
    if (p.arquivado) cor = SEM_DADO
    else if (modo === 'categoria') cor = variar(corDaCategoria(tema, p.categoria), p.id)
    else if (modo === 'situacao') {
      const q = Number(p.quantidade), min = Number(p.minimo)
      cor = p.revisao > 0 && q <= min ? legenda[2]! : min > 0 && q <= min * 1.5 ? legenda[1]! : legenda[0]!
    } else if (modo === 'giro') cor = naRampa(Number(p.vendidos30d), cortesDoGiro, legenda)
    else if (modo === 'valor') cor = naRampa(Number(p.valorEmEstoque), cortesDoValor, legenda)
    else {
      const d = p.diasParado
      cor = d === null ? SEM_DADO : d <= 7 ? legenda[0]! : d <= 30 ? legenda[1]! : d <= 90 ? legenda[2]! : legenda[3]!
    }
    cores.set(p.id, cor)
  }
  return cores
}
