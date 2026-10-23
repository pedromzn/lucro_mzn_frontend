/** Etiquetas de transporte do Lucro Certo — contratos de expedição, sem emissão de frete (PLANO-ETIQUETAS-TRANSPORTE). */
import { z } from 'zod'

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const
export const MODELOS_DE_TRANSPORTE = [
  { id: 'enderecamento', nome: 'Endereçamento', descricao: 'Para atendimento, com espaço para a identificação oficial.' },
  { id: 'expedicao', nome: 'Transportadora', descricao: 'Identificação auxiliar do frete e de cada volume.' },
  { id: 'local', nome: 'Entrega local', descricao: 'Logística própria com campos para recebimento.' },
] as const
export type ModeloDeTransporte = typeof MODELOS_DE_TRANSPORTE[number]['id']

/* Recusar glifos ausentes e controles evita perder partes do endereço ao desenhar o PDF. */
const texto = (maximo: number) => z.string().trim().max(maximo).regex(/^[\u0020-\u007e\u00a0-\u00ff\u2013\u2014\u2026]*$/, 'Use texto em português, sem emojis ou quebras de linha.')
export const enderecoDeTransporteSchema = z.object({
  nome: texto(70).min(2, 'Informe o nome completo ou a razão social.'),
  logradouro: texto(80).min(2, 'Informe o logradouro.'),
  numero: texto(12).min(1, 'Informe o número ou S/N.'),
  complemento: texto(60),
  bairro: texto(50).min(2, 'Informe o bairro.'),
  cidade: texto(50).min(2, 'Informe a cidade.'),
  uf: z.enum(UFS),
  cep: z.string().trim().regex(/^\d{5}-?\d{3}$/, 'Informe um CEP com 8 dígitos.').transform((v) => v.replace('-', '')),
  telefone: z.string().trim().max(20).refine((v) => !v || (/^[\d ()+.-]+$/.test(v) && /^\d{10,13}$/.test(v.replace(/\D/g, ''))), 'Informe telefone com DDD.'),
}).strict()
export type EnderecoDeTransporte = z.infer<typeof enderecoDeTransporteSchema>

const medida = z.string().regex(/^\d{1,4}(\.\d{1,3})?$/, 'Informe um número positivo com até 3 casas decimais.').refine((v) => Number(v) > 0 && Number(v) <= 1000, 'Informe uma medida maior que zero e até 1.000.')
export const pedidoDeTransporteSchema = z.object({
  modelo: z.enum(['enderecamento', 'expedicao', 'local']),
  papel: z.enum(['termica', 'a4']),
  remetente: enderecoDeTransporteSchema,
  destinatario: enderecoDeTransporteSchema,
  pedido: texto(35).min(1, 'Informe a referência do pedido.'),
  transportadora: texto(45),
  servico: texto(40),
  referenciaDoFrete: texto(45),
  volumes: z.number().int().min(1).max(30),
  peso: medida,
  comprimento: medida,
  largura: medida,
  altura: medida,
  documento: z.enum(['nfe', 'dce']),
  numeroDaNota: z.string().trim().max(9).regex(/^\d*$/, 'Use somente números na NF-e.'),
  chaveFiscal: z.string().trim().regex(/^(\d{44})?$/, 'A chave fiscal deve ter 44 dígitos.'),
  instrucoes: texto(120),
}).strict().superRefine((x, ctx) => {
  const exigir = (condicao: boolean, campo: keyof typeof x, mensagem: string) => {
    if (!condicao) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: mensagem })
  }
  if (x.modelo === 'expedicao') {
    exigir(!!x.transportadora, 'transportadora', 'Informe a transportadora contratada.')
    exigir(!!x.servico, 'servico', 'Informe o serviço contratado.')
    exigir(!!x.referenciaDoFrete, 'referenciaDoFrete', 'Informe a referência fornecida na contratação do frete.')
  }
  if (x.modelo === 'local') exigir(!!x.destinatario.telefone, 'destinatario', 'Informe o telefone do destinatário para a entrega local.')
  if (x.documento === 'nfe') exigir(/^[1-9]\d{0,8}$/.test(x.numeroDaNota), 'numeroDaNota', 'Informe o número da NF-e emitida, sem zeros à esquerda.')
  if (x.documento === 'dce') exigir(x.chaveFiscal.length === 44, 'chaveFiscal', 'Informe a chave de 44 dígitos da DC-e emitida.')
})
export type PedidoDeTransporte = z.infer<typeof pedidoDeTransporteSchema>

/** Um modelo guarda padrões reutilizáveis; identificadores fiscais e de remessa pertencem a cada envio. */
export const dadosDoModeloDeTransporteSchema = pedidoDeTransporteSchema.innerType().omit({
  pedido: true, referenciaDoFrete: true, numeroDaNota: true, chaveFiscal: true,
}).extend({
  destinatario: enderecoDeTransporteSchema.nullable(),
  peso: medida.or(z.literal('')),
  comprimento: medida.or(z.literal('')),
  largura: medida.or(z.literal('')),
  altura: medida.or(z.literal('')),
}).strict()
export const salvarModeloDeTransporteSchema = z.object({
  id: z.string().min(1).max(40).optional(),
  revisao: z.number().int().positive().optional(),
  nome: texto(100).min(3, 'Dê um nome ao modelo com pelo menos 3 caracteres.'),
  dados: dadosDoModeloDeTransporteSchema,
}).strict().refine((x) => Boolean(x.id) === Boolean(x.revisao), { message: 'Informe a revisão do modelo que está editando.', path: ['revisao'] })
export type DadosDoModeloDeTransporte = z.infer<typeof dadosDoModeloDeTransporteSchema>
export type SalvarModeloDeTransporte = z.infer<typeof salvarModeloDeTransporteSchema>
export interface ModeloDeTransporteSalvo {
  id: string
  nome: string
  revisao: number
  dados: DadosDoModeloDeTransporte
  atualizadoEm: string
}

export const formatarCep = (cep: string) => cep.replace(/^(\d{5})-?(\d{3})$/, '$1-$2')
export function linhasDoEndereco(e: Omit<EnderecoDeTransporte, 'uf'> & { uf: string }): string[] {
  return [e.nome, [e.logradouro, e.numero].filter(Boolean).join(', '), e.complemento, e.bairro, [e.cidade, e.uf].filter(Boolean).join(' / '), e.cep ? `CEP ${formatarCep(e.cep)}` : '', e.telefone ? `Tel. ${e.telefone}` : ''].filter(Boolean)
}
