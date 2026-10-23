/** Navegação da Assistente — PLANO-ESTOQUE-3D.md, evolução 6.
 * A grade nasce da planta editável. O destino é o corredor ao alcance da
 * posição, nunca o centro da estante; não inventamos passagem se ela foi fechada.
 */
import { retanguloDa, type Estrutura, type Tema } from '@shared/enderecos'
import type { Ponto } from './voos'

export interface Dimensoes { largura: number; profundidade: number }
export const distancia = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.z - b.z)
export const portaDaRua = (a: Dimensoes): Ponto => ({ x: 0, y: 0.8, z: a.profundidade / 2 + 0.65 })
export const retiradaNaRua = (a: Dimensoes): Ponto => ({ x: 0, y: 0.95, z: a.profundidade / 2 + 2.17 })
export const descansoDaAssistente = (a: Dimensoes): Ponto => ({ x: -1.1, y: 0, z: a.profundidade / 2 + 0.65 })

export function criarNavegacao(ambiente: Dimensoes, estruturas: Estrutura[], tema?: Tema) {
  const margem = 0.23
  const passo = 0.28
  const x0 = -ambiente.largura / 2 + margem, z0 = -ambiente.profundidade / 2 + margem
  const nx = Math.floor((ambiente.largura - margem * 2) / passo) + 1
  const nz = Math.floor((ambiente.profundidade + 1.8 - margem) / passo) + 1
  const retangulos = estruturas.map(retanguloDa)
  if (tema === 'shopping') {
    const deposito = estruturas.filter(e => e.zona === 'deposito').map(retanguloDa)
    if (deposito.length) {
      const z = Math.max(Math.min(ambiente.profundidade / 2, Math.max(...deposito.map(r => r.z1)) + 0.5) + 0.15, -ambiente.profundidade / 2 + 3.1)
      const passagem = ambiente.largura / 2 - 1.6
      retangulos.push({ x0: -ambiente.largura / 2, x1: passagem - 0.6, z0: z - 0.05, z1: z + 0.05 }, { x0: passagem + 0.6, x1: ambiente.largura / 2, z0: z - 0.05, z1: z + 0.05 })
    }
  }
  if (tema === 'armazem') {
    const x = ambiente.largura / 2 - 1.4, z = ambiente.profundidade / 2 - 3
    retangulos.push({ x0: x - 0.6, x1: x + 0.6, z0: z - 1.55, z1: z + 0.7 })
  }
  // A passagem desvia também dos postes do pórtico e dos vasos do cenário.
  for (const x of [-1.5, 1.5]) retangulos.push({ x0: x - 0.04, x1: x + 0.04, z0: ambiente.profundidade / 2 + 0.04, z1: ambiente.profundidade / 2 + 0.12 })
  const vasos = tema === 'loja_fofa'
    ? [[-ambiente.largura / 2 + 0.6, ambiente.profundidade / 2 - 0.7], [ambiente.largura / 2 - 0.6, -ambiente.profundidade / 2 + 0.7]]
    : tema === 'shopping' ? [[-ambiente.largura / 2 + 0.5, ambiente.profundidade / 2 - 0.9], [ambiente.largura / 2 - 0.5, ambiente.profundidade / 2 - 0.9]] : []
  for (const [x, z] of vasos) retangulos.push({ x0: x! - 0.2, x1: x! + 0.2, z0: z! - 0.2, z1: z! + 0.2 })
  const obstaculos = retangulos.map(r => ({ x0: r.x0 - margem, x1: r.x1 + margem, z0: r.z0 - margem, z1: r.z1 + margem }))
  const livre = (p: Ponto) => p.x >= x0 && p.x <= ambiente.largura / 2 - margem && p.z >= z0 && p.z <= ambiente.profundidade / 2 + 1.8 && !obstaculos.some(r => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1)
  const ponto = (i: number): Ponto => ({ x: x0 + (i % nx) * passo, y: 0, z: z0 + Math.floor(i / nx) * passo })
  const livres = new Uint8Array(nx * nz)
  for (let i = 0; i < livres.length; i++) livres[i] = livre(ponto(i)) ? 1 : 0
  const segmentoLivre = (a: Ponto, b: Ponto) => {
    const n = Math.max(1, Math.ceil(distancia(a, b) / 0.07))
    for (let k = 0; k <= n; k++) if (!livre({ x: a.x + (b.x - a.x) * k / n, y: 0, z: a.z + (b.z - a.z) * k / n })) return false
    return true
  }
  const caminho = (origem: Ponto, destino: Ponto): Ponto[] | null => {
    let inicio = -1, perto = Infinity, melhorDistancia = Infinity
    for (let i = 0; i < livres.length; i++) if (livres[i]) {
      const p = ponto(i), d = distancia(p, origem)
      /* acima de 0,8 m a partida é recusada logo abaixo: conferir a passagem até lá seria só custo */
      if (d <= 0.8 && d < perto && segmentoLivre(origem, p)) { inicio = i; perto = d }
      melhorDistancia = Math.min(melhorDistancia, distancia(p, destino))
    }
    if (inicio < 0 || perto > 0.8 || melhorDistancia > 1.7) return null
    const pais = new Int32Array(livres.length).fill(-2), fila = new Int32Array(livres.length)
    let lido = 0, fim = 1, alvo = inicio, nota = Infinity
    fila[0] = inicio; pais[inicio] = -1
    while (lido < fim) {
      const i = fila[lido++]!, p = ponto(i), d = distancia(p, destino)
      if (d < nota) { nota = d; alvo = i }
      const x = i % nx, z = Math.floor(i / nx)
      for (const j of [x > 0 ? i - 1 : -1, x < nx - 1 ? i + 1 : -1, z > 0 ? i - nx : -1, z < nz - 1 ? i + nx : -1]) {
        if (j < 0 || !livres[j] || pais[j] !== -2 || !segmentoLivre(p, ponto(j))) continue
        pais[j] = i; fila[fim++] = j
      }
    }
    if (nota > melhorDistancia + 0.38 || nota > 1.7) return null
    const pontos: Ponto[] = []
    for (let i = alvo; i >= 0; i = pais[i]!) pontos.push(ponto(i))
    pontos.reverse(); pontos.unshift({ ...origem, y: 0 })
    // O atalho é conferido contra a geometria, inclusive nos cantos entre células.
    const simples = [pontos[0]!]
    for (let i = 0; i < pontos.length - 1;) {
      /* estica para a frente enquanto houver visada: uma conferência por ponto, e não do fim para trás (quadrático) */
      let j = i + 1
      while (j < pontos.length - 1 && segmentoLivre(pontos[i]!, pontos[j + 1]!)) j++
      simples.push(pontos[j]!); i = j
    }
    return simples
  }
  return { caminho, livre, segmentoLivre }
}

export function comprimentoDoCaminho(pontos: Ponto[]): number {
  return pontos.slice(1).reduce((s, p, i) => s + distancia(pontos[i]!, p), 0)
}
export function percorrerCaminho(pontos: Ponto[], metros: number): { ponto: Ponto; giro: number } {
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1]!, b = pontos[i]!, d = distancia(a, b)
    if (metros <= d || i === pontos.length - 1) {
      const t = d ? Math.min(1, Math.max(0, metros / d)) : 1
      return { ponto: { x: a.x + (b.x - a.x) * t, y: 0, z: a.z + (b.z - a.z) * t }, giro: Math.atan2(b.x - a.x, b.z - a.z) }
    }
    metros -= d
  }
  return { ponto: pontos[0] ?? { x: 0, y: 0, z: 0 }, giro: 0 }
}
