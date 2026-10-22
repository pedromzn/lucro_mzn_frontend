/**
 * A mercadoria na cena — PLANO-ESTOQUE-3D.md, fatias 2 e 3.
 *
 * Tudo em `InstancedMesh`: uma chamada de desenho por forma, não uma por caixa
 * — a técnica do Viewer3D para aguentar milhares de unidades. A capacidade
 * cresce em potências de 2, para não refazer a malha a cada venda.
 *
 * As cores vêm de fora (`calor.ts`): por categoria, ou pelo modo do mapa de
 * calor. No armazém a caixa é de papelão, e a cor vai na ETIQUETA dela.
 */

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Color, Euler, Matrix4, Quaternion, Vector3, type BufferGeometry, type InstancedMesh, type Material } from 'three'
import { MEDIDAS, type Estrutura, type Tema } from '@shared/enderecos'
import type { PosicaoNoMapa, ProdutoNoMapa } from '@/lib/api'
import { ALTURA_DO_PALETE, formaDa, repartir, temPalete, unidadesDaPosicao, type Forma } from './geometria'
import type { Materiais } from './materiais'
import { hashDe } from './temas'
import type { Ponto } from './voos'

interface Instancia { p: [number, number, number]; giro: number; t: [number, number, number]; cor: string }

const PAPELAO = ['#c99c64', '#bf9058', '#d3a970', '#b88a55']
const MADEIRA = '#b98d5f'

const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _p = new Vector3(), _s = new Vector3(), _c = new Color()

/** Um lote de instâncias de uma geometria e um material. */
export function Instancias({ itens, geometria, material, sombra = true }: { itens: Instancia[]; geometria: BufferGeometry; material: Material; sombra?: boolean }) {
  const ref = useRef<InstancedMesh>(null)
  const invalidate = useThree((s) => s.invalidate)
  const capacidade = 2 ** Math.ceil(Math.log2(Math.max(8, itens.length)))
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    itens.forEach((it, i) => {
      _m.compose(_p.set(...it.p), _q.setFromEuler(_e.set(0, it.giro, 0)), _s.set(...it.t))
      mesh.setMatrixAt(i, _m)
      mesh.setColorAt(i, _c.set(it.cor))
    })
    mesh.count = itens.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    invalidate()
  }, [itens, capacidade, invalidate])
  return <instancedMesh key={capacidade} ref={ref} args={[geometria, material, capacidade]} castShadow={sombra} receiveShadow />
}

/** De coordenadas da estrutura para o mundo: a mesma conta do `centroDaPosicao`. */
function noMundo(e: Estrutura, lx: number, ly: number, lz: number): [number, number, number] {
  const r = (e.rotacao * Math.PI) / 180
  return [e.x + lx * Math.cos(r) + lz * Math.sin(r), ly, e.z - lx * Math.sin(r) + lz * Math.cos(r)]
}

export function Mercadoria({ tema, estruturas, posicoes, cores, mats }: {
  tema: Tema
  estruturas: Estrutura[]
  posicoes: PosicaoNoMapa[]
  cores: Map<string, string>
  mats: Materiais
}) {
  const lotes = useMemo(() => {
    const porForma: Record<Forma, Instancia[]> = { caixa: [], roupa: [], dobrado: [], carga: [], produto: [] }
    const paletes: Instancia[] = [], cabides: Instancia[] = [], etiquetas: Instancia[] = []
    const porEstrutura = new Map(estruturas.map((e) => [e.id, e]))
    const grupos = new Map<string, { e: Estrutura; nivel: number; vao: number; ocupantes: Array<{ produtoId: string; quantidade: number }> }>()
    for (const p of posicoes) {
      const e = porEstrutura.get(p.estruturaId)
      if (!e || p.nivel >= e.niveis || p.vao >= e.vaos) continue
      const chave = `${p.estruturaId}:${p.nivel}:${p.vao}`
      const g = grupos.get(chave) ?? { e, nivel: p.nivel, vao: p.vao, ocupantes: [] }
      g.ocupantes.push({ produtoId: p.produtoId, quantidade: Number(p.quantidade) })
      grupos.set(chave, g)
    }
    const armazem = tema === 'armazem'
    for (const { e, nivel, vao, ocupantes } of grupos.values()) {
      const m = MEDIDAS[e.tipo]
      const forma = formaDa(tema, e.tipo)
      const lx = (vao + 0.5) * m.vao - (m.vao * e.vaos) / 2
      const ly = m.base + nivel * m.nivel
      const giro = (e.rotacao * Math.PI) / 180
      if (temPalete(tema, e.tipo)) {
        paletes.push({ p: noMundo(e, lx, ly + ALTURA_DO_PALETE / 2, 0), giro, t: [m.vao * 0.84, ALTURA_DO_PALETE, m.profundidade * 0.82], cor: MADEIRA })
      }
      for (const u of unidadesDaPosicao(tema, e.tipo, ocupantes)) {
        const corDoProduto = cores.get(u.produtoId) ?? '#cccccc'
        const caixaDePapelao = armazem && (forma === 'carga' || forma === 'caixa')
        porForma[forma].push({
          p: noMundo(e, lx + u.x, ly + u.y, u.z), giro, t: [u.largura, u.altura, u.profundidade],
          cor: caixaDePapelao ? PAPELAO[hashDe(u.produtoId) % PAPELAO.length]! : corDoProduto,
        })
        if (caixaDePapelao) {
          /* a etiqueta na face da frente: é nela que a categoria e o mapa de calor aparecem */
          etiquetas.push({ p: noMundo(e, lx + u.x, ly + u.y, u.z + u.profundidade / 2 + 0.003), giro, t: [u.largura * 0.55, u.altura * 0.4, 0.006], cor: corDoProduto })
        }
        if (forma === 'roupa') {
          cabides.push({ p: noMundo(e, lx + u.x, ly + u.y + u.altura / 2 + 0.03, u.z), giro, t: [0.02, 0.05, u.profundidade * 0.85], cor: '#ffffff' })
        }
      }
    }
    return { porForma, paletes, cabides, etiquetas }
  }, [tema, estruturas, posicoes, cores])

  const branco = mats.de('#ffffff')
  const geo = (f: Forma) => (tema === 'loja_fofa' || f === 'dobrado' ? mats.geometria.arredondado : mats.geometria.cubo)
  return (
    <group>
      {(Object.keys(lotes.porForma) as Forma[]).map((f) => (lotes.porForma[f].length ? <Instancias key={f} itens={lotes.porForma[f]} geometria={geo(f)} material={branco} /> : null))}
      {lotes.paletes.length ? <Instancias itens={lotes.paletes} geometria={mats.geometria.cubo} material={branco} /> : null}
      {lotes.cabides.length ? <Instancias itens={lotes.cabides} geometria={mats.geometria.cubo} material={branco} sombra={false} /> : null}
      {lotes.etiquetas.length ? <Instancias itens={lotes.etiquetas} geometria={mats.geometria.cubo} material={branco} sombra={false} /> : null}
    </group>
  )
}

/** O monte "a guardar", no chão do recebimento — clicável, abre a lista do que falta guardar. */
export function MonteAGuardar({ ponto, produtos, cores, mats, aoClicar, aoApontar }: {
  ponto: Ponto
  produtos: ProdutoNoMapa[]
  cores: Map<string, string>
  mats: Materiais
  aoClicar: () => void
  aoApontar: (dentro: boolean) => void
}) {
  const itens = useMemo(() => {
    const ocupantes = produtos.filter((p) => Number(p.aGuardar) > 0).map((p) => ({ produtoId: p.id, quantidade: Number(p.aGuardar) }))
    const lado = 0.34
    const lista: Instancia[] = []
    let i = 0
    for (const { produtoId, unidades } of repartir(ocupantes, 24)) {
      for (let k = 0; k < unidades; k++, i++) {
        const camada = Math.floor(i / 12), resto = i % 12
        const coluna = resto % 4, fileira = Math.floor(resto / 4)
        lista.push({
          p: [ponto.x + (coluna - 1.5) * lado * 1.05, lado / 2 + camada * lado, ponto.z + (fileira - 1) * lado * 1.05],
          giro: ((hashDe(`${produtoId}${k}`) % 20) - 10) / 100,
          t: [lado * 0.95, lado * 0.95, lado * 0.95],
          cor: cores.get(produtoId) ?? '#cccccc',
        })
      }
    }
    return lista
  }, [ponto, produtos, cores])
  if (!itens.length) return null
  const altura = itens.reduce((m, it) => Math.max(m, it.p[1] + it.t[1] / 2), 0)
  return (
    <group>
      <Instancias itens={itens} geometria={mats.geometria.arredondado} material={mats.de('#ffffff')} />
      <mesh
        geometry={mats.geometria.cubo}
        material={mats.invisivel}
        position={[ponto.x, altura / 2, ponto.z]}
        scale={[1.6, altura + 0.1, 1.2]}
        onPointerMove={(ev: ThreeEvent<PointerEvent>) => { ev.stopPropagation(); aoApontar(true) }}
        onPointerOut={() => aoApontar(false)}
        onClick={(ev: ThreeEvent<MouseEvent>) => { if (ev.delta > 6) return; ev.stopPropagation(); aoClicar() }}
      />
    </group>
  )
}
