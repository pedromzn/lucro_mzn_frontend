/**
 * O estoque com endereço — PLANO-ESTOQUE-3D.md, fatia 1.
 *
 * As regras puras que o servidor aplica e o painel desenha, com o mesmo código:
 *
 * - **O saldo do produto continua sendo a verdade (E1).** Parte dele pode estar
 *   em POSIÇÕES (estrutura · nível · vão); o resto está "a guardar", no chão do
 *   recebimento. A soma das posições nunca passa do saldo — é o que
 *   `planoDeSaida` garante numa saída e o `verify:enderecos` confere no banco.
 * - **A estrutura tem um tipo genérico** (estante, expositor, vitrine, mesa,
 *   balcão) e cada TEMA o desenha do seu jeito: o expositor é arara na lojinha,
 *   porta-paletes no armazém e gôndola no shopping. As medidas são do tipo, não
 *   do tema — por isso trocar de tema é trocar de roupa, sem perder a planta nem
 *   o que está guardado (E4).
 * - **Coordenadas em metros**, com o centro do ambiente na origem: `x` para a
 *   direita, `z` para a frente (a porta da loja, a doca de saída). A rotação é
 *   em graus, de 90 em 90.
 */

import { z } from 'zod'
import { D } from './preco.js'
import { decimalDeEstoque, enderecoDoMovimento } from './estoque.js'

export const TEMAS = ['loja_fofa', 'armazem', 'shopping'] as const
export type Tema = (typeof TEMAS)[number]

export const NOMES_DOS_TEMAS: Record<Tema, { nome: string; descricao: string }> = {
  loja_fofa: { nome: 'Lojinha fofa', descricao: 'Araras com cabides, prateleiras de dobrados e o caixa no balcão, em tons pastel.' },
  armazem: { nome: 'Armazém', descricao: 'Porta-paletes, caixas de papelão, docas de carga e faixas no chão.' },
  shopping: { nome: 'Loja de shopping', descricao: 'Vitrine de vidro, gôndolas, balcão iluminado e o depósito nos fundos.' },
}

/** Por onde a mercadoria passa: chega no recebimento, fica no depósito, vai para a loja, sai pela expedição (o caixa). */
export const ZONAS = ['recebimento', 'deposito', 'loja', 'expedicao'] as const
export type Zona = (typeof ZONAS)[number]

export const NOMES_DAS_ZONAS: Record<Zona, string> = {
  recebimento: 'Recebimento',
  deposito: 'Depósito',
  loja: 'Loja',
  expedicao: 'Caixa e expedição',
}

export const TIPOS_DE_ESTRUTURA = ['estante', 'expositor', 'vitrine', 'mesa', 'balcao'] as const
export type TipoDeEstrutura = (typeof TIPOS_DE_ESTRUTURA)[number]

export interface MedidasDoTipo {
  /** largura de um vão, em metros */
  vao: number
  profundidade: number
  /** a superfície do nível `i` fica em `base + i × nivel`: é onde a mercadoria se apoia */
  nivel: number
  base: number
  niveis: { minimo: number; maximo: number; padrao: number }
  vaos: { minimo: number; maximo: number; padrao: number }
}

export const MEDIDAS: Record<TipoDeEstrutura, MedidasDoTipo> = {
  estante: { vao: 1, profundidade: 0.5, nivel: 0.42, base: 0.12, niveis: { minimo: 1, maximo: 6, padrao: 4 }, vaos: { minimo: 1, maximo: 12, padrao: 3 } },
  expositor: { vao: 0.9, profundidade: 0.9, nivel: 0.6, base: 0.15, niveis: { minimo: 1, maximo: 4, padrao: 2 }, vaos: { minimo: 1, maximo: 12, padrao: 3 } },
  vitrine: { vao: 0.9, profundidade: 0.6, nivel: 0.35, base: 0.55, niveis: { minimo: 1, maximo: 3, padrao: 2 }, vaos: { minimo: 1, maximo: 8, padrao: 2 } },
  /* mesa e balcão: a base é o tampo — com base 0 a mercadoria ficaria no chão, embaixo dele */
  mesa: { vao: 0.8, profundidade: 0.8, nivel: 0.4, base: 0.75, niveis: { minimo: 1, maximo: 1, padrao: 1 }, vaos: { minimo: 1, maximo: 6, padrao: 2 } },
  balcao: { vao: 0.8, profundidade: 0.6, nivel: 0.3, base: 0.95, niveis: { minimo: 1, maximo: 1, padrao: 1 }, vaos: { minimo: 1, maximo: 6, padrao: 2 } },
}

/** O nome de cada tipo em cada tema — o mesmo dado, a palavra de quem trabalha ali. */
export const NOMES_DOS_TIPOS: Record<Tema, Record<TipoDeEstrutura, string>> = {
  loja_fofa: { estante: 'Prateleira', expositor: 'Arara', vitrine: 'Cesto', mesa: 'Mesa expositora', balcao: 'Balcão do caixa' },
  armazem: { estante: 'Estante', expositor: 'Porta-paletes', vitrine: 'Gaiola', mesa: 'Bancada', balcao: 'Mesa de expedição' },
  shopping: { estante: 'Estante', expositor: 'Gôndola', vitrine: 'Vitrine', mesa: 'Ilha', balcao: 'Balcão' },
}

export const LIMITES_DO_AMBIENTE = { minimo: 6, maximo: 60, estruturas: 200 } as const

export const enderecoSchema = enderecoDoMovimento
export type Endereco = z.infer<typeof enderecoSchema>

const metros = z.number().finite()

export const estruturaSchema = z.object({
  tipo: z.enum(TIPOS_DE_ESTRUTURA),
  zona: z.enum(ZONAS),
  nome: z.string().trim().min(1, 'Dê um nome à estrutura.').max(60),
  x: metros,
  z: metros,
  rotacao: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  niveis: z.number().int(),
  vaos: z.number().int(),
})
export type DadosDaEstrutura = z.infer<typeof estruturaSchema>
export type Estrutura = DadosDaEstrutura & { id: string }

export const ambienteSchema = z.object({
  tema: z.enum(TEMAS),
  largura: z.number().min(LIMITES_DO_AMBIENTE.minimo).max(LIMITES_DO_AMBIENTE.maximo),
  profundidade: z.number().min(LIMITES_DO_AMBIENTE.minimo).max(LIMITES_DO_AMBIENTE.maximo),
})
export type Ambiente = z.infer<typeof ambienteSchema>

export const transferenciaSchema = z.object({
  chaveDaOperacao: z.string().uuid(),
  produtoId: z.string().max(40),
  quantidade: decimalDeEstoque,
  /** `null` é o "a guardar", no chão do recebimento */
  origem: enderecoSchema.nullable(),
  destino: enderecoSchema.nullable(),
  motivo: z.string().trim().max(250).default(''),
})
export type PedidoDeTransferencia = z.infer<typeof transferenciaSchema>

export const mesmoEndereco = (a: Endereco | null, b: Endereco | null): boolean =>
  a === null || b === null ? a === b : a.estruturaId === b.estruturaId && a.nivel === b.nivel && a.vao === b.vao

/** "Arara 2 · nível 1 · vão 3" — o rótulo que o histórico guarda, para sobreviver a uma estrutura renomeada. */
export function rotuloDoEndereco(estrutura: Pick<Estrutura, 'nome' | 'niveis'>, nivel: number, vao: number): string {
  return estrutura.niveis > 1 ? `${estrutura.nome} · nível ${nivel + 1} · vão ${vao + 1}` : `${estrutura.nome} · vão ${vao + 1}`
}

/** O que impede a estrutura de existir assim (níveis, vãos, fora do espaço), ou `null` se ela cabe. */
export function conferirEstrutura(e: DadosDaEstrutura, ambiente: Pick<Ambiente, 'largura' | 'profundidade'>): string | null {
  const m = MEDIDAS[e.tipo]
  if (e.niveis < m.niveis.minimo || e.niveis > m.niveis.maximo) return `Use de ${m.niveis.minimo} a ${m.niveis.maximo} nível(is) neste tipo de estrutura.`
  if (e.vaos < m.vaos.minimo || e.vaos > m.vaos.maximo) return `Use de ${m.vaos.minimo} a ${m.vaos.maximo} vão(s) neste tipo de estrutura.`
  const r = retanguloDa(e)
  const folga = 0.001
  if (r.x0 < -ambiente.largura / 2 - folga || r.x1 > ambiente.largura / 2 + folga || r.z0 < -ambiente.profundidade / 2 - folga || r.z1 > ambiente.profundidade / 2 + folga) {
    return 'A estrutura sai do espaço. Mova para dentro ou aumente o ambiente.'
  }
  return null
}

export interface Retangulo { x0: number; x1: number; z0: number; z1: number }

/** A pegada da estrutura no chão, já girada. */
export function retanguloDa(e: Pick<DadosDaEstrutura, 'tipo' | 'x' | 'z' | 'rotacao' | 'vaos'>): Retangulo {
  const m = MEDIDAS[e.tipo]
  const largura = m.vao * e.vaos
  const deitada = e.rotacao === 90 || e.rotacao === 270
  const w = deitada ? m.profundidade : largura
  const p = deitada ? largura : m.profundidade
  return { x0: e.x - w / 2, x1: e.x + w / 2, z0: e.z - p / 2, z1: e.z + p / 2 }
}

/** Duas estruturas ocupando o mesmo chão — encostar pode, entrar uma na outra não. */
export function sobrepoe(a: Retangulo, b: Retangulo): boolean {
  const folga = 0.01
  return a.x0 < b.x1 - folga && b.x0 < a.x1 - folga && a.z0 < b.z1 - folga && b.z0 < a.z1 - folga
}

/**
 * A primeira vaga onde a estrutura cabe sem bater em nenhuma outra — a partir
 * das estruturas da MESMA zona (prateleira de depósito nasce junto do depósito),
 * ou do centro se a zona ainda não tem nada, para fora em passos de 25 cm.
 * `null` se o espaço está cheio.
 */
export function lugarLivre(
  nova: Omit<DadosDaEstrutura, 'x' | 'z'>,
  estruturas: Array<Pick<DadosDaEstrutura, 'tipo' | 'zona' | 'x' | 'z' | 'rotacao' | 'vaos'>>,
  ambiente: Pick<Ambiente, 'largura' | 'profundidade'>,
): { x: number; z: number } | null {
  const ocupados = estruturas.map(retanguloDa)
  const passo = 0.25
  const perto = centroDaZona(estruturas, nova.zona) ?? { x: 0, z: 0 }
  const ox = Math.round(perto.x / passo) * passo, oz = Math.round(perto.z / passo) * passo
  const alcance = Math.ceil((2 * Math.max(ambiente.largura, ambiente.profundidade)) / passo)
  for (let anel = 0; anel <= alcance; anel++) {
    for (let i = -anel; i <= anel; i++) {
      for (let j = -anel; j <= anel; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== anel) continue
        /* `|| 0`: o anel zero começa em `-0`, e `-0` não precisa ir ao servidor */
        const candidata = { ...nova, x: ox + i * passo || 0, z: oz + j * passo || 0 }
        if (conferirEstrutura(candidata, ambiente)) continue
        const r = retanguloDa(candidata)
        if (ocupados.some((o) => sobrepoe(r, o))) continue
        return { x: candidata.x, z: candidata.z }
      }
    }
  }
  return null
}

/** O ponto do mundo no centro de uma posição — usado pela cena, pela animação e pela distância da guarda. */
export function centroDaPosicao(e: Pick<DadosDaEstrutura, 'tipo' | 'x' | 'z' | 'rotacao' | 'vaos'>, nivel: number, vao: number): { x: number; y: number; z: number } {
  const m = MEDIDAS[e.tipo]
  const local = (vao + 0.5) * m.vao - (m.vao * e.vaos) / 2
  const rad = (e.rotacao * Math.PI) / 180
  return {
    x: e.x + local * Math.cos(rad),
    y: m.base + nivel * m.nivel,
    z: e.z - local * Math.sin(rad),
  }
}

/* ── a saída: de onde tirar ─────────────────────────────────────────────── */

export interface PosicaoComSaldo extends Endereco {
  zona: Zona
  quantidade: string
}

export interface LinhaDoPlano {
  /** `null` é o "a guardar" */
  endereco: Endereco | null
  /** quanto SAI dali, positivo */
  quantidade: string
}

/**
 * De onde sai uma saída do estoque (venda, perda, uso próprio, conferência para menos).
 *
 * Com endereço escolhido, sai SÓ dali — se não houver o bastante, é recusado:
 * a pessoa disse de onde tirou. Sem endereço, a ordem é a da venda numa loja:
 * primeiro o que está exposto (loja, caixa), depois o que está a guardar, por
 * último o depósito e o recebimento; dentro da zona, a posição com MENOS
 * primeiro, para esvaziar e liberar espaço. `ajuste` (conferência total) tira
 * primeiro do "a guardar", que é o que ninguém conferiu.
 */
export function planoDeSaida(entrada: {
  posicoes: PosicaoComSaldo[]
  aGuardar: string
  quantidade: string
  escolhido?: Endereco | null
  ordem?: 'venda' | 'ajuste'
}): LinhaDoPlano[] {
  const pedida = D(entrada.quantidade)
  if (!pedida.gt(0)) return []
  if (entrada.escolhido) {
    const ali = entrada.posicoes.find((p) => mesmoEndereco(p, entrada.escolhido!))
    if (!ali || D(ali.quantidade).lt(pedida)) throw new Error('Não há essa quantidade nesta posição. Escolha outra ou confira o saldo dela.')
    return [{ endereco: semZona(ali), quantidade: pedida.toFixed(6) }]
  }
  const pesoDaZona: Record<Zona, number> = entrada.ordem === 'ajuste'
    ? { recebimento: 1, deposito: 2, loja: 3, expedicao: 4 }
    : { loja: 0, expedicao: 1, deposito: 3, recebimento: 4 }
  const pesoDoChao = entrada.ordem === 'ajuste' ? -1 : 2
  const fontes = [
    ...(D(entrada.aGuardar).gt(0) ? [{ endereco: null, peso: pesoDoChao, quantidade: D(entrada.aGuardar) }] : []),
    ...entrada.posicoes.filter((p) => D(p.quantidade).gt(0)).map((p) => ({ endereco: semZona(p), peso: pesoDaZona[p.zona], quantidade: D(p.quantidade) })),
  ].sort((a, b) => a.peso - b.peso || a.quantidade.cmp(b.quantidade))

  const plano: LinhaDoPlano[] = []
  let falta = pedida
  for (const f of fontes) {
    if (!falta.gt(0)) break
    const tira = f.quantidade.lt(falta) ? f.quantidade : falta
    plano.push({ endereco: f.endereco, quantidade: tira.toFixed(6) })
    falta = falta.minus(tira)
  }
  if (falta.gt(0)) throw new Error('A quantidade supera o estoque disponível. Confira o saldo antes de continuar.')
  return plano
}

const semZona = (p: Endereco): Endereco => ({ estruturaId: p.estruturaId, nivel: p.nivel, vao: p.vao })

/* ── a guarda: onde pôr o que chegou ───────────────────────────────────── */

export interface Ocupacao extends Endereco {
  produtoId: string
  categoria: string
  quantidade: string
}

export interface Sugestao {
  endereco: Endereco
  rotulo: string
  motivo: string
  pontos: number
}

/**
 * Onde guardar o que chegou — o *putaway* do Warehouse Theatre, com as regras
 * de uma loja pequena: junto do mesmo produto, depois numa posição vazia perto
 * de produtos da mesma categoria, preferindo o depósito, as prateleiras baixas
 * e o que fica perto do recebimento. Posição com OUTRO produto vem por último:
 * mistura é o que faz a contagem errar.
 */
export function sugerirGuarda(entrada: {
  produtoId: string
  categoria: string
  estruturas: Estrutura[]
  ocupacao: Ocupacao[]
  /** de onde a mercadoria sai: o centro do recebimento, ou o chão onde está */
  origem?: { x: number; z: number }
  limite?: number
}): Sugestao[] {
  const porPosicao = new Map<string, Ocupacao[]>()
  for (const o of entrada.ocupacao) {
    if (!D(o.quantidade).gt(0)) continue
    const k = chaveDoEndereco(o)
    porPosicao.set(k, [...(porPosicao.get(k) ?? []), o])
  }
  const categoriaNaEstrutura = new Set(entrada.ocupacao.filter((o) => o.categoria === entrada.categoria).map((o) => o.estruturaId))
  const origem = entrada.origem ?? centroDaZona(entrada.estruturas, 'recebimento')

  const sugestoes: Sugestao[] = []
  for (const e of entrada.estruturas) {
    if (e.tipo === 'balcao') continue
    for (let nivel = 0; nivel < e.niveis; nivel++) {
      for (let vao = 0; vao < e.vaos; vao++) {
        const ali = porPosicao.get(chaveDoEndereco({ estruturaId: e.id, nivel, vao })) ?? []
        const mesmo = ali.some((o) => o.produtoId === entrada.produtoId)
        const outros = ali.some((o) => o.produtoId !== entrada.produtoId)
        let pontos = 0
        let motivo: string
        if (mesmo) { pontos += 100; motivo = 'Já guarda este produto' }
        else if (!outros) { pontos += 40; motivo = categoriaNaEstrutura.has(e.id) ? 'Vazia, junto da mesma categoria' : 'Posição vazia' }
        else { pontos -= 30; motivo = 'Divide espaço com outro produto' }
        if (!mesmo && !outros && categoriaNaEstrutura.has(e.id)) pontos += 25
        if (e.zona === 'deposito') pontos += 15
        else if (e.zona === 'loja') pontos += 8
        else if (e.zona === 'expedicao') pontos -= 10
        pontos -= nivel * 3
        if (origem) {
          const c = centroDaPosicao(e, nivel, vao)
          pontos -= Math.hypot(c.x - origem.x, c.z - origem.z) * 0.8
        }
        sugestoes.push({ endereco: { estruturaId: e.id, nivel, vao }, rotulo: rotuloDoEndereco(e, nivel, vao), motivo, pontos: Math.round(pontos * 10) / 10 })
      }
    }
  }
  return sugestoes.sort((a, b) => b.pontos - a.pontos).slice(0, entrada.limite ?? 3)
}

export const chaveDoEndereco = (e: Endereco): string => `${e.estruturaId}:${e.nivel}:${e.vao}`

/** O centro do chão de uma zona — de onde a caixa sai na animação e a distância da guarda é medida. */
export function centroDaZona(estruturas: Pick<Estrutura, 'zona' | 'x' | 'z'>[], zona: Zona): { x: number; z: number } | undefined {
  const daZona = estruturas.filter((e) => e.zona === zona)
  if (!daZona.length) return undefined
  return { x: daZona.reduce((s, e) => s + e.x, 0) / daZona.length, z: daZona.reduce((s, e) => s + e.z, 0) / daZona.length }
}

/* ── as plantas prontas ─────────────────────────────────────────────────── */

export interface Planta {
  ambiente: Ambiente
  estruturas: DadosDaEstrutura[]
}

/**
 * A planta com que cada tema começa — a pessoa ajusta depois. Cresce com o
 * número de categorias (uma fileira a mais a cada duas ou três), e respeita a
 * mesma conferência do editor: nada se sobrepõe, nada sai do ambiente.
 */
export function plantaPadrao(tema: Tema, quantasCategorias: number): Planta {
  const n = Math.max(1, Math.min(12, quantasCategorias))
  if (tema === 'armazem') return plantaDoArmazem(n)
  if (tema === 'shopping') return plantaDoShopping(n)
  return plantaDaLojinha(n)
}

const estrutura = (tipo: TipoDeEstrutura, zona: Zona, nome: string, x: number, zz: number, rotacao: 0 | 90 | 180 | 270, vaos?: number, niveis?: number): DadosDaEstrutura => ({
  tipo, zona, nome, x, z: zz, rotacao, vaos: vaos ?? MEDIDAS[tipo].vaos.padrao, niveis: niveis ?? MEDIDAS[tipo].niveis.padrao,
})

function plantaDaLojinha(n: number): Planta {
  const araras = Math.min(6, Math.max(2, Math.ceil(n / 2) + 1))
  const prateleiras = Math.min(4, Math.max(2, Math.ceil(n / 3) + 1))
  /* a parede do fundo precisa caber as prateleiras (3,2 m cada) e o salão, as araras */
  const largura = Math.max(10, araras * 1.6 + 3, prateleiras * 3.2 + 0.6)
  const profundidade = 9
  const e: DadosDaEstrutura[] = []
  /* araras em duas fileiras no salão, viradas para quem entra */
  const porFileira = Math.ceil(araras / 2)
  for (let i = 0; i < araras; i++) {
    const fileira = i < porFileira ? 0 : 1
    const col = fileira === 0 ? i : i - porFileira
    const nesta = fileira === 0 ? porFileira : araras - porFileira
    const x = (col - (nesta - 1) / 2) * 2.4
    e.push(estrutura('expositor', 'loja', `Arara ${i + 1}`, x, fileira === 0 ? 1.6 : -0.4, 0, 2, 2))
  }
  e.push(estrutura('mesa', 'loja', 'Mesa de dobrados', -largura / 2 + 1.6, 3.2, 0, 2))
  e.push(estrutura('vitrine', 'loja', 'Cesto de acessórios', largura / 2 - 1.8, 3.2, 0, 2, 1))
  e.push(estrutura('balcao', 'expedicao', 'Balcão do caixa', largura / 2 - 1.4, 1.2, 90, 2))
  /* a parede do fundo é o depósito: prateleiras de dobrados */
  for (let i = 0; i < prateleiras; i++) {
    e.push(estrutura('estante', 'deposito', `Prateleira ${i + 1}`, -largura / 2 + 1.7 + i * 3.2, -profundidade / 2 + 0.3, 0, 3, 4))
  }
  e.push(estrutura('mesa', 'recebimento', 'Mesa de chegada', largura / 2 - 1.2, -profundidade / 2 + 1.6, 0, 2))
  return { ambiente: { tema: 'loja_fofa', largura: round(largura), profundidade }, estruturas: e }
}

function plantaDoArmazem(n: number): Planta {
  const ruas = Math.min(6, Math.max(2, Math.ceil(n / 2)))
  const vaos = 5
  const larguraDaRua = MEDIDAS.expositor.vao * vaos
  const largura = Math.max(16, larguraDaRua + 8)
  const profundidade = Math.max(16, ruas * 3.2 + 8)
  const e: DadosDaEstrutura[] = []
  /* porta-paletes em ruas, com corredor de 2,3 m entre elas */
  for (let i = 0; i < ruas; i++) {
    const zz = -profundidade / 2 + 4 + i * 3.2
    e.push(estrutura('expositor', 'deposito', `Rua ${String.fromCharCode(65 + i)}`, -1, zz, 0, vaos, 3))
  }
  e.push(estrutura('estante', 'deposito', 'Estante de miúdos', largura / 2 - 0.6, -profundidade / 2 + 4, 90, 4, 5))
  e.push(estrutura('mesa', 'recebimento', 'Bancada de conferência', -largura / 2 + 2, -profundidade / 2 + 1.2, 0, 3))
  e.push(estrutura('vitrine', 'recebimento', 'Gaiola de avarias', -largura / 2 + 1, -profundidade / 2 + 3, 90, 2, 1))
  e.push(estrutura('balcao', 'expedicao', 'Mesa de expedição', largura / 2 - 2.2, profundidade / 2 - 1.2, 0, 4))
  e.push(estrutura('mesa', 'expedicao', 'Separação de pedidos', -largura / 2 + 2.2, profundidade / 2 - 1.4, 0, 3))
  return { ambiente: { tema: 'armazem', largura: round(largura), profundidade: round(profundidade) }, estruturas: e }
}

function plantaDoShopping(n: number): Planta {
  const gondolas = Math.min(6, Math.max(2, Math.ceil(n / 2)))
  const largura = Math.max(12, gondolas * 2.2 + 4)
  const profundidade = 11
  const e: DadosDaEstrutura[] = []
  /* a vitrine na fachada, as gôndolas no salão, o depósito atrás de uma parede */
  e.push(estrutura('vitrine', 'loja', 'Vitrine da fachada', -largura / 4, profundidade / 2 - 0.5, 0, 3, 2))
  e.push(estrutura('vitrine', 'loja', 'Vitrine da entrada', largura / 4, profundidade / 2 - 0.5, 0, 3, 2))
  for (let i = 0; i < gondolas; i++) {
    const x = (i - (gondolas - 1) / 2) * 2.2
    e.push(estrutura('expositor', 'loja', `Gôndola ${i + 1}`, x, 1.4, 90, 2, 3))
  }
  e.push(estrutura('mesa', 'loja', 'Ilha de lançamentos', 0, 3.4, 0, 2))
  e.push(estrutura('balcao', 'expedicao', 'Balcão do caixa', largura / 2 - 1.2, 2, 90, 3))
  const estantes = Math.min(4, Math.max(2, Math.ceil(n / 3) + 1))
  for (let i = 0; i < estantes; i++) {
    e.push(estrutura('estante', 'deposito', `Estoque ${i + 1}`, -largura / 2 + 1.6 + i * 2.6, -profundidade / 2 + 0.3, 0, 2, 5))
  }
  e.push(estrutura('mesa', 'recebimento', 'Recebimento', largura / 2 - 1.4, -profundidade / 2 + 1.4, 0, 2))
  return { ambiente: { tema: 'shopping', largura: round(largura), profundidade }, estruturas: e }
}

const round = (v: number) => Math.round(v * 10) / 10
