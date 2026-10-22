/**
 * As regras do estoque e da venda registrada.
 *
 * Duas separações que não podem se perder (decisões aprovadas no mock):
 *
 * - **A quantidade do lote de custo NÃO é estoque.** "R$ 100 por 5 kg" é conta
 *   de preço; o saldo só muda por movimento registrado.
 * - **A venda registrada aqui não é cobrança.** A forma de pagamento é só o que
 *   a pessoa informou, e a devolução não estorna dinheiro de ninguém.
 *
 * O custo do estoque é o MÉDIO PONDERADO: entrada recalcula a média, saída usa
 * a média de antes. Alterar o custo no catálogo não reescreve o estoque nem as
 * vendas passadas.
 */

import { z } from 'zod'
import { D } from './preco.js'

/** Seis casas na quantidade (balança, metro) e um teto que pega engano de digitação. */
export const decimalDeEstoque = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, 'Informe um número positivo com até seis casas decimais.')
  .max(20)
  .refine((v) => D(v).lte('1000000000'), 'Valor acima do limite permitido.')

export const TIPOS_DE_MOVIMENTO = ['inicial', 'entrada', 'venda', 'perda', 'uso_proprio', 'conferencia'] as const
/** `devolucao` nasce da devolução da venda, e `transferencia` só muda o endereço (o saldo total fica): nenhum dos dois entra pelo formulário de movimento. */
export type TipoDeMovimento = (typeof TIPOS_DE_MOVIMENTO)[number] | 'devolucao' | 'transferencia'

/** Uma posição: estrutura · nível · vão. Mora aqui, e não em `enderecos.ts`, porque aquele importa daqui — o contrário faria um ciclo. */
export const enderecoDoMovimento = z.object({
  estruturaId: z.string().max(40),
  nivel: z.number().int().min(0).max(7),
  vao: z.number().int().min(0).max(11),
})

export const FORMAS_DE_PAGAMENTO_DA_VENDA = ['Pix', 'Cartão', 'Dinheiro', 'Boleto', 'Outro'] as const

export const movimentoSchema = z.object({
  /** gerada pela tela UMA vez por formulário: repetir o envio não duplica o movimento */
  chaveDaOperacao: z.string().uuid(),
  produtoId: z.string().max(40),
  tipo: z.enum(TIPOS_DE_MOVIMENTO),
  /** na conferência é o saldo CONTADO, não a diferença */
  quantidade: decimalDeEstoque,
  custoUnitario: decimalDeEstoque.default('0'),
  precoUnitario: decimalDeEstoque.default('0'),
  /** desconto em reais, POR UNIDADE */
  desconto: decimalDeEstoque.default('0'),
  canalId: z.string().max(40).nullable().default(null),
  formaDePagamento: z.enum(FORMAS_DE_PAGAMENTO_DA_VENDA).default('Pix'),
  motivo: z.string().trim().max(250).default(''),
  /**
   * Onde (PLANO-ESTOQUE-3D.md, E1): o DESTINO de uma entrada, a ORIGEM de uma
   * saída, a POSIÇÃO contada numa conferência. Sem endereço, entrada fica "a
   * guardar" e saída segue a ordem de `planoDeSaida`.
   */
  endereco: enderecoDoMovimento.nullable().default(null),
})
export type PedidoDeMovimento = z.infer<typeof movimentoSchema>

export const NOMES_DOS_MOVIMENTOS: Record<TipoDeMovimento, string> = {
  inicial: 'Estoque inicial',
  entrada: 'Entrada de mercadoria',
  venda: 'Venda',
  perda: 'Perda',
  uso_proprio: 'Uso próprio',
  conferencia: 'Conferência de estoque',
  devolucao: 'Devolução da venda',
  transferencia: 'Transferência entre posições',
}

/** Os que tiram do estoque — e por isso pedem saldo. */
export const MOVIMENTOS_DE_SAIDA: ReadonlySet<TipoDeMovimento> = new Set(['venda', 'perda', 'uso_proprio'])
/** Os que pedem motivo escrito: tirar do estoque sem vender precisa de explicação. */
export const MOVIMENTOS_COM_MOTIVO: ReadonlySet<TipoDeMovimento> = new Set(['perda', 'uso_proprio', 'conferencia'])

/** Unidade contável (unidade, pacote, kit…) só aceita quantidade inteira; peso e medida aceitam fração. */
const FRACIONAVEIS = new Set(['kg', 'g', 'litro', 'ml', 'metro'])

export function conferirQuantidade(unidade: string, valor: string): void {
  if (!FRACIONAVEIS.has(unidade) && !D(valor).isInteger()) {
    throw new Error(`Informe uma quantidade inteira para produtos vendidos por ${unidade}.`)
  }
}

/** As unidades contáveis que ganham plural — "kg", "ml" e "metro" se escrevem iguais. */
const COM_PLURAL: Record<string, string> = { unidade: 'unidades', pacote: 'pacotes', kit: 'kits', caixa: 'caixas', par: 'pares', peca: 'peças', 'peça': 'peças', litro: 'litros' }

/** "24 unidades", "1 unidade", "2,5 kg" — a quantidade com a unidade escrita como se fala. */
export function rotuloDaQuantidade(valor: string | number, unidade: string): string {
  const n = D(valor)
  const texto = n.toDecimalPlaces(3).toString().replace('.', ',')
  const nome = n.abs().eq(1) ? unidade : (COM_PLURAL[unidade] ?? unidade)
  return `${texto} ${nome}`
}

export interface SaldoAtual {
  quantidade: string
  valorEmEstoque: string
}

export interface MudancaDeSaldo {
  quantidade: string
  valorEmEstoque: string
  /** o custo por unidade que o movimento usou — o da entrada, ou a média da saída */
  custoUnitario: string
  variacaoDeValor: string
}

/**
 * O saldo depois de um movimento.
 *
 * `delta` positivo entra ao `custoDeEntrada`; negativo sai pela média de antes.
 * Zerar o saldo zera o valor (sem resto de centavo pendurado). Saldo negativo e
 * valor negativo são recusados — é a trava contra vender o que não existe.
 */
export function mudancaDeSaldo(atual: SaldoAtual, delta: string, custoDeEntrada: string): MudancaDeSaldo {
  const quantidade = D(atual.quantidade)
  const valor = D(atual.valorEmEstoque)
  const mudanca = D(delta)
  const depois = quantidade.plus(mudanca)
  if (depois.lt(0)) throw new Error('A quantidade supera o estoque disponível. Confira o saldo antes de continuar.')
  const media = quantidade.gt(0) ? valor.div(quantidade) : D(0)
  const custo = mudanca.gt(0) ? D(custoDeEntrada) : media
  const valorDepois = depois.eq(0) ? D(0) : valor.plus(mudanca.times(custo))
  if (valorDepois.lt(0)) throw new Error('O ajuste deixaria o valor do estoque negativo. Confira os custos.')
  return {
    quantidade: depois.toFixed(6),
    valorEmEstoque: valorDepois.toFixed(8),
    custoUnitario: custo.toFixed(8),
    variacaoDeValor: valorDepois.minus(valor).toFixed(8),
  }
}
