/**
 * Os contratos do Lucro Certo — o formato do que entra pela API.
 *
 * Os mesmos schemas validam o formulário no painel e o corpo no servidor. O
 * servidor NUNCA confia no painel: estes schemas rodam de novo lá, e o motor
 * (`preco.ts`) recalcula tudo antes de gravar.
 *
 * Dinheiro e percentual entram como TEXTO decimal (`"40.00"`, `"15"`), nunca
 * como número — é o que mantém o `Decimal` do motor exato do formulário ao banco.
 */

import { z } from 'zod'

const decimal = z.string().regex(/^\d+(\.\d{1,8})?$/, 'Informe um número positivo, com até 8 casas decimais.').max(22)

export const custoExtraSchema = z.object({
  id: z.string().max(80),
  nome: z.string().min(1).max(100),
  valor: decimal,
  frequencia: z.enum(['unidade', 'lote', 'mensal']),
  divisor: decimal.optional(),
  categoria: z.string().max(60),
})

export const cobrancaSchema = z.object({
  id: z.string().max(80),
  nome: z.string().min(1).max(100),
  tipo: z.enum(['fixa', 'percentual', 'faixa', 'progressiva']),
  valor: decimal.optional(),
  taxa: decimal.optional(),
  base: z.enum(['venda', 'venda_frete', 'custo']).optional(),
  ajuste: decimal.optional(),
  faixas: z.array(z.object({ ate: decimal.nullable(), taxa: decimal, fixo: decimal.optional() })).max(20).optional(),
})

export const premissasSchema = z.object({
  custo: decimal,
  quantidade: decimal,
  embalagem: decimal,
  frete: decimal,
  tarifaFixa: decimal,
  comissao: decimal,
  tributo: decimal,
  tributoConferido: z.boolean(),
  meta: z.string().regex(/^-?\d+(\.\d{1,8})?$/, 'Margem inválida.').max(15),
  preco: decimal,
  arredondamento: z.enum(['nenhum', '90', '99', 'inteiro', 'multiplo']),
  multiplo: decimal,
  custos: z.array(custoExtraSchema).max(50),
  cobrancas: z.array(cobrancaSchema).max(30),
  fonte: z.string().max(300).optional(),
  formaDePagamento: z.enum(['Pix', 'Cartão', 'Boleto', 'Outro']).optional(),
})

export const produtoSchema = z.object({
  id: z.string().max(40).optional(),
  nome: z.string().trim().min(1, 'Informe o nome.').max(120),
  sku: z.string().trim().max(60).nullable().optional(),
  categoria: z.string().trim().max(100).default('Outros'),
  unidade: z.string().max(25).default('unidade'),
  status: z.enum(['ativo', 'arquivado']).default('ativo'),
  favorito: z.boolean().default(false),
  canalId: z.string().max(40).nullable().optional(),
  imagemId: z.string().max(40).nullable().optional(),
  tags: z.array(z.string().trim().max(30)).max(12).default([]),
  notas: z.string().max(1500).default(''),
  premissas: premissasSchema,
  /** a revisão que a tela leu — é o que segura a gravação concorrente */
  revisao: z.number().int().positive().optional(),
})
export type DadosDoProduto = z.infer<typeof produtoSchema>

export const TIPOS_DE_CANAL = ['shopee', 'mercadolivre', 'loja_propria', 'loja_fisica', 'redes_sociais', 'outro'] as const

export const canalSchema = z.object({
  id: z.string().max(40).optional(),
  nome: z.string().trim().min(1).max(80),
  tipo: z.enum(TIPOS_DE_CANAL),
  revisao: z.number().int().positive().optional(),
  dados: z.object({
    comissao: decimal,
    tarifaFixa: decimal,
    cobrancas: z.array(cobrancaSchema).max(30),
    /** de onde vieram os valores — o contrato, o painel do vendedor */
    fonte: z.string().trim().min(1).max(300),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** a pessoa conferiu os valores — o canal "não conferido" aparece marcado em toda tela */
    conferido: z.boolean(),
    notas: z.string().max(1000).default(''),
  }),
})
export type DadosDoCanal = z.infer<typeof canalSchema>

export const CATEGORIAS = [
  'Moda e acessórios', 'Moda e acessórios / Roupas', 'Moda e acessórios / Bolsas e joias', 'Casa e decoração',
  'Casa e decoração / Cozinha', 'Beleza e cuidados', 'Alimentos e bebidas', 'Papelaria', 'Artesanato', 'Eletrônicos',
  'Brinquedos', 'Pet', 'Outros',
]
export const UNIDADES = ['unidade', 'kg', 'g', 'litro', 'ml', 'metro', 'pacote', 'kit', 'par', 'caixa', 'dúzia']
export const CATEGORIAS_DE_CUSTO = [
  'Matéria-prima', 'Mão de obra', 'Embalagem', 'Etiquetagem', 'Frete de aquisição', 'Publicidade',
  'Perdas e devoluções', 'Despesa fixa', 'Outros',
]
export const REGIMES_TRIBUTARIOS = ['Não sei', 'Ainda vendo com CPF', 'MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real']

/** As preferências de cada pessoa no app — campo a campo, nada além disto entra. */
export const preferenciasSchema = z.object({
  primeirosPassos: z.boolean().optional(),
  dicas: z.boolean().optional(),
  canais: z.array(z.string().max(60)).max(10).optional(),
  categoria: z.string().max(100).optional(),
  conheceCustos: z.string().max(100).optional(),
  prioridade: z.string().max(100).optional(),
  regimeTributario: z.enum(REGIMES_TRIBUTARIOS as [string, ...string[]]).optional(),
  canalFavorito: z.string().max(40).optional(),
  filtrosSalvos: z.array(z.object({
    nome: z.string().max(60), busca: z.string().max(120), status: z.string().max(30), categoria: z.string().max(100),
  })).max(15).optional(),
})
export type Preferencias = z.infer<typeof preferenciasSchema>
