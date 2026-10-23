/**
 * A situação do preço de um produto — PLANO-USABILIDADE-LUCRO.md, U1.
 *
 * Uma regra só para toda tela que precisa dizer "este preço está bem?":
 * Produtos, Visão geral e Comparar canais. O motor (`shared/preco.ts`) já
 * calcula tudo; aqui é só a LEITURA, na ordem de gravidade — prejuízo primeiro,
 * porque é o que o app existe para evitar.
 *
 * A base é o preço que a pessoa COBRA (`calculo.atual`). Sem ele não há
 * situação de venda: o produto fica "sem preço", e o sugerido é só a dica do
 * mínimo — nunca um preço de verdade fingindo que é o dela.
 */

import type { Produto } from '@/lib/api'

export type SituacaoDoPreco = 'prejuizo' | 'abaixo' | 'sem_preco' | 'revisar' | 'na_meta'

/** Da mais grave para a menos — é a ordem de "Um olhar atento" e do filtro. */
export const SITUACOES: readonly SituacaoDoPreco[] = ['prejuizo', 'abaixo', 'sem_preco', 'revisar', 'na_meta']

export const ROTULO_DA_SITUACAO: Record<SituacaoDoPreco, string> = {
  prejuizo: 'Prejuízo',
  abaixo: 'Abaixo da meta',
  sem_preco: 'Sem preço definido',
  revisar: 'Revisar custos',
  na_meta: 'Na meta',
}

/** O tom do `Selo` (`components/ui.tsx`) de cada situação. */
export const TOM_DA_SITUACAO = {
  prejuizo: 'vermelho', abaixo: 'ambar', sem_preco: 'neutro', revisar: 'vermelho', na_meta: 'verde',
} as const satisfies Record<SituacaoDoPreco, 'vermelho' | 'ambar' | 'neutro' | 'verde'>

export function situacaoDoPreco(p: Pick<Produto, 'calculo'>): SituacaoDoPreco {
  /* premissa impossível (o motor recusou): não há conta para mostrar */
  if (!p.calculo) return 'revisar'
  const atual = p.calculo.atual
  if (!atual) return 'sem_preco'
  if (Number(atual.lucro) < 0) return 'prejuizo'
  return atual.atingeMeta ? 'na_meta' : 'abaixo'
}

/** Quantos produtos em cada situação — os cartões da Visão geral. */
export function contarSituacoes(produtos: Array<Pick<Produto, 'calculo'>>): Record<SituacaoDoPreco, number> {
  const conta = { prejuizo: 0, abaixo: 0, sem_preco: 0, revisar: 0, na_meta: 0 }
  for (const p of produtos) conta[situacaoDoPreco(p)] += 1
  return conta
}
