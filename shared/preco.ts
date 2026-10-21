/**
 * O motor de preço do Lucro Certo — `lc-1.0.0`.
 *
 * Roda nos dois lados: no painel, para o resultado mudar enquanto a pessoa
 * digita, e no servidor, que recalcula tudo antes de gravar. Por isso mora no
 * `shared/`, e por isso não pode depender de nada além do `decimal.js`.
 *
 * Veio do mock de 19/10/2026 (`LucroCerto/lib/domain/pricing.ts`) com a mesma
 * matemática e os mesmos goldens — só os nomes viraram português. As decisões
 * que não se deduzem lendo:
 *
 * - **Dinheiro é texto decimal, e a conta é `Decimal` com 40 dígitos.** `number`
 *   perde centavo em `0,1 + 0,2`, e um motor de preço que erra centavo é um
 *   motor de preço errado. `number` só aparece na SAÍDA, já calculada.
 * - **O solver percorre todos os intervalos afins.** Taxa por faixa tem salto, e
 *   bisseção em função descontínua acha o preço errado sem avisar. Entre dois
 *   limites de faixa o custo total é uma reta; o candidato de cada trecho é
 *   conferido no centavo, com a tarifa de verdade.
 * - **Arredondamento comercial é sempre para cima**, e os indicadores são
 *   recalculados depois. Se o arredondamento cruzar uma faixa e derrubar a
 *   margem, o resultado avisa em vez de esconder.
 * - **Tributo começa em zero, NÃO confirmado.** Um resultado com tributo
 *   desconhecido é estimativa incompleta, e diz isso. O regime cadastrado não
 *   preenche alíquota: MEI paga DAS mensal, não percentual por venda.
 */

import Decimal from 'decimal.js'

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

/** A versão das regras — vai em cada revisão gravada, para o histórico dizer com que conta foi feito. */
export const VERSAO_DO_MOTOR = 'lc-1.0.0'

export const D = (v: Decimal.Value) => new Decimal(v)
export const dinheiro = (v: Decimal.Value) => D(v).toDecimalPlaces(2).toFixed(2)

/** Uma faixa de cobrança: `ate` é exclusivo; a última não tem teto (`null`). */
export interface Faixa {
  ate: string | null
  taxa: string
  fixo?: string
}

/**
 * Uma cobrança do canal ou do pagamento.
 *
 * - `fixa`: um valor por venda;
 * - `percentual`: sobre a base;
 * - `faixa`: a faixa é escolhida pelo PREÇO DE VENDA e vale sobre a base inteira;
 * - `progressiva`: cada alíquota só sobre a parcela da base dentro da faixa.
 */
export interface Cobranca {
  id: string
  nome: string
  tipo: 'fixa' | 'percentual' | 'faixa' | 'progressiva'
  valor?: string
  taxa?: string
  base?: 'venda' | 'venda_frete' | 'custo'
  /** soma à base antes de aplicar a taxa (ex.: um frete que o canal cobra junto) */
  ajuste?: string
  faixas?: Faixa[]
}

/** Um custo além do de compra: por unidade, por lote produzido ou mensal (rateado pela previsão). */
export interface CustoExtra {
  id: string
  nome: string
  valor: string
  frequencia: 'unidade' | 'lote' | 'mensal'
  divisor?: string
  categoria: string
}

export type Arredondamento = 'nenhum' | '90' | '99' | 'inteiro' | 'multiplo'
export type FormaDePagamento = 'Pix' | 'Cartão' | 'Boleto' | 'Outro'

/**
 * As premissas de um preço.
 *
 * `custo` é o custo do LOTE e `quantidade` quantas unidades ele traz — não é
 * estoque. Embalagem, frete e tarifa fixa são por unidade. `preco` zero quer
 * dizer "ainda não informado", não "de graça".
 */
export interface Premissas {
  custo: string
  quantidade: string
  embalagem: string
  frete: string
  tarifaFixa: string
  comissao: string
  tributo: string
  tributoConferido: boolean
  /** a margem desejada, em % do preço; pode ser negativa (de -100 a menos de 100) */
  meta: string
  preco: string
  arredondamento: Arredondamento
  multiplo: string
  custos: CustoExtra[]
  cobrancas: Cobranca[]
  /** de onde vieram as taxas — o canal, a fonte e a data do perfil aplicado */
  fonte?: string
  formaDePagamento?: FormaDePagamento
}

export const PREMISSAS_PADRAO: Premissas = {
  custo: '0', quantidade: '1', embalagem: '0', frete: '0', tarifaFixa: '0', comissao: '0', tributo: '0',
  tributoConferido: false, meta: '25', preco: '0', arredondamento: 'nenhum', multiplo: '1', custos: [], cobrancas: [],
}

/** Recusa de premissa — a mensagem vai direto para a tela. */
export class ErroDePreco extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErroDePreco'
  }
}

const exigir = (ok: boolean, mensagem: string) => {
  if (!ok) throw new ErroDePreco(mensagem)
}

/** Teto de qualquer valor: R$ 1 bilhão. Acima disso é engano de digitação, não preço. */
const TETO = '1000000000'

function numero(valor: unknown, rotulo: string, maximo = TETO): Decimal {
  exigir(
    typeof valor === 'string' && /^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(valor),
    `${rotulo}: informe um número positivo com até 8 casas decimais.`,
  )
  const x = D(valor as string)
  exigir(x.lte(maximo), `${rotulo}: valor acima do limite.`)
  return x
}

function comSinal(valor: string, rotulo: string): Decimal {
  exigir(/^-?(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(valor), `${rotulo}: número inválido.`)
  return D(valor)
}

/** Confere as premissas e devolve as mesmas. Os limites são os do mock: 50 custos, 30 cobranças, 20 faixas. */
export function validarPremissas(x: Premissas): Premissas {
  numero(x.custo, 'Custo')
  numero(x.embalagem, 'Embalagem')
  numero(x.frete, 'Frete')
  numero(x.tarifaFixa, 'Tarifa fixa')
  numero(x.preco, 'Preço')
  exigir(numero(x.quantidade, 'Quantidade').gt(0), 'A quantidade por lote precisa ser maior que zero.')
  exigir(numero(x.multiplo, 'Múltiplo').gt(0), 'O múltiplo deve ser maior que zero.')
  exigir(numero(x.comissao, 'Comissão', '100').lt(100), 'A comissão deve ser menor que 100%.')
  exigir(numero(x.tributo, 'Tributos', '100').lt(100), 'A alíquota deve ser menor que 100%.')
  const meta = comSinal(x.meta, 'Margem')
  exigir(meta.gte(-100) && meta.lt(100), 'A margem deve estar entre -100% e menos de 100%.')
  exigir(
    Array.isArray(x.custos) && x.custos.length <= 50 && Array.isArray(x.cobrancas) && x.cobrancas.length <= 30,
    'Limite de componentes excedido.',
  )
  for (const c of x.custos) {
    numero(c.valor, c.nome)
    if (c.frequencia !== 'unidade') {
      exigir(numero(c.divisor ?? '0', 'Volume de rateio').gt(0), 'Informe um volume maior que zero para ratear os custos.')
    }
  }
  for (const f of x.cobrancas) {
    if (f.valor) numero(f.valor, f.nome)
    if (f.taxa) numero(f.taxa, f.nome, '99.99999999')
    if (f.ajuste) numero(f.ajuste, 'Ajuste da base')
    if (f.tipo === 'faixa' || f.tipo === 'progressiva') {
      exigir(Boolean(f.faixas?.length) && f.faixas!.length <= 20, 'Informe as faixas da tarifa.')
      let anterior = D(0)
      f.faixas!.forEach((faixa, i) => {
        numero(faixa.taxa, f.nome, '99.99999999')
        if (faixa.fixo) numero(faixa.fixo, f.nome)
        if (faixa.ate === null) {
          exigir(i === f.faixas!.length - 1, 'A faixa sem teto deve ser a última.')
        } else {
          const ate = numero(faixa.ate, 'Limite')
          exigir(ate.gt(anterior), 'Os limites das faixas devem ser crescentes.')
          anterior = ate
        }
      })
      exigir(f.faixas!.at(-1)!.ate === null, 'A última faixa deve ser sem teto.')
    }
  }
  return x
}

/** Os custos monetários por unidade — o que existe antes de qualquer taxa sobre o preço. */
function custosPorUnidade(x: Premissas) {
  return [
    { id: 'compra', nome: 'Produto por unidade', valor: D(x.custo).div(x.quantidade), categoria: 'produto' },
    { id: 'embalagem', nome: 'Embalagem', valor: D(x.embalagem), categoria: 'embalagem' },
    { id: 'frete', nome: 'Frete do vendedor', valor: D(x.frete), categoria: 'frete' },
    { id: 'tarifa_fixa', nome: 'Tarifa fixa', valor: D(x.tarifaFixa), categoria: 'taxas' },
    ...x.custos.map((c) => ({
      id: c.id,
      nome: c.nome,
      categoria: c.categoria,
      valor: D(c.valor).div(c.frequencia === 'unidade' ? 1 : c.divisor!),
    })),
  ]
}

function valorDaCobranca(f: Cobranca, preco: Decimal, custo: Decimal, frete: Decimal): Decimal {
  const base = (f.base === 'custo' ? custo : f.base === 'venda_frete' ? preco.plus(frete) : preco).plus(f.ajuste ?? 0)
  if (f.tipo === 'fixa') return D(f.valor ?? 0)
  if (f.tipo === 'percentual') return base.times(f.taxa ?? 0).div(100)
  if (f.tipo === 'faixa') {
    /* a faixa é escolhida pelo PREÇO, mesmo quando a taxa incide sobre outra base */
    const faixa = f.faixas!.find((b) => b.ate === null || preco.lt(b.ate))!
    return base.times(faixa.taxa).div(100).plus(faixa.fixo ?? 0)
  }
  /* progressiva: cada alíquota só sobre a parcela da base dentro da faixa dela */
  let total = D(0)
  let piso = D(0)
  for (const faixa of f.faixas!) {
    const largura = Decimal.max(0, Decimal.min(base, faixa.ate === null ? base : D(faixa.ate)).minus(piso))
    total = total.plus(largura.times(faixa.taxa).div(100))
    if (faixa.ate === null || base.lte(faixa.ate)) break
    piso = D(faixa.ate)
  }
  return total
}

/** O que incide sobre o preço: comissão do canal, tributo estimado e as cobranças cadastradas. */
function cobrancasSobre(x: Premissas, preco: Decimal) {
  const base = custosPorUnidade(x).reduce((soma, c) => soma.plus(c.valor), D(0))
  return [
    { id: 'comissao', nome: 'Comissão do canal', valor: preco.times(x.comissao).div(100) },
    { id: 'tributo', nome: 'Tributos estimados', valor: preco.times(x.tributo).div(100) },
    ...x.cobrancas.map((f) => ({ id: f.id, nome: f.nome, valor: valorDaCobranca(f, preco, base, D(x.frete)) })),
  ]
}

function custoTotal(x: Premissas, preco: Decimal): Decimal {
  const unidade = custosPorUnidade(x).reduce((s, c) => s.plus(c.valor), D(0))
  return unidade.plus(cobrancasSobre(x, preco).reduce((s, c) => s.plus(c.valor), D(0)))
}

/** Os pontos onde o custo total pode saltar: os limites de faixa, traduzidos para o preço. */
function limitesDosTrechos(x: Premissas): Decimal[] {
  const pontos = [D(0), D(TETO)]
  for (const f of x.cobrancas) {
    for (const faixa of f.faixas ?? []) {
      if (faixa.ate === null) continue
      /* progressiva sobre o custo não depende do preço: não cria trecho */
      if (f.tipo !== 'faixa' && f.base === 'custo') continue
      const ponto = f.tipo === 'progressiva'
        ? D(faixa.ate).minus(f.ajuste ?? 0).minus(f.base === 'venda_frete' ? x.frete : 0)
        : D(faixa.ate)
      if (ponto.gt(0) && ponto.lt(TETO)) pontos.push(ponto)
    }
  }
  return [...new Map(pontos.map((d) => [d.toString(), d])).values()].sort((a, b) => a.cmp(b))
}

/**
 * O menor preço, em centavos, que atinge a margem pedida.
 *
 * Percorre cada trecho entre dois limites de faixa: ali o custo total é uma
 * reta, então dois pontos dão coeficiente e intercepto, e a equação
 * `p − custo(p) = p × m` tem solução fechada. O candidato é conferido no
 * centavo com a tarifa real (até três centavos, por resíduo numérico). O
 * primeiro trecho que tem solução é o do menor preço.
 */
export function resolverPreco(x: Premissas, meta = x.meta): Decimal {
  const m = D(meta).div(100)
  const pontos = limitesDosTrechos(x)
  for (let i = 0; i < pontos.length - 1; i++) {
    const piso = pontos[i]
    const teto = pontos[i + 1]
    const p1 = piso.plus(teto.minus(piso).div(3))
    const p2 = piso.plus(teto.minus(piso).times(2).div(3))
    const c1 = custoTotal(x, p1)
    const inclinacao = custoTotal(x, p2).minus(c1).div(p2.minus(p1))
    const intercepto = c1.minus(inclinacao.times(p1))
    const denominador = D(1).minus(m).minus(inclinacao)

    let candidato = Decimal.max(piso, D('0.01'))
    if (denominador.gt(0)) candidato = Decimal.max(candidato, intercepto.div(denominador))
    else if (candidato.times(D(1).minus(m)).lt(custoTotal(x, candidato))) continue

    candidato = Decimal.max(piso.toDecimalPlaces(2, Decimal.ROUND_CEIL), candidato.toDecimalPlaces(2, Decimal.ROUND_FLOOR))
    for (let passo = 0; passo < 3; passo++, candidato = candidato.plus('0.01')) {
      if (candidato.gte(teto)) break
      const lucro = candidato.minus(custoTotal(x, candidato))
      if (lucro.gte(candidato.times(m).minus('0.000000000000000000000001'))) return candidato
    }
  }
  throw new ErroDePreco(
    'Não existe preço viável até R$ 1 bilhão para essa combinação de custos, taxas e margem. Reduza a margem ou revise as tarifas.',
  )
}

/** O ajuste comercial — sempre para cima, para nunca cair abaixo da meta por arredondar. */
export function arredondarPreco(p: Decimal, x: Premissas): Decimal {
  if (x.arredondamento === 'inteiro') return p.ceil()
  if (x.arredondamento === 'multiplo') return p.div(x.multiplo).ceil().times(x.multiplo).toDecimalPlaces(2, Decimal.ROUND_CEIL)
  if (x.arredondamento === '90' || x.arredondamento === '99') {
    let c = p.floor().plus(x.arredondamento === '90' ? '0.90' : '0.99')
    if (c.lt(p)) c = c.plus(1)
    return c
  }
  return p.toDecimalPlaces(2, Decimal.ROUND_CEIL)
}

export interface Componente {
  id: string
  nome: string
  valor: string
  /** % do preço */
  participacao: string
}

export interface Avaliacao {
  preco: string
  lucro: string
  /** % do preço, com 4 casas */
  margem: string
  total: string
  /** taxas sobre o preço + tarifa fixa */
  taxas: string
  /** custos monetários por unidade (a base do markup) */
  base: string
  /** `null` quando a base é zero: markup sobre nada não é infinito, é indefinido */
  markup: string | null
  componentes: Componente[]
  atingeMeta: boolean
}

/** O que sobra num preço dado. Os componentes são arredondados um a um e podem diferir do total em centavos. */
export function avaliar(x: Premissas, preco: string): Avaliacao {
  const p = numero(preco, 'Preço')
  exigir(p.gt(0), 'O preço de venda deve ser maior que zero.')
  const custos = custosPorUnidade(x)
  const cobrancas = cobrancasSobre(x, p)
  const total = custos.concat(cobrancas.map((f) => ({ ...f, categoria: 'taxas' }))).reduce((s, c) => s.plus(c.valor), D(0))
  const lucro = p.minus(total)
  const base = custos.reduce((s, c) => s.plus(c.valor), D(0))
  return {
    preco: dinheiro(p),
    lucro: dinheiro(lucro),
    margem: lucro.div(p).times(100).toFixed(4),
    total: dinheiro(total),
    taxas: dinheiro(cobrancas.reduce((s, c) => s.plus(c.valor), D(x.tarifaFixa))),
    base: dinheiro(base),
    markup: base.gt(0) ? p.div(base).minus(1).times(100).toFixed(4) : null,
    componentes: [...custos, ...cobrancas].map((c) => ({
      id: c.id,
      nome: c.nome,
      valor: dinheiro(c.valor),
      participacao: c.valor.div(p).times(100).toFixed(4),
    })),
    atingeMeta: lucro.div(p).times(100).gte(D(x.meta).minus('0.000000001')),
  }
}

export interface LimiteDeDesconto {
  valor: string
  /** truncado em duas casas para nunca passar do limite por arredondamento */
  percentual: string
}

export interface Calculo {
  versao: string
  /** o preço de venda sugerido, já com o arredondamento comercial */
  sugerido: string
  /** o menor preço que atinge a meta, sem arredondar */
  minimo: string
  /** o preço que só cobre os custos (margem zero) */
  equilibrio: string
  resultado: Avaliacao
  /** o preço que a pessoa cobra hoje — `null` se ainda não informado */
  atual: Avaliacao | null
  /** quanto o preço atual pode descer sem perder a meta */
  descontoMaximo: LimiteDeDesconto | null
  /** quanto o preço atual pode descer sem dar prejuízo */
  descontoAteEquilibrio: LimiteDeDesconto | null
  diferenca: string | null
  avisos: string[]
  premissas: Premissas
}

export function calcular(entrada: Premissas): Calculo {
  const x = validarPremissas(entrada)
  const minimo = resolverPreco(x)
  const sugerido = arredondarPreco(minimo, x)
  const equilibrio = resolverPreco(x, '0')
  const resultado = avaliar(x, sugerido.toFixed(2))
  const atual = D(x.preco).gt(0) ? avaliar(x, x.preco) : null
  const desconto = (piso: Decimal): LimiteDeDesconto | null =>
    atual && D(atual.preco).gte(piso)
      ? {
          valor: dinheiro(D(atual.preco).minus(piso)),
          percentual: D(atual.preco).minus(piso).div(atual.preco).times(100).toDecimalPlaces(2, Decimal.ROUND_FLOOR).toFixed(2),
        }
      : null

  const avisos: string[] = []
  if (!x.tributoConferido) avisos.push('Tributos não confirmados. A simulação pode subestimar seus custos.')
  if (x.custos.some((c) => c.frequencia === 'mensal')) {
    avisos.push('O rateio de despesas mensais depende do volume previsto, não de vendas realizadas.')
  }
  if (!resultado.atingeMeta) avisos.push('O arredondamento cruzou uma faixa de tarifa. A margem após o ajuste ficou abaixo da meta.')
  if (x.cobrancas.some((f) => f.tipo === 'faixa')) {
    avisos.push('Tarifas por faixa podem criar intervalos com margens diferentes. Confira o resultado exato do desconto escolhido.')
  }
  if (D(x.custo).eq(0)) avisos.push('Custo do produto zerado: confirme se foi informado corretamente.')

  return {
    versao: VERSAO_DO_MOTOR,
    sugerido: dinheiro(sugerido),
    minimo: dinheiro(minimo),
    equilibrio: dinheiro(equilibrio),
    resultado,
    atual,
    descontoMaximo: desconto(minimo),
    descontoAteEquilibrio: desconto(equilibrio),
    diferenca: atual ? dinheiro(sugerido.minus(atual.preco)) : null,
    avisos,
    premissas: x,
  }
}

/** O preço por unidade depois de um desconto — em kit, o desconto vale sobre o kit inteiro. */
export function precoComDesconto(preco: string, tipo: 'percentual' | 'valor', desconto: string, unidades = '1'): string {
  const p = numero(preco, 'Preço').times(numero(unidades, 'Unidades'))
  const v = numero(desconto, 'Desconto')
  const resultado = tipo === 'percentual' ? p.times(D(1).minus(v.div(100))) : p.minus(v)
  exigir(resultado.gt(0), 'O desconto precisa deixar um preço maior que zero.')
  return dinheiro(resultado.div(unidades))
}

/**
 * A sobra estimada de uma venda registrada.
 *
 * A sobra por unidade é multiplicada pela quantidade ANTES de arredondar — se
 * arredondasse a unitária primeiro, dez unidades errariam até dez centavos.
 */
export function estimarResultadoDaVenda(x: Premissas, preco: string, quantidade: string): string {
  validarPremissas(x)
  const p = numero(preco, 'Preço')
  const q = numero(quantidade, 'Quantidade')
  exigir(p.gt(0) && q.gt(0), 'Preço e quantidade devem ser maiores que zero.')
  return p.minus(custoTotal(x, p)).times(q).toFixed(2)
}
