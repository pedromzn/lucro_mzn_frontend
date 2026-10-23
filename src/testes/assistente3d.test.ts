/** O asset da Assistente e seu esqueleto — PLANO-ESTOQUE-3D.md, evolução 7. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { Box3, Texture, Vector3, type SkinnedMesh } from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { ALTURA_DA_ASSISTENTE, criarAssistente } from '@/estoque3d/Assistente'

let arquivo: GLTF
beforeAll(async () => {
  const loader = new GLTFLoader()
  // O teste lê a malha/esqueleto do GLB real. Só a decodificação de imagem,
  // que pertence ao navegador/GPU, fica fora do ensaio em Node.
  loader.register(() => ({ name: 'EXT_texture_webp', loadTexture: async () => new Texture() }))
  const b = readFileSync(resolve('src/assets/assistente/assistente.glb'))
  arquivo = await loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')
})
describe('Assistente fornecida pelo usuário', () => {
  it('carrega a malha original, as texturas e os clipes de trabalho', () => {
    const malhas: SkinnedMesh[] = []
    arquivo.scene.traverse(o => { if ((o as SkinnedMesh).isSkinnedMesh) malhas.push(o as SkinnedMesh) })
    expect(malhas).toHaveLength(1)
    expect(malhas[0]!.geometry.attributes.position.count / 3).toBe(10320)
    expect(arquivo.animations.map(a => a.name).sort()).toEqual(['Caminhar feminino', 'Carregar', 'Pegar e colocar', 'Repouso'])
    const m = Array.isArray(malhas[0]!.material) ? malhas[0]!.material[0] : malhas[0]!.material
    expect((m as import('three').MeshStandardMaterial).map).toBeTruthy()
  })
  it('normaliza a escala e mantém o quadril no corredor durante os clipes', () => {
    const assistente = criarAssistente(arquivo)
    try {
      const altura = new Box3().setFromObject(assistente.grupo).getSize(new Vector3()).y
      expect(altura).toBeCloseTo(ALTURA_DA_ASSISTENTE, 1)
      const quadril = assistente.grupo.getObjectByName('mixamorigHips')!
      const inicio = quadril.getWorldPosition(new Vector3())
      for (let i = 0; i < 300; i++) {
        assistente.animar({ andando: true, carregando: i > 100, delta: 0.04 })
        const p = quadril.getWorldPosition(new Vector3())
        expect(p.x).toBeCloseTo(inicio.x, 4)
        expect(p.z).toBeCloseTo(inicio.z, 4)
        assistente.grupo.traverse(o => expect(o.matrixWorld.elements.every(Number.isFinite)).toBe(true))
      }
      const carga = assistente.centroDaCarga(new Vector3())
      expect(carga.y).toBeGreaterThan(1)
      expect(carga.y).toBeLessThan(1.8)
    } finally { assistente.descartar() }
  })
  it('cada palco anima seu esqueleto sem mover as outras instâncias', () => {
    const a = criarAssistente(arquivo), b = criarAssistente(arquivo)
    try {
      const ossoA = a.grupo.getObjectByName('mixamorigLeftHand')!, ossoB = b.grupo.getObjectByName('mixamorigLeftHand')!
      expect(ossoA).not.toBe(ossoB)
      const antes = ossoB.quaternion.clone()
      a.animar({ andando: true, carregando: true, delta: 0.4 })
      expect(ossoB.quaternion.equals(antes)).toBe(true)
      a.grupo.position.set(4, 0, 3)
      const carga = a.centroDaCarga(new Vector3())
      expect(carga.x).toBeGreaterThan(3.5)
      expect(carga.z).toBeGreaterThan(3)
    } finally { a.descartar(); b.descartar() }
  })
})
