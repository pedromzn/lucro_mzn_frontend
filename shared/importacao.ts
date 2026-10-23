/**
 * Importação de produtos — as regras que a tela e o servidor compartilham.
 *
 * É a importação de contatos do Marketing Flow (`mzn_mkt/backend/shared/importacao.ts`)
 * trazida para o catálogo, com os mesmos limites e os mesmos três passos:
 * arquivo, conferir as colunas, importar. O trabalho de verdade não é ler o
 * arquivo: é **adivinhar bem** a que campo cada coluna corresponde. Quem
 * exporta do Bling, do Tiny ou de uma planilha feita à mão chega com
 * "Descrição", "Código" ou "Preço de custo" — e obrigar a pessoa a apontar
 * quinze colunas à mão é o que faz ela desistir no meio.
 *
 * O palpite acerta o comum e **nunca decide sozinho**: a tela mostra o que foi
 * adivinhado e deixa trocar tudo. Palpite errado que ninguém vê é pior que
 * coluna nenhuma adivinhada.
 */

/**
 * Reconhece uma planilha pela extensão.
 *
 * Pela extensão e não pelo `type` do arquivo: o navegador manda
 * `application/octet-stream` para .xlsx em boa parte dos casos, e o Windows
 * sem Excel instalado manda vazio. `.xls` fica de fora de propósito — é outro
 * formato (BIFF, do Excel 2003), e tratá-lo como .xlsx daria "arquivo
 * corrompido", que manda procurar o problema no lugar errado.
 */
export function ehPlanilha(nome: string): boolean {
  return /\.(xlsx|xlsm)$/i.test(nome.trim())
}

/** O formato velho do Excel, que ninguém aqui lê — merece recado próprio. */
export function ehXlsAntigo(nome: string): boolean {
  return /\.xls$/i.test(nome.trim())
}

/** O que o seletor de arquivo aceita. */
export const EXTENSOES_ACEITAS = '.csv,.xlsx,.xlsm,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/**
 * O teto do conteúdo que trafega, em caracteres — o mesmo do MKT.
 *
 * Vale para o texto do CSV e para o base64 do XLSX (que infla o binário em um
 * terço; por isso a tela mede o texto, não o `arquivo.size`). Precisa ficar
 * abaixo do teto do corpo da rota (`express.json` de `/api/importacao` no
 * `main.ts`): assim a recusa vem daqui, com uma frase que explica, e não do
 * parser, com um 413 seco.
 */
export const LIMITE_DO_CONTEUDO = 20 * 1024 * 1024

/**
 * O teto de linhas por arquivo — o mesmo do MKT. Acima disso, só as primeiras
 * entram e a tela pede para quebrar em partes.
 *
 * Não é o teto do catálogo: o espaço guarda até 2.000 produtos
 * (`TETOS_DO_ESPACO`), e a análise avisa quando o arquivo passaria dele. Uma
 * planilha grande que só ATUALIZA produtos que já existem cabe inteira.
 *
 * ⚠ Este número não anda sozinho: mexer aqui pede revisar `LIMITE_DO_CONTEUDO`,
 * o `express.json` da rota e o teto descompactado do XLSX (`planilhas.ts`).
 */
export const LIMITE_DE_LINHAS = 50000

/** Quantas linhas a tela mostra na conferência. */
export const LINHAS_DE_AMOSTRA = 5

/** Quantas colunas um arquivo pode ter — o mesmo teto de vínculos do MKT. */
export const LIMITE_DE_COLUNAS = 500

/** O que fazer quando o produto já existe no espaço. */
export const CONFLITOS = ['atualizar', 'ignorar'] as const
export type Conflito = (typeof CONFLITOS)[number]

export const ROTULO_CONFLITO: Record<Conflito, string> = {
  atualizar: 'Atualizar o que já existe',
  ignorar: 'Manter como está e pular',
}

/** Uma coluna do arquivo, ligada (ou não) a um campo do produto. */
export interface Vinculo {
  /** índice da coluna no arquivo */
  coluna: number
  cabecalho: string
  /** a chave do campo de destino; vazio significa "não importar esta coluna" */
  campo: string
}

/**
 * Os destinos possíveis de uma coluna.
 *
 * O rótulo é o cabeçalho da exportação do próprio app (`CABECALHOS`, em
 * `transferencias/service.ts`): o arquivo exportado volta na importação sem
 * ninguém apontar coluna. Os números são as premissas do motor (`preco.ts`).
 */
export const CAMPOS_DO_PRODUTO = [
  { key: 'nome', label: 'Nome', grupo: 'produto' },
  { key: 'sku', label: 'SKU', grupo: 'produto' },
  { key: 'categoria', label: 'Categoria', grupo: 'produto' },
  { key: 'unidade', label: 'Unidade', grupo: 'produto' },
  { key: 'tags', label: 'Tags', grupo: 'produto' },
  { key: 'notas', label: 'Notas', grupo: 'produto' },
  { key: 'custo', label: 'Custo', grupo: 'preco' },
  { key: 'quantidade', label: 'Quantidade por lote', grupo: 'preco' },
  { key: 'embalagem', label: 'Embalagem', grupo: 'preco' },
  { key: 'frete', label: 'Frete', grupo: 'preco' },
  { key: 'tarifaFixa', label: 'Taxa fixa', grupo: 'preco' },
  { key: 'comissao', label: 'Comissão %', grupo: 'preco' },
  { key: 'tributo', label: 'Tributos %', grupo: 'preco' },
  { key: 'meta', label: 'Margem-alvo %', grupo: 'preco' },
  { key: 'preco', label: 'Preço praticado', grupo: 'preco' },
] as const
export type CampoDoProduto = (typeof CAMPOS_DO_PRODUTO)[number]['key']

/** Os campos numéricos — vão para as premissas, não para o cadastro. */
export const CAMPOS_DE_PRECO: readonly CampoDoProduto[] = CAMPOS_DO_PRODUTO.filter((c) => c.grupo === 'preco').map((c) => c.key)

export const ROTULO_DO_CAMPO = Object.fromEntries(CAMPOS_DO_PRODUTO.map((c) => [c.key, c.label])) as Record<CampoDoProduto, string>

/**
 * Apelidos por campo.
 *
 * Só o que aparece de verdade em exportação de ERP brasileiro (Bling, Tiny),
 * de marketplace e de planilha feita à mão. Lista curta e honesta vale mais que
 * lista grande com chute: um apelido errado liga a coluna errada e o estrago só
 * aparece no preço, semanas depois.
 *
 * "Quantidade" sozinha fica de FORA de propósito: num ERP ela é o saldo em
 * estoque, e ligada a "quantidade por lote" dividiria o custo pelo estoque. O
 * saldo é registrado em Estoque e vendas — a importação não movimenta estoque.
 * "Descrição" vai para o nome porque é assim que o Bling e o Tiny chamam o
 * nome do produto.
 */
const APELIDOS: Record<CampoDoProduto, string[]> = {
  nome: ['nome', 'produto', 'nome do produto', 'descricao', 'descricao do produto', 'name', 'product', 'product name', 'titulo', 'title', 'item'],
  sku: ['sku', 'codigo', 'cod', 'codigo sku', 'codigo do produto', 'referencia', 'ref', 'codigo de referencia'],
  categoria: ['categoria', 'category', 'grupo', 'grupo de produtos', 'departamento', 'categoria do produto'],
  unidade: ['unidade', 'un', 'und', 'unid', 'unit', 'unidade de medida'],
  tags: ['tags', 'tag', 'marcadores', 'palavras chave'],
  notas: ['notas', 'observacoes', 'observacao', 'obs', 'anotacoes'],
  custo: ['custo', 'preco de custo', 'custo unitario', 'valor de custo', 'custo de compra', 'custo do lote', 'cost'],
  quantidade: ['quantidade por lote', 'qtd por lote', 'unidades por lote', 'itens por lote'],
  embalagem: ['embalagem', 'custo de embalagem', 'custo da embalagem'],
  frete: ['frete', 'custo de frete', 'frete por unidade'],
  tarifaFixa: ['taxa fixa', 'tarifa fixa'],
  comissao: ['comissao %', 'comissao', 'comissao do canal', 'taxa do canal %'],
  tributo: ['tributos %', 'tributos', 'tributo', 'impostos', 'impostos %', 'imposto', 'aliquota'],
  meta: ['margem alvo %', 'margem alvo', 'margem desejada', 'meta de margem', 'meta'],
  preco: ['preco praticado', 'preco', 'preco de venda', 'valor de venda', 'preco unitario', 'price'],
}

/** Tira acento, espaço repetido e caixa — para comparar cabeçalho com apelido. */
export function achatar(texto: string): string {
  return texto
    .replace(/^﻿/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\-.()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Adivinha o campo de cada coluna.
 *
 * A ordem importa: apelido conhecido ganha, depois o rótulo. E cada campo só
 * é usado UMA vez — duas colunas indo para `custo` sobrescreveriam uma à
 * outra em silêncio.
 *
 * Sem o palpite pela CHAVE do campo, que o MKT tem: aqui a chave `quantidade`
 * casava com a "Quantidade" do ERP, que é o estoque (o `verify:catalogo` pega).
 */
export function adivinharVinculos(cabecalhos: string[]): Vinculo[] {
  const usados = new Set<string>()
  const porApelido = new Map<string, string>()
  for (const [campo, apelidos] of Object.entries(APELIDOS)) {
    for (const apelido of apelidos) porApelido.set(achatar(apelido), campo)
  }
  const porRotulo = new Map(CAMPOS_DO_PRODUTO.map((c) => [achatar(c.label), c.key as string]))

  return cabecalhos.map((cabecalho, coluna) => {
    const plano = achatar(cabecalho)
    const candidato = porApelido.get(plano) ?? porRotulo.get(plano)
    /* campo já usado por outra coluna não é reusado: o segundo ficaria mudo */
    const campo = candidato && !usados.has(candidato) ? candidato : ''
    if (campo) usados.add(campo)
    return { coluna, cabecalho, campo }
  })
}

/**
 * O que impede a importação de começar.
 *
 * Só erro que trava mesmo. Coluna sem destino não é erro — é a forma normal de
 * dizer "essa eu não quero".
 */
export function verificarVinculos(vinculos: Vinculo[]): string[] {
  const problemas: string[] = []
  const usados = vinculos.map((v) => v.campo).filter(Boolean)
  const conhecidos = new Set<string>(CAMPOS_DO_PRODUTO.map((c) => c.key))

  for (const campo of new Set(usados.filter((c) => !conhecidos.has(c)))) {
    problemas.push(`O campo "${campo}" não existe no produto.`)
  }
  const repetidos = usados.filter((c, i) => usados.indexOf(c) !== i)
  for (const chave of [...new Set(repetidos)]) {
    problemas.push(`Duas colunas estão indo para o mesmo campo ("${ROTULO_DO_CAMPO[chave as CampoDoProduto] ?? chave}"). Escolha uma.`)
  }

  /*
   * Sem nome não há produto, e sem custo não há preço: o motor recusaria a
   * linha. O SKU NÃO é obrigatório — sem ele, o produto é reconhecido pelo
   * nome (sem acento e sem caixa), como sempre foi no Lucro Certo.
   */
  if (!usados.includes('nome')) problemas.push('Ligue uma coluna ao Nome — é ele que identifica o produto.')
  if (!usados.includes('custo')) problemas.push('Ligue uma coluna ao Custo — sem ele não há preço sugerido.')

  return problemas
}

/** Os valores de uma linha, só das colunas ligadas e não vazias. */
export function valoresDaLinha(linha: string[], vinculos: Vinculo[]): Partial<Record<CampoDoProduto, string>> {
  const valores: Partial<Record<CampoDoProduto, string>> = {}
  for (const v of vinculos) {
    if (!v.campo) continue
    const bruto = (linha[v.coluna] ?? '').trim()
    if (bruto !== '') valores[v.campo as CampoDoProduto] = bruto
  }
  return valores
}

/**
 * O que a análise devolve — o contrato do passo "confira antes de importar".
 * Mora aqui, e não no serviço, porque é exatamente o que a tela consome.
 */
export interface Analise {
  arquivo: string
  total: number
  cabecalhos: string[]
  amostra: string[][]
  vinculos: Vinculo[]
  campos: Array<{ key: string; label: string; grupo: 'produto' | 'preco' }>
  avisos: string[]
}

// ─── Estado de uma importação ────────────────────────────────────────────────

export const ESTADOS_DE_IMPORTACAO = ['processando', 'concluida', 'falhou'] as const
export type EstadoDaImportacao = (typeof ESTADOS_DE_IMPORTACAO)[number]

export interface LinhaRecusada {
  linha: number
  motivo: string
}

export interface ResumoDaImportacao {
  id: string
  arquivo: string
  estado: EstadoDaImportacao
  total: number
  processadas: number
  criados: number
  atualizados: number
  ignorados: number
  recusados: number
  erros: LinhaRecusada[]
  erro: string | null
  criada_em: string
  concluida_em: string | null
}
