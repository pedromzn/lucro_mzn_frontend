/**
 * Os pontos fixos do espaço — PLANO-ESTOQUE-3D.md, fatia 4.
 *
 * Saem das ZONAS da planta, não de coordenadas fixas: a doca fica ao lado do
 * recebimento, a saída ao lado do caixa, e o monte "a guardar" no chão do
 * recebimento — em qualquer tema e com a planta que a pessoa montar.
 */

import { centroDaPosicao, centroDaZona, type Ambiente, type Endereco, type Estrutura, type Zona } from '@shared/enderecos'
import type { Lugares, Ponto } from './voos'

/** O centro da posição, um pouco acima da superfície — de onde a caixa decola e onde ela pousa. */
export function centroNoMundo(e: Estrutura, nivel: number, vao: number): Ponto {
  const c = centroDaPosicao(e, nivel, vao)
  return { x: c.x, y: c.y + 0.15, z: c.z }
}

/** Leva o ponto em direção a uma parede, ficando dentro do espaço. */
function naParede(p: { x: number; z: number }, ambiente: Pick<Ambiente, 'largura' | 'profundidade'>, lado: 'fundo' | 'frente'): Ponto {
  const z = lado === 'fundo' ? -ambiente.profundidade / 2 + 0.6 : ambiente.profundidade / 2 - 0.6
  return { x: Math.max(-ambiente.largura / 2 + 0.8, Math.min(ambiente.largura / 2 - 0.8, p.x)), y: 0.3, z }
}

const zonaOu = (estruturas: Estrutura[], zonas: Zona[]): { x: number; z: number } | undefined => {
  for (const z of zonas) {
    const c = centroDaZona(estruturas, z)
    if (c) return c
  }
  return undefined
}

/**
 * O monte "a guardar": no chão, perto do recebimento e para dentro do espaço,
 * onde não costuma haver estrutura. Sem recebimento na planta, no canto do fundo.
 */
export function pontoDoChao(estruturas: Estrutura[], ambiente: Pick<Ambiente, 'largura' | 'profundidade'>): Ponto {
  const r = centroDaZona(estruturas, 'recebimento')
  if (!r) return { x: ambiente.largura / 2 - 1.6, y: 0, z: -ambiente.profundidade / 2 + 1.8 }
  const paraDentro = Math.hypot(r.x, r.z) > 0.1 ? 1.4 / Math.hypot(r.x, r.z) : 0
  return {
    x: Math.max(-ambiente.largura / 2 + 0.8, Math.min(ambiente.largura / 2 - 0.8, r.x - r.x * paraDentro)),
    y: 0,
    z: Math.max(-ambiente.profundidade / 2 + 0.8, Math.min(ambiente.profundidade / 2 - 0.8, r.z - r.z * paraDentro)),
  }
}

export function lugaresDoEspaco(estruturas: Estrutura[], ambiente: Pick<Ambiente, 'largura' | 'profundidade'>): Lugares {
  const porId = new Map(estruturas.map((e) => [e.id, e]))
  const chao = pontoDoChao(estruturas, ambiente)
  return {
    posicao: (e: Endereco) => {
      const est = porId.get(e.estruturaId)
      return est && e.nivel < est.niveis && e.vao < est.vaos ? centroNoMundo(est, e.nivel, e.vao) : null
    },
    chao: { ...chao, y: 0.3 },
    entrada: naParede(zonaOu(estruturas, ['recebimento', 'deposito']) ?? { x: 0, z: 0 }, ambiente, 'fundo'),
    saida: naParede(zonaOu(estruturas, ['expedicao', 'loja']) ?? { x: 0, z: 0 }, ambiente, 'frente'),
  }
}
