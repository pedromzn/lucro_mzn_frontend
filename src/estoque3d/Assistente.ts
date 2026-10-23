/** A Assistente do estoque — PLANO-ESTOQUE-3D.md, evolução 7.
 * Modelo e animações fornecidos pelo usuário (Meshy). O deslocamento pertence
 * à navegação: os clipes movem o esqueleto, sem arrastar a personagem para fora
 * do corredor. Malha/texturas ficam no cache; cada palco possui seu esqueleto.
 */
import { AnimationClip, AnimationMixer, Box3, Group, Quaternion, Vector3, type AnimationAction, type Bone, type MeshStandardMaterial, type SkinnedMesh } from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

export const ALTURA_DA_ASSISTENTE = 1.85
export const ALTURA_DA_CARGA = 1.34
export interface PoseDaAssistente {
  andando: boolean
  carregando: boolean
  gesto?: 'pegar' | 'guardar'
  progresso?: number
  baixo?: boolean
  delta: number
  imediato?: boolean
}

function clipeSemDeslocamento(clipe: AnimationClip, quadril: Bone): AnimationClip {
  const copia = clipe.clone()
  copia.tracks = copia.tracks.filter(t => !t.name.startsWith('target_character.'))
  const posicao = copia.tracks.find(t => t.name === 'mixamorigHips.position')
  if (posicao) for (let i = 0; i < posicao.values.length; i += 3) {
    posicao.values[i] = quadril.position.x
    posicao.values[i + 2] = quadril.position.z
  }
  return copia
}

export function criarAssistente(arquivo: Pick<GLTF, 'scene' | 'animations'>) {
  const grupo = new Group(); grupo.name = 'Assistente'
  const modelo = clone(arquivo.scene)
  modelo.updateMatrixWorld(true)
  const quadril = modelo.getObjectByName('mixamorigHips') as Bone | undefined
  const maoEsquerda = modelo.getObjectByName('mixamorigLeftHand') as Bone | undefined
  const maoDireita = modelo.getObjectByName('mixamorigRightHand') as Bone | undefined
  if (!quadril || !maoEsquerda || !maoDireita) throw new Error('O modelo da assistente está sem as articulações necessárias.')
  const limites = new Box3().setFromObject(modelo), escala = ALTURA_DA_ASSISTENTE / (limites.max.y - limites.min.y)
  const origem = quadril.getWorldPosition(new Vector3())
  const alinhamento = new Group()
  alinhamento.scale.setScalar(escala)
  alinhamento.position.set(-origem.x * escala, -limites.min.y * escala, -origem.z * escala)
  alinhamento.add(modelo); grupo.add(alinhamento)
  const esqueletos = new Set<SkinnedMesh['skeleton']>()
  modelo.traverse(o => {
    const m = o as SkinnedMesh
    if (m.isSkinnedMesh) {
      const materiais = Array.isArray(m.material) ? m.material : [m.material]
      if (materiais.some(material => !(material as MeshStandardMaterial).map)) throw new Error('Não foi possível carregar as texturas da assistente.')
      m.castShadow = true; m.frustumCulled = false; esqueletos.add(m.skeleton) }
  })
  const mixer = new AnimationMixer(modelo)
  const clipes = new Map(arquivo.animations.map(c => [c.name, clipeSemDeslocamento(c, quadril)]))
  for (const nome of ['Repouso', 'Caminhar feminino', 'Carregar', 'Pegar e colocar']) if (!clipes.has(nome)) throw new Error(`Animação ausente na assistente: ${nome}.`)
  const acoes = new Map([...clipes].map(([nome, c]) => [nome, mixer.clipAction(c)]))
  let anterior: AnimationAction | null = null
  const direita = new Vector3(), frente = new Vector3(), rotacao = new Quaternion()

  function animar(pose: PoseDaAssistente) {
    const gestoBaixo = !!pose.gesto && !!pose.baixo
    const nome = gestoBaixo ? 'Pegar e colocar' : pose.carregando || pose.gesto ? 'Carregar' : pose.andando ? 'Caminhar feminino' : 'Repouso'
    const acao = acoes.get(nome)!
    if (acao !== anterior) {
      acao.reset().play()
      if (anterior && !pose.imediato) acao.crossFadeFrom(anterior, 0.16, false)
      else { mixer.stopAllAction(); acao.play() }
      anterior = acao
    }
    acao.paused = !pose.andando || gestoBaixo
    if (gestoBaixo) {
      // A primeira metade do clipe original abaixa, pega e volta a levantar;
      // a segunda vira para o lado. A tarefa já controla a direção de entrega.
      acao.time = Math.min(1, Math.max(0, pose.progresso ?? 0)) * acao.getClip().duration * 0.5
    } else if (nome === 'Repouso') acao.time = 0
    else if (!pose.andando) acao.time = 0.35
    mixer.update(pose.imediato ? 0 : pose.delta)
    grupo.updateMatrixWorld(true)
  }
  function centroDaCarga(alvo: Vector3) {
    grupo.updateMatrixWorld(true)
    maoEsquerda!.getWorldPosition(alvo)
    maoDireita!.getWorldPosition(direita)
    alvo.add(direita).multiplyScalar(0.5)
    grupo.getWorldQuaternion(rotacao)
    frente.set(0, -0.08, 0.07).applyQuaternion(rotacao)
    return alvo.add(frente)
  }
  animar({ andando: false, carregando: false, delta: 0, imediato: true })
  return {
    grupo, animar, centroDaCarga,
    descartar: () => {
      mixer.stopAllAction(); mixer.uncacheRoot(modelo)
      // SkeletonUtils compartilha geometria/material com o arquivo em cache.
      // Só o esqueleto clonado pertence a esta instância do palco.
      esqueletos.forEach(e => e.dispose())
    },
  }
}
