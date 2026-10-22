/**
 * Os modelos de etiqueta — folha A4, medidas em milímetro.
 *
 * Um modelo é DADO, não desenho: posições e dimensões validadas, versionadas, e
 * o motor de PDF (`backend/src/modules/etiquetas/pdf.ts`) não muda para entrar
 * um papel novo. Arte em PDF não vira modelo editável, e etiqueta comercial não
 * é rotulagem regulatória (alimento, cosmético) nem etiqueta de envio.
 *
 * Os modelos "compartilhados" do mock, que um administrador da plataforma
 * publicava para todas as contas, viraram os MODELOS DE FÁBRICA daqui: código
 * revisto, como os planos. Não existe administrador da MZN dentro de um app.
 */

import { z } from 'zod'

const mm = z.number().finite().min(0).max(297)

export const layoutDeEtiquetaSchema = z
  .object({
    larguraDaPagina: z.literal(210).default(210),
    alturaDaPagina: z.literal(297).default(297),
    largura: z.number().min(30).max(100),
    altura: z.number().min(20).max(100),
    colunas: z.number().int().min(1).max(6),
    linhas: z.number().int().min(1).max(14),
    margemEsquerda: mm,
    margemSuperior: mm,
    espacoEntreColunas: mm.default(0),
    espacoEntreLinhas: mm.default(0),
    tamanhoDoTexto: z.number().min(6).max(12).default(8),
    tamanhoDoPreco: z.number().min(10).max(24).default(15),
    mostrarCodigo: z.boolean().default(true),
    mostrarLoja: z.boolean().default(true),
    mostrarUnidade: z.boolean().default(true),
    contorno: z.boolean().default(false),
  })
  .strict()
  .superRefine((v, ctx) => {
    const largura = v.margemEsquerda + v.largura * v.colunas + v.espacoEntreColunas * (v.colunas - 1)
    const altura = v.margemSuperior + v.altura * v.linhas + v.espacoEntreLinhas * (v.linhas - 1)
    if (largura > v.larguraDaPagina + 0.01 || altura > v.alturaDaPagina + 0.01) {
      ctx.addIssue({ code: 'custom', message: 'As etiquetas ultrapassam a folha A4. Confira as medidas e margens.' })
    }
    /* três linhas de texto e o preço, em pontos, têm de caber na altura útil (4 mm de respiro) */
    if (v.tamanhoDoTexto * 3.3 + v.tamanhoDoPreco * 1.2 > ((v.altura - 4) * 72) / 25.4) {
      ctx.addIssue({ code: 'custom', message: 'As fontes não cabem na altura da etiqueta. Reduza o tamanho dos textos.' })
    }
  })
export type LayoutDeEtiqueta = z.infer<typeof layoutDeEtiquetaSchema>

export interface ModeloDeFabrica {
  id: string
  nome: string
  versao: number
  layout: LayoutDeEtiqueta
}

/** As duas folhas mais vendidas no Brasil (63,5 × 38,1 e 38,1 × 21,2). */
export const MODELOS_DE_FABRICA: ModeloDeFabrica[] = [
  {
    id: 'a4-21',
    nome: 'A4 · 21 etiquetas · 63,5 × 38,1 mm',
    versao: 1,
    layout: layoutDeEtiquetaSchema.parse({
      largura: 63.5, altura: 38.1, colunas: 3, linhas: 7, margemEsquerda: 7.25, margemSuperior: 15.15,
      espacoEntreColunas: 2.5, tamanhoDoTexto: 9, tamanhoDoPreco: 18,
    }),
  },
  {
    id: 'a4-65',
    nome: 'A4 · 65 etiquetas · 38,1 × 21,2 mm',
    versao: 1,
    layout: layoutDeEtiquetaSchema.parse({
      largura: 38.1, altura: 21.2, colunas: 5, linhas: 13, margemEsquerda: 4.75, margemSuperior: 10.7,
      espacoEntreColunas: 2.5, tamanhoDoTexto: 6, tamanhoDoPreco: 11,
    }),
  },
]

/**
 * O ESTILO é o desenho da etiqueta, e o MODELO é o papel (22/10/2026). Os dois
 * se combinam: qualquer estilo sai em qualquer folha, e o motor encolhe o preço
 * para caber. O estilo vai no retrato, e o clique repetido devolve o mesmo arquivo.
 */
export const ESTILOS_DE_ETIQUETA = ['classico', 'destaque', 'faixa', 'minimalista'] as const
export type EstiloDeEtiqueta = (typeof ESTILOS_DE_ETIQUETA)[number]

export const NOMES_DOS_ESTILOS: Record<EstiloDeEtiqueta, { nome: string; descricao: string }> = {
  classico: { nome: 'Clássica', descricao: 'Loja no alto, nome e preço grande. Serve para quase tudo.' },
  destaque: { nome: 'Preço em destaque', descricao: 'O preço ocupa o centro, para ler de longe na gôndola.' },
  faixa: { nome: 'Faixa da loja', descricao: 'Uma faixa escura com o nome da loja no topo, como tag de vitrine.' },
  minimalista: { nome: 'Minimalista', descricao: 'Tudo centralizado, com contorno fino. Para boutique e presente.' },
}

/** Os tetos de uma geração — um arquivo que a impressora de casa ainda imprime. */
export const MAXIMO_DE_ETIQUETAS = 500
export const MAXIMO_DE_PRODUTOS_POR_ARQUIVO = 100

export const pedidoDeEtiquetasSchema = z
  .object({
    /** a geração é idempotente por esta chave: o mesmo clique devolve o mesmo PDF */
    chaveDaOperacao: z.string().uuid(),
    modeloId: z.string().max(40),
    estilo: z.enum(ESTILOS_DE_ETIQUETA).default('classico'),
    itens: z
      .array(z.object({ produtoId: z.string().max(40), copias: z.number().int().min(1).max(MAXIMO_DE_ETIQUETAS) }))
      .min(1)
      .max(MAXIMO_DE_PRODUTOS_POR_ARQUIVO),
    /** quantas etiquetas da folha já foram usadas — para aproveitar folha começada */
    posicaoInicial: z.number().int().min(0).max(83).default(0),
    deslocamentoX: z.number().min(-5).max(5).default(0),
    deslocamentoY: z.number().min(-5).max(5).default(0),
    nomeDaLoja: z.string().trim().max(60).default(''),
    logoId: z.string().max(40).nullable().default(null),
  })
  .superRefine((v, ctx) => {
    if (v.itens.reduce((s, i) => s + i.copias, 0) > MAXIMO_DE_ETIQUETAS) {
      ctx.addIssue({ code: 'custom', message: `Gere até ${MAXIMO_DE_ETIQUETAS} etiquetas por arquivo.` })
    }
    if (new Set(v.itens.map((i) => i.produtoId)).size !== v.itens.length) {
      ctx.addIssue({ code: 'custom', message: 'Escolha cada produto uma única vez e ajuste o número de cópias.' })
    }
  })
export type PedidoDeEtiquetas = z.infer<typeof pedidoDeEtiquetasSchema>

/** O deslocamento de calibração entra nas margens — e o resultado tem de continuar cabendo na folha. */
export function aplicarDeslocamento(layout: LayoutDeEtiqueta, x: number, y: number): LayoutDeEtiqueta {
  return layoutDeEtiquetaSchema.parse({ ...layout, margemEsquerda: layout.margemEsquerda + x, margemSuperior: layout.margemSuperior + y })
}
