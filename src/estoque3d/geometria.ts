/**
 * Da quantidade numa posição para as caixinhas na cena — PLANO-ESTOQUE-3D.md.
 *
 * Contas puras (testadas em `testes/geometria3d.test.ts`), sem three.js: a cena
 * só aplica as matrizes. A quantidade vira um número VISUAL de unidades, com
 * teto por forma — 300 camisetas não são 300 cabides desenhados, são a arara
 * cheia e o número no rótulo. Cada produto ocupa colunas contíguas da posição,
 * para se ver onde termina um e começa o outro.
 */

import { MEDIDAS, type Tema, type TipoDeEstrutura } from '@shared/enderecos'

export type Forma = 'caixa' | 'roupa' | 'dobrado' | 'carga' | 'produto'

export const ALTURA_DO_PALETE = 0.12

interface Grade { colunas: number; fileiras: number; camadas: number }

/** Como cada tema desenha a mercadoria em cada tipo de estrutura. */
export function formaDa(tema: Tema, tipo: TipoDeEstrutura): Forma {
  if (tema === 'loja_fofa') return tipo === 'expositor' ? 'roupa' : tipo === 'estante' || tipo === 'mesa' ? 'dobrado' : 'caixa'
  if (tema === 'armazem') return tipo === 'expositor' ? 'carga' : 'caixa'
  return tipo === 'expositor' || tipo === 'estante' ? 'produto' : 'caixa'
}

const GRADES: Record<Forma, Grade> = {
  caixa: { colunas: 3, fileiras: 1, camadas: 2 },
  roupa: { colunas: 7, fileiras: 1, camadas: 1 },
  dobrado: { colunas: 3, fileiras: 1, camadas: 4 },
  /* um palete: 2 × 2 de base, 3 de altura */
  carga: { colunas: 2, fileiras: 2, camadas: 3 },
  produto: { colunas: 4, fileiras: 1, camadas: 2 },
}

export const tetoDa = (forma: Forma): number => {
  const g = GRADES[forma]
  return g.colunas * g.fileiras * g.camadas
}

export interface Unidade {
  produtoId: string
  /** centro, relativo ao centro da posição na superfície do nível (x ao longo do vão, y para cima, z para a frente) */
  x: number
  y: number
  z: number
  largura: number
  altura: number
  profundidade: number
}

/**
 * Quantas unidades cada produto ganha: o teto é dividido pela quantidade, e
 * todo produto presente aparece com pelo menos uma — um produto que some do
 * desenho por ser pouco vira um erro de contagem de quem olha.
 */
export function repartir(ocupantes: Array<{ produtoId: string; quantidade: number }>, teto: number): Array<{ produtoId: string; unidades: number }> {
  const presentes = ocupantes.filter((o) => o.quantidade > 0)
  if (!presentes.length) return []
  const pedidas = presentes.map((o) => ({ produtoId: o.produtoId, unidades: Math.max(1, Math.ceil(o.quantidade)) }))
  const total = pedidas.reduce((s, p) => s + p.unidades, 0)
  if (total <= teto) return pedidas
  const lugares = Math.max(teto, presentes.length)
  const base = pedidas.map((p) => ({ produtoId: p.produtoId, unidades: 1 }))
  let sobra = lugares - presentes.length
  /* o resto vai por proporção, maior quantidade primeiro */
  const ordem = pedidas.map((p, i) => ({ i, peso: (p.unidades - 1) / Math.max(1, total - presentes.length) })).sort((a, b) => b.peso - a.peso)
  const extras = ordem.map((o) => ({ i: o.i, n: Math.floor(o.peso * sobra) }))
  for (const e of extras) { base[e.i]!.unidades += e.n; sobra -= e.n }
  for (let k = 0; sobra > 0 && ordem.length; k = (k + 1) % ordem.length) {
    const i = ordem[k]!.i
    if (base[i]!.unidades < pedidas[i]!.unidades) { base[i]!.unidades++; sobra-- } else if (ordem.every((o) => base[o.i]!.unidades >= pedidas[o.i]!.unidades)) break
  }
  return base
}

/**
 * As unidades de uma posição. A célula é o vão × a profundidade × a altura do
 * nível, com folga; a roupa pendura do varão (no alto do nível) para baixo, o
 * resto empilha da superfície para cima.
 */
export function unidadesDaPosicao(tema: Tema, tipo: TipoDeEstrutura, ocupantes: Array<{ produtoId: string; quantidade: number }>): Unidade[] {
  const forma = formaDa(tema, tipo)
  const g = GRADES[forma]
  const m = MEDIDAS[tipo]
  const largura = m.vao * 0.86
  const profundidade = m.profundidade * 0.78
  /* a carga do armazém vai em cima de um palete: a pilha começa nele e fica mais baixa */
  const palete = forma === 'carga' ? ALTURA_DO_PALETE : 0
  const altura = Math.min(m.nivel, tipo === 'mesa' || tipo === 'balcao' ? 0.32 : m.nivel) * 0.84 - palete
  const porProduto = repartir(ocupantes, tetoDa(forma))

  const passoX = largura / g.colunas
  const passoZ = profundidade / g.fileiras
  const passoY = altura / g.camadas
  const unidades: Unidade[] = []
  let i = 0
  for (const { produtoId, unidades: n } of porProduto) {
    for (let k = 0; k < n; k++, i++) {
      /* coluna por coluna: o produto ocupa colunas inteiras, de baixo para cima e de trás para a frente */
      const porColuna = g.fileiras * g.camadas
      const coluna = Math.floor(i / porColuna)
      if (coluna >= g.colunas) break
      const dentro = i % porColuna
      const camada = Math.floor(dentro / g.fileiras)
      const fileira = dentro % g.fileiras
      const x = -largura / 2 + passoX * (coluna + 0.5)
      const z = -profundidade / 2 + passoZ * (fileira + 0.5)
      if (forma === 'roupa') {
        const comprimento = m.nivel * 0.72
        unidades.push({ produtoId, x, y: m.nivel * 0.9 - 0.05 - comprimento / 2, z: 0, largura: passoX * 0.5, altura: comprimento, profundidade: profundidade * 0.9 })
      } else {
        const alturaDaUnidade = passoY * (forma === 'dobrado' ? 0.82 : 0.92)
        unidades.push({
          produtoId, x, y: palete + passoY * camada + alturaDaUnidade / 2 + 0.01, z,
          largura: passoX * (forma === 'produto' ? 0.78 : 0.9), altura: alturaDaUnidade, profundidade: passoZ * (forma === 'produto' ? 0.6 : 0.9),
        })
      }
    }
  }
  return unidades
}

/** Um palete debaixo da carga — só onde há carga. */
export const temPalete = (tema: Tema, tipo: TipoDeEstrutura): boolean => formaDa(tema, tipo) === 'carga'
