/**
 * Os materiais da cena — PLANO-ESTOQUE-3D.md, E4.
 *
 * Um jogo por tema, criado uma vez e reaproveitado por todas as peças: material
 * é programa de GPU, e cem estantes com cem materiais iguais são cem programas.
 * Quem cria guarda e quem desmonta descarta (`descartarMateriais`).
 */

import {
  BoxGeometry, Color, DataTexture, MeshStandardMaterial, MeshToonMaterial, NearestFilter, RedFormat, type Material,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { VisualDoTema } from './temas'

/** Os três tons do toon: luz cheia, meia-luz e a sombra — que a luz de baixo pinta de lavanda. */
function gradienteFofo(): DataTexture {
  const tons = new Uint8Array([110, 190, 255])
  const textura = new DataTexture(tons, tons.length, 1, RedFormat)
  textura.minFilter = NearestFilter
  textura.magFilter = NearestFilter
  textura.needsUpdate = true
  return textura
}

export interface Materiais {
  de: (cor: string, acabamento?: 'fosco' | 'brilho' | 'metal') => Material
  vidro: Material
  invisivel: Material
  geometria: { cubo: BoxGeometry; arredondado: RoundedBoxGeometry }
  descartar: () => void
}

export function criarMateriais(visual: VisualDoTema): Materiais {
  const cache = new Map<string, Material>()
  const gradiente = visual.estilo === 'fofo' ? gradienteFofo() : null
  const de = (cor: string, acabamento: 'fosco' | 'brilho' | 'metal' = 'fosco'): Material => {
    const chave = `${cor}:${acabamento}`
    let m = cache.get(chave)
    if (!m) {
      m = gradiente
        ? new MeshToonMaterial({ color: new Color(cor), gradientMap: gradiente })
        : new MeshStandardMaterial({
          color: new Color(cor),
          /* metal de verdade precisa de um ambiente para refletir; sem ele fica preto — por isso o "metal" aqui é só um pouco */
          roughness: acabamento === 'brilho' ? 0.25 : acabamento === 'metal' ? 0.45 : 0.85,
          metalness: acabamento === 'metal' ? 0.2 : 0.02,
        })
      cache.set(chave, m)
    }
    return m
  }
  const vidro = new MeshStandardMaterial({ color: new Color('#e6f4fb'), roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false })
  /* a caixa de clique: não desenha cor nem profundidade, mas o raio a encontra */
  const invisivel = new MeshStandardMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
  const geometria = { cubo: new BoxGeometry(1, 1, 1), arredondado: new RoundedBoxGeometry(1, 1, 1, 3, 0.12) }
  return {
    de, vidro, invisivel, geometria,
    descartar: () => {
      for (const m of cache.values()) m.dispose()
      vidro.dispose()
      invisivel.dispose()
      gradiente?.dispose()
      geometria.cubo.dispose()
      geometria.arredondado.dispose()
    },
  }
}
