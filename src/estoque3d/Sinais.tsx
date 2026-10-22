/**
 * O que aparece por cima da mercadoria — PLANO-ESTOQUE-3D.md, fatias 2, 4 e 5.
 *
 * - **Realce**: a posição apontada ganha um véu, a selecionada um contorno.
 * - **Sinalizadores**: colunas de luz sobre cada posição do produto procurado —
 *   o "localizar" do Warehouse Theatre 3D (MIT).
 * - **Voos**: as caixinhas fazendo arco de um lugar a outro. Pedem quadro só
 *   enquanto voam; parada, a cena volta a não desenhar nada.
 * - **Projetor**: os rótulos são HTML de verdade (fonte do mock, leitor de
 *   tela, nada de worker por `blob:`, que a CSP recusaria) e se reposicionam a
 *   cada quadro em que a câmera se mexe.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, EdgesGeometry, Euler, LineBasicMaterial, Matrix4, MeshBasicMaterial, Quaternion, Vector3, type InstancedMesh } from 'three'
import { MEDIDAS, type Endereco, type Estrutura } from '@shared/enderecos'
import type { Materiais } from './materiais'
import type { OuvinteDeQuadro } from './camera'
import type { Ponto, Voo } from './voos'

/** A célula de uma posição no mundo: centro, tamanho e giro. */
export function celulaDa(e: Estrutura, nivel: number, vao: number) {
  const m = MEDIDAS[e.tipo]
  const r = (e.rotacao * Math.PI) / 180
  const lx = (vao + 0.5) * m.vao - (m.vao * e.vaos) / 2
  const altura = e.tipo === 'mesa' || e.tipo === 'balcao' ? 0.34 : m.nivel
  return {
    centro: [e.x + lx * Math.cos(r), m.base + nivel * m.nivel + altura / 2, e.z - lx * Math.sin(r)] as [number, number, number],
    tamanho: [m.vao * 0.98, altura * 0.98, m.profundidade * 1.02] as [number, number, number],
    giro: r,
  }
}

export function Realce({ endereco, estruturas, mats, tipo }: { endereco: Endereco | null; estruturas: Estrutura[]; mats: Materiais; tipo: 'apontado' | 'selecionado' | 'destino' }) {
  const recursos = useMemo(() => ({
    veu: new MeshBasicMaterial({ color: new Color(tipo === 'destino' ? '#287c62' : '#6847c6'), transparent: true, opacity: tipo === 'apontado' ? 0.16 : 0.24, depthWrite: false }),
    traco: new LineBasicMaterial({ color: new Color(tipo === 'destino' ? '#287c62' : '#6847c6') }),
    arestas: new EdgesGeometry(mats.geometria.cubo),
  }), [tipo, mats])
  useEffect(() => () => { recursos.veu.dispose(); recursos.traco.dispose(); recursos.arestas.dispose() }, [recursos])
  const e = endereco ? estruturas.find((x) => x.id === endereco.estruturaId) : undefined
  if (!endereco || !e) return null
  const c = celulaDa(e, endereco.nivel, endereco.vao)
  return (
    <group position={c.centro} rotation={[0, c.giro, 0]}>
      <mesh geometry={mats.geometria.cubo} material={recursos.veu} scale={c.tamanho} renderOrder={2} />
      {tipo !== 'apontado' ? <lineSegments geometry={recursos.arestas} material={recursos.traco} scale={c.tamanho} /> : null}
    </group>
  )
}

/** A pegada de uma estrutura no chão, no editor: verde se cabe ali, vermelha se bate em outra ou sai do espaço. */
export function Pegada({ retangulo, ok, mats }: { retangulo: { x0: number; x1: number; z0: number; z1: number } | null; ok: boolean; mats: Materiais }) {
  const recursos = useMemo(() => ({
    bom: new MeshBasicMaterial({ color: new Color('#287c62'), transparent: true, opacity: 0.35, depthWrite: false }),
    ruim: new MeshBasicMaterial({ color: new Color('#d4485f'), transparent: true, opacity: 0.45, depthWrite: false }),
  }), [])
  useEffect(() => () => { recursos.bom.dispose(); recursos.ruim.dispose() }, [recursos])
  if (!retangulo) return null
  const { x0, x1, z0, z1 } = retangulo
  return <mesh geometry={mats.geometria.cubo} material={ok ? recursos.bom : recursos.ruim} position={[(x0 + x1) / 2, 0.012, (z0 + z1) / 2]} scale={[x1 - x0 + 0.06, 0.01, z1 - z0 + 0.06]} renderOrder={4} />
}

export function Sinalizadores({ pontos, mats }: { pontos: Ponto[]; mats: Materiais }) {
  const luz = useMemo(() => new MeshBasicMaterial({ color: new Color('#8f6ce8'), transparent: true, opacity: 0.32, depthWrite: false }), [])
  const ponta = useMemo(() => new MeshBasicMaterial({ color: new Color('#6847c6') }), [])
  useEffect(() => () => { luz.dispose(); ponta.dispose() }, [luz, ponta])
  return (
    <group>
      {pontos.map((p, i) => (
        <group key={i} position={[p.x, p.y, p.z]}>
          <mesh geometry={mats.geometria.cubo} material={luz} position={[0, 1.1, 0]} scale={[0.12, 2.2, 0.12]} renderOrder={3} />
          <mesh geometry={mats.geometria.cubo} material={ponta} position={[0, 2.3, 0]} scale={[0.26, 0.26, 0.26]} rotation={[Math.PI / 4, 0, Math.PI / 4]} />
        </group>
      ))}
    </group>
  )
}

/* ── os voos ── */

export interface LevaDeVoos { voos: Voo[]; inicio: number }

const TETO = 64
const DURACAO = 1100
const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _p = new Vector3(), _s = new Vector3(), _c = new Color()

export function Voos({ fila, cores, mats, reduzirMovimento }: { fila: MutableRefObject<LevaDeVoos[]>; cores: Map<string, string>; mats: Materiais; reduzirMovimento: boolean }) {
  const ref = useRef<InstancedMesh>(null)
  const invalidate = useThree((s) => s.invalidate)
  useLayoutEffect(() => {
    if (ref.current) ref.current.count = 0
  }, [])
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    /* com movimento reduzido, a leva não anda: a mercadoria simplesmente aparece no lugar novo */
    if (reduzirMovimento) { fila.current = []; mesh.count = 0; return }
    const agora = performance.now()
    let n = 0
    let ativos = false
    for (const leva of fila.current) {
      for (const v of leva.voos) {
        const t = (agora - leva.inicio - v.atraso) / DURACAO
        if (t > 1) continue
        ativos = true
        if (t < 0) continue
        const dist = Math.hypot(v.para.x - v.de.x, v.para.z - v.de.z)
        const arco = 0.6 + dist * 0.18
        for (let k = 0; k < v.unidades && n < TETO; k++) {
          const tk = Math.max(0, Math.min(1, t - k * 0.07))
          const suave = tk * tk * (3 - 2 * tk)
          _p.set(
            v.de.x + (v.para.x - v.de.x) * suave,
            v.de.y + (v.para.y - v.de.y) * suave + Math.sin(Math.PI * suave) * arco,
            v.de.z + (v.para.z - v.de.z) * suave,
          )
          /* nasce e some com um "pulo" de tamanho, como um brinquedo */
          const escala = 0.28 * Math.min(1, Math.sin(Math.PI * Math.min(1, tk * 1.15)) * 1.6 + 0.15)
          _m.compose(_p, _q.setFromEuler(_e.set(0, suave * Math.PI, suave * 0.6)), _s.set(escala, escala, escala))
          mesh.setMatrixAt(n, _m)
          mesh.setColorAt(n, _c.set(cores.get(v.produtoId) ?? '#cccccc'))
          n++
        }
      }
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    if (ativos) invalidate()
    else if (fila.current.length) fila.current = []
  })
  return <instancedMesh ref={ref} args={[mats.geometria.arredondado, mats.de('#ffffff'), TETO]} frustumCulled={false} castShadow />
}

/* ── os rótulos de HTML ── */

export interface AlvoDeRotulo { chave: string; ponto: Ponto }

/**
 * Dentro do Canvas: a cada quadro em que a câmera se mexeu (ela avisa os
 * ouvintes), leva cada ponto do mundo para a tela e move o elemento de HTML.
 */
export function Projetor({ ouvintes, alvos, elementos }: {
  ouvintes: MutableRefObject<Set<OuvinteDeQuadro>>
  alvos: MutableRefObject<AlvoDeRotulo[]>
  elementos: MutableRefObject<Map<string, HTMLElement>>
}) {
  const { camera, size, invalidate } = useThree()
  const v = useMemo(() => new Vector3(), [])
  useEffect(() => {
    const projetar = () => {
      for (const a of alvos.current) {
        const el = elementos.current.get(a.chave)
        if (!el) continue
        v.set(a.ponto.x, a.ponto.y, a.ponto.z).project(camera)
        const dentro = v.z < 1 && v.x > -1.1 && v.x < 1.1 && v.y > -1.1 && v.y < 1.1
        el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`
        el.style.visibility = dentro ? 'visible' : 'hidden'
      }
    }
    ouvintes.current.add(projetar)
    invalidate()
    return () => { ouvintes.current.delete(projetar) }
  }, [ouvintes, alvos, elementos, camera, size, v, invalidate])
  return null
}
