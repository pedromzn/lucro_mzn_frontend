/**
 * O preço que a página de venda mostra (`pages/Vitrine.tsx`).
 *
 * É o desenho do Marketing Flow: o preço que VALE é o do catálogo do Núcleo
 * (`mzn_core/src/planos/catalogo.ts`), e é ele que a loja cobra; a página de
 * venda escreve o seu à parte, como a landing do MKT (`mzn_lp_mk`) escreve o
 * dela — a vitrine do Núcleo pede sessão, e não há como lê-la antes do login.
 * Mudou lá, mude aqui.
 *
 * ⚠ PREÇO DE TESTE (21/10/2026), igual ao do catálogo: R$ 10 por usuário por
 * mês, a pedido do Pedro. Volta para o de venda junto com o do catálogo.
 */

export const PRECO_MENSAL_POR_USUARIO = 10
/** o desconto do ciclo anual — o `DESCONTO_ANUAL` do catálogo */
export const DESCONTO_ANUAL = 0.2

export const RECURSOS = [
  'Catálogo com histórico de alterações',
  'Custos, canais e perfis reutilizáveis',
  'Descontos e cenários comparados',
  'Estoque e registro simples de vendas',
  'Etiquetas de produtos em PDF',
  'Importação, lote e relatórios',
]
