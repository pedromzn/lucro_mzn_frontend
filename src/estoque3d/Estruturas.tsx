/**
 * As estruturas na cena — PLANO-ESTOQUE-3D.md, fatias 2 e 3.
 *
 * Cada tipo genérico (`@shared/enderecos`) é desenhado do jeito do tema, peça
 * por peça, só com caixas (E5: nenhum modelo de fora). As medidas são as do
 * tipo; o tema escolhe a forma e a cor.
 *
 * O clique é numa CAIXA INVISÍVEL do tamanho da estrutura (a técnica do
 * Warehouse Theatre 3D, com uma caixa por estrutura em vez de uma por nível):
 * o ponto atingido, levado para as coordenadas da estrutura, diz o nível e o
 * vão. Mil prateleiras dão mil caixas de clique, não seis mil.
 */

import { memo, type ReactNode } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { Plane, Vector3, type Material, type Object3D } from 'three'
import { MEDIDAS, type Endereco, type Estrutura, type Tema } from '@shared/enderecos'
import type { Materiais } from './materiais'
import { VISUAL } from './temas'

type V3 = [number, number, number]

/** Uma caixa: posição do CENTRO e tamanho, em metros. */
function Peca({ p, t, m, mats, redonda = false, sombra = true }: { p: V3; t: V3; m: Material; mats: Materiais; redonda?: boolean; sombra?: boolean }) {
  return (
    <mesh
      geometry={redonda ? mats.geometria.arredondado : mats.geometria.cubo}
      material={m}
      position={p}
      scale={t}
      castShadow={sombra}
      receiveShadow
    />
  )
}

export interface MedidasDaEstrutura { largura: number; profundidade: number; altura: number; base: number; nivel: number }

export function medidasDe(e: Pick<Estrutura, 'tipo' | 'niveis' | 'vaos'>): MedidasDaEstrutura {
  const m = MEDIDAS[e.tipo]
  return { largura: m.vao * e.vaos, profundidade: m.profundidade, altura: m.base + e.niveis * m.nivel, base: m.base, nivel: m.nivel }
}

/**
 * O nível e o vão debaixo de um ponto do mundo — a conta do clique. `grupo` é o
 * da ESTRUTURA (posição e rotação), não a caixa de clique: ela é escalada, e o
 * ponto voltaria dividido pelo tamanho dela.
 */
export function enderecoNoPonto(e: Estrutura, grupo: Object3D, ponto: { x: number; y: number; z: number }): Endereco {
  const local = grupo.worldToLocal(new Vector3(ponto.x, ponto.y, ponto.z))
  const d = medidasDe(e)
  const m = MEDIDAS[e.tipo]
  const vao = Math.max(0, Math.min(e.vaos - 1, Math.floor((local.x + d.largura / 2) / m.vao)))
  const nivel = Math.max(0, Math.min(e.niveis - 1, Math.floor((local.y - d.base + 0.02) / m.nivel)))
  return { estruturaId: e.id, nivel, vao }
}

function corpoDa(e: Estrutura, tema: Tema, mats: Materiais): ReactNode {
  const v = VISUAL[tema]
  const { largura: W, profundidade: P, altura: H, base, nivel } = medidasDe(e)
  const fofo = tema === 'loja_fofa'
  const corpo = mats.de(v.estrutura.corpo)
  const detalhe = mats.de(v.estrutura.detalhe, tema === 'shopping' ? 'metal' : 'fosco')
  const apoio = mats.de(v.estrutura.apoio)
  const niveis = Array.from({ length: e.niveis }, (_, i) => i)
  const pecas: ReactNode[] = []
  const add = (p: V3, t: V3, m: Material, redonda = fofo) => pecas.push(<Peca key={pecas.length} p={p} t={t} m={m} mats={mats} redonda={redonda} />)

  if (e.tipo === 'estante') {
    const poste = tema === 'armazem' ? mats.de('#7d8794', 'metal') : fofo ? detalhe : corpo
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add([sx * (W / 2 - 0.03), (H + 0.04) / 2, sz * (P / 2 - 0.03)], [0.05, H + 0.04, 0.05], poste)
    for (const i of [...niveis, e.niveis]) add([0, base + i * nivel - 0.015, 0], [W, 0.03, P], i === e.niveis ? poste : apoio)
    if (tema !== 'armazem') add([0, H / 2, -P / 2 + 0.012], [W - 0.04, H, 0.024], corpo)
    if (fofo) add([0, base / 2, 0], [W, base, P], corpo)
  }

  if (e.tipo === 'expositor') {
    if (fofo) {
      /* a arara: dois pés, duas colunas e um varão por nível — a roupa pendura dele */
      for (const sx of [-1, 1]) {
        add([sx * (W / 2 - 0.03), 0.04, 0], [0.16, 0.08, P * 0.95], corpo)
        add([sx * (W / 2 - 0.03), (H + 0.05) / 2, 0], [0.075, H + 0.05, 0.075], detalhe)
        pecas.push(<mesh key={`bola${sx}`} geometry={mats.geometria.arredondado} material={corpo} position={[sx * (W / 2 - 0.03), H + 0.1, 0]} scale={[0.14, 0.14, 0.14]} castShadow />)
      }
      for (const i of niveis) add([0, base + i * nivel + nivel * 0.9, 0], [W, 0.045, 0.045], detalhe)
    } else if (tema === 'armazem') {
      /* o porta-paletes: quadros azuis em cada vão, longarinas laranja em cada nível */
      for (let k = 0; k <= e.vaos; k++) {
        const x = -W / 2 + k * MEDIDAS.expositor.vao
        for (const sz of [-1, 1]) add([x, (H + 0.25) / 2, sz * (P / 2 - 0.04)], [0.07, H + 0.25, 0.07], corpo, false)
        add([x, H * 0.5, 0], [0.03, 0.03, P - 0.08], corpo, false)
        add([x, 0.05, 0], [0.12, 0.1, P], corpo, false)
      }
      for (const i of niveis) {
        if (i === 0 && base < 0.2) continue
        for (const sz of [-1, 1]) add([0, base + i * nivel - 0.05, sz * (P / 2 - 0.04)], [W, 0.09, 0.05], detalhe, false)
      }
    } else {
      /* a gôndola: rodapé, costas, prateleiras e a testeira dourada */
      add([0, base / 2, 0], [W, base, P], apoio, false)
      add([0, H / 2 + 0.05, -P / 2 + 0.03], [W, H + 0.1, 0.05], corpo, false)
      for (const i of niveis.slice(1)) add([0, base + i * nivel - 0.012, 0.02], [W - 0.02, 0.025, P - 0.06], corpo, false)
      add([0, H + 0.2, -P / 2 + 0.05], [W, 0.16, 0.02], detalhe, false)
    }
  }

  if (e.tipo === 'vitrine') {
    if (fofo) {
      /* cestos de vime empilhados num suporte */
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add([sx * (W / 2 - 0.04), H / 2, sz * (P / 2 - 0.04)], [0.04, H, 0.04], detalhe)
      for (const i of niveis) {
        const y = base + i * nivel
        add([0, y - 0.02, 0], [W - 0.06, 0.04, P - 0.06], corpo)
        for (const sz of [-1, 1]) add([0, y + nivel * 0.18, sz * (P / 2 - 0.05)], [W - 0.06, nivel * 0.4, 0.04], corpo)
        for (const sx of [-1, 1]) add([sx * (W / 2 - 0.05), y + nivel * 0.18, 0], [0.04, nivel * 0.4, P - 0.06], corpo)
      }
    } else if (tema === 'armazem') {
      /* a gaiola: quadro metálico com tela vazada */
      const metal = mats.de('#8a939e', 'metal')
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add([sx * (W / 2 - 0.02), H / 2, sz * (P / 2 - 0.02)], [0.04, H, 0.04], metal, false)
      for (const y of [0.02, H]) add([0, y, 0], [W, 0.03, P], metal, false)
      for (const i of niveis.slice(1)) add([0, base + i * nivel - 0.01, 0], [W, 0.02, P], metal, false)
      pecas.push(<mesh key="tela" geometry={mats.geometria.cubo} material={mats.vidro} position={[0, H / 2, 0]} scale={[W, H, P]} />)
    } else {
      /* a vitrine: base cheia, caixa de vidro, prateleiras de vidro, moldura dourada */
      add([0, base / 2, 0], [W, base, P], corpo, false)
      pecas.push(<mesh key="vidro" geometry={mats.geometria.cubo} material={mats.vidro} position={[0, base + (H - base) / 2, 0]} scale={[W, H - base, P]} />)
      for (const i of niveis.slice(1)) pecas.push(<mesh key={`p${i}`} geometry={mats.geometria.cubo} material={mats.vidro} position={[0, base + i * nivel, 0]} scale={[W - 0.02, 0.012, P - 0.02]} />)
      add([0, H, 0], [W + 0.02, 0.02, P + 0.02], detalhe, false)
    }
  }

  if (e.tipo === 'mesa') {
    if (tema === 'shopping') {
      add([0, base / 2, 0], [W, base, P], corpo, false)
      add([0, base - 0.01, 0], [W + 0.02, 0.02, P + 0.02], detalhe, false)
    } else {
      add([0, base - 0.03, 0], [W, 0.06, P], tema === 'armazem' ? apoio : corpo)
      const perna = tema === 'armazem' ? mats.de('#7d8794', 'metal') : detalhe
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add([sx * (W / 2 - 0.06), (base - 0.06) / 2, sz * (P / 2 - 0.06)], [0.05, base - 0.06, 0.05], perna)
    }
  }

  if (e.tipo === 'balcao') {
    add([0, base / 2, 0], [W, base, P], corpo)
    add([0, base - 0.02, 0], [W + 0.06, 0.04, P + 0.06], fofo ? apoio : detalhe)
    /* o que fica no balcão e não é estoque: a caixinha registradora, a etiquetadora, o monitor */
    if (fofo) {
      add([W / 2 - 0.22, base + 0.09, -P / 2 + 0.16], [0.3, 0.18, 0.22], mats.de('#c7b4f2'))
      add([W / 2 - 0.22, base + 0.21, -P / 2 + 0.11], [0.22, 0.08, 0.04], mats.de('#ffffff'))
    } else if (tema === 'armazem') {
      add([W / 2 - 0.25, base + 0.1, -P / 2 + 0.15], [0.3, 0.2, 0.22], mats.de('#3b4250'))
    } else {
      add([W / 2 - 0.25, base + 0.2, -P / 2 + 0.12], [0.36, 0.24, 0.03], mats.de('#20232b', 'brilho'), false)
      add([W / 2 - 0.25, base + 0.05, -P / 2 + 0.12], [0.04, 0.1, 0.04], mats.de('#9aa0a8', 'metal'), false)
    }
  }
  return pecas
}

export interface EventosDaEstrutura {
  aoApontar: (e: Endereco | null) => void
  aoClicar: (e: Endereco) => void
  /** só no editor: o arraste da estrutura inteira pelo chão */
  arraste?: {
    aoComecar: (estruturaId: string, x: number, z: number) => void
    aoMover: (x: number, z: number) => void
    aoSoltar: () => void
  }
}

const CHAO = new Plane(new Vector3(0, 1, 0), 0)
const _ponto = new Vector3()

/** Uma estrutura: o corpo e a caixa de clique, no lugar e na rotação dela. */
export const EstruturaNaCena = memo(function EstruturaNaCena({ e, tema, mats, eventos, clicavel = true }: {
  e: Estrutura
  tema: Tema
  mats: Materiais
  eventos?: EventosDaEstrutura
  clicavel?: boolean
}) {
  const { largura, profundidade, altura } = medidasDe(e)
  const naCaixa = (ev: ThreeEvent<PointerEvent | MouseEvent>) => enderecoNoPonto(e, ev.eventObject.parent ?? ev.eventObject, ev.point)
  return (
    <group position={[e.x, 0, e.z]} rotation={[0, (e.rotacao * Math.PI) / 180, 0]}>
      {corpoDa(e, tema, mats)}
      {clicavel && eventos ? (
        <mesh
          geometry={mats.geometria.cubo}
          material={mats.invisivel}
          position={[0, (altura + 0.1) / 2, 0]}
          scale={[largura + 0.04, altura + 0.1, profundidade + 0.04]}
          onPointerDown={(ev) => {
            if (!eventos.arraste || ev.button !== 0) return
            ev.stopPropagation()
            ;(ev.target as Element).setPointerCapture(ev.pointerId)
            if (ev.ray.intersectPlane(CHAO, _ponto)) eventos.arraste.aoComecar(e.id, _ponto.x, _ponto.z)
          }}
          onPointerUp={(ev) => {
            if (!eventos.arraste) return
            ;(ev.target as Element).releasePointerCapture(ev.pointerId)
            eventos.arraste.aoSoltar()
          }}
          onPointerMove={(ev) => {
            ev.stopPropagation()
            if (eventos.arraste && ev.buttons === 1 && ev.ray.intersectPlane(CHAO, _ponto)) eventos.arraste.aoMover(_ponto.x, _ponto.z)
            eventos.aoApontar(naCaixa(ev))
          }}
          onPointerOut={() => eventos.aoApontar(null)}
          onClick={(ev) => {
            /* arrastar para girar também termina num "clique": acima de 6 px é arraste */
            if (ev.delta > 6) return
            ev.stopPropagation()
            eventos.aoClicar(naCaixa(ev))
          }}
        />
      ) : null}
    </group>
  )
})
