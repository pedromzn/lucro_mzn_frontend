/**
 * Os pontos fixos do espaço — PLANO-ESTOQUE-3D.md, fatia 4.
 *
 * O recebimento no chão acompanha a zona da planta. Entrada e retirada são
 * os pontos da rua, compartilhados com a navegação e o caminhão nos três temas.
 */

import { centroDaPosicao, centroDaZona, type Ambiente, type Endereco, type Estrutura } from '@shared/enderecos'
import type { Lugares, Ponto } from './voos'
import { portaDaRua, retiradaNaRua } from './caminhos'

/** O centro da posição, um pouco acima da superfície — de onde a caixa decola e onde ela pousa. */
export function centroNoMundo(e: Estrutura, nivel: number, vao: number): Ponto {
  const c = centroDaPosicao(e, nivel, vao)
  return { x: c.x, y: c.y + 0.15, z: c.z }
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
    entrada: portaDaRua(ambiente),
    saida: retiradaNaRua(ambiente),
  }
}
