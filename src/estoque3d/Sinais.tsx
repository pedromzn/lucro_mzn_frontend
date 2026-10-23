/**
 * O que aparece por cima da mercadoria — PLANO-ESTOQUE-3D.md, fatias 2, 4 e 5.
 *
 * - **Realce**: a posição apontada ganha um véu, a selecionada um contorno.
 * - **Sinalizadores**: colunas de luz sobre cada posição do produto procurado —
 *   o "localizar" do Warehouse Theatre 3D (MIT).
 * A fila de movimentos é consumida por OperacaoAnimada (Assistente e caminhão).
 * - **Projetor**: os rótulos são HTML de verdade (fonte do mock, leitor de
 *   tela, nada de worker por `blob:`, que a CSP recusaria) e se reposicionam a
 *   cada quadro em que a câmera se mexe.
 */

import { useEffect, useMemo, type MutableRefObject } from 'react'
import { useThree } from '@react-three/fiber'
import { Color, EdgesGeometry, LineBasicMaterial, MeshBasicMaterial, Vector3 } from 'three'
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
