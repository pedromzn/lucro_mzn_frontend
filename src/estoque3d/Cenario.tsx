/**
 * O ambiente em volta do estoque — PLANO-ESTOQUE-3D.md, fatia 3.
 *
 * Chão, paredes, a marca de cada zona no piso e a decoração de cada tema, só
 * com formas simples (E5). A frente do espaço (+z) fica aberta: é de lá que a
 * câmera olha, como numa casa de bonecas.
 *
 * A decoração não é clicável e não projeta sombra no que importa: ela existe
 * para a pessoa reconhecer o lugar, não para atrapalhar o clique.
 *
 * **Casa de bonecas:** a parede do lado de onde a câmera olha some (e tudo o
 * que está pendurado nela, que mora no mesmo grupo). Girando para os fundos, o
 * estoque continua à vista em vez de virar uma parede lisa.
 */

import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { CircleGeometry, CylinderGeometry, SphereGeometry, type Group, type Material } from 'three'
import { ZONAS, retanguloDa, type Ambiente, type Estrutura, type Tema } from '@shared/enderecos'
import type { Materiais } from './materiais'
import { VISUAL } from './temas'

type V3 = [number, number, number]

function useFormas() {
  const formas = useMemo(() => ({
    cilindro: new CylinderGeometry(0.5, 0.5, 1, 20),
    esfera: new SphereGeometry(0.5, 18, 14),
    disco: new CircleGeometry(0.5, 32),
  }), [])
  useEffect(() => () => { formas.cilindro.dispose(); formas.esfera.dispose(); formas.disco.dispose() }, [formas])
  return formas
}

/** A área de cada zona: o retângulo que cobre as estruturas dela, com folga. */
export function areasDasZonas(estruturas: Estrutura[], ambiente: Pick<Ambiente, 'largura' | 'profundidade'>) {
  return ZONAS.flatMap((zona) => {
    const daZona = estruturas.filter((e) => e.zona === zona).map(retanguloDa)
    if (!daZona.length) return []
    const folga = 0.5
    const x0 = Math.max(-ambiente.largura / 2, Math.min(...daZona.map((r) => r.x0)) - folga)
    const x1 = Math.min(ambiente.largura / 2, Math.max(...daZona.map((r) => r.x1)) + folga)
    const z0 = Math.max(-ambiente.profundidade / 2, Math.min(...daZona.map((r) => r.z0)) - folga)
    const z1 = Math.min(ambiente.profundidade / 2, Math.max(...daZona.map((r) => r.z1)) + folga)
    return [{ zona, x0, x1, z0, z1 }]
  })
}

export function Cenario({ tema, ambiente, estruturas, mats }: { tema: Tema; ambiente: Pick<Ambiente, 'largura' | 'profundidade'>; estruturas: Estrutura[]; mats: Materiais }) {
  const v = VISUAL[tema]
  const formas = useFormas()
  const L = ambiente.largura, P = ambiente.profundidade, A = v.alturaDaParede
  const parede = mats.de(v.parede)
  const pecas: ReactNode[] = []
  /* o que está colado na parede do fundo some com ela (casa de bonecas) */
  const doFundo: ReactNode[] = []
  const lista = (p: V3) => (p[2] < -P / 2 + 0.25 && p[1] > 0.05 ? doFundo : pecas)
  const caixa = (p: V3, t: V3, m: Material, redonda = false, sombra = false) =>
    lista(p).push(<mesh key={`c${pecas.length + doFundo.length}`} geometry={redonda ? mats.geometria.arredondado : mats.geometria.cubo} material={m} position={p} scale={t} castShadow={sombra} receiveShadow />)
  const forma = (g: keyof typeof formas, p: V3, t: V3, m: Material, giro: V3 = [0, 0, 0]) =>
    lista(p).push(<mesh key={`f${pecas.length + doFundo.length}`} geometry={formas[g]} material={m} position={p} scale={t} rotation={giro} castShadow receiveShadow />)
  const planta = (x: number, z: number, escala = 1) => {
    forma('cilindro', [x, 0.18 * escala, z], [0.32 * escala, 0.36 * escala, 0.32 * escala], mats.de(tema === 'loja_fofa' ? '#f7c8a8' : '#d8d2c8'))
    forma('esfera', [x, 0.55 * escala, z], [0.62 * escala, 0.62 * escala, 0.62 * escala], mats.de(tema === 'loja_fofa' ? '#9fd8b0' : '#5f9a6e'))
    forma('esfera', [x + 0.12 * escala, 0.78 * escala, z - 0.05], [0.4 * escala, 0.4 * escala, 0.4 * escala], mats.de(tema === 'loja_fofa' ? '#b7e6c3' : '#6fae7c'))
  }

  /* o chão, e uma beirada para ele não parecer recortado */
  caixa([0, -0.06, 0], [L + 0.3, 0.12, P + 0.3], mats.de(v.chao, tema === 'shopping' ? 'brilho' : 'fosco'))

  /* a marca de cada zona no piso */
  for (const z of areasDasZonas(estruturas, ambiente)) {
    const cx = (z.x0 + z.x1) / 2, cz = (z.z0 + z.z1) / 2, w = z.x1 - z.x0, d = z.z1 - z.z0
    if (tema === 'armazem') {
      /* as faixas amarelas pintadas em volta da zona */
      const faixa = mats.de(v.linha)
      caixa([cx, 0.004, z.z0], [w, 0.008, 0.08], faixa)
      caixa([cx, 0.004, z.z1], [w, 0.008, 0.08], faixa)
      caixa([z.x0, 0.004, cz], [0.08, 0.008, d], faixa)
      caixa([z.x1, 0.004, cz], [0.08, 0.008, d], faixa)
    }
    if (z.zona !== 'loja' || tema !== 'loja_fofa') caixa([cx, 0.002, cz], [w, 0.004, d], mats.de(v.zona[z.zona]))
  }

  if (tema === 'loja_fofa') {
    /* janelas com cortina, papel de parede listrado, plantinhas, tapetes e bandeirolas */
    for (const x of [-L / 4, L / 4]) {
      caixa([x, 1.45, -P / 2 + 0.01], [1.3, 0.95, 0.04], mats.de('#ffffff'), true)
      caixa([x, 1.45, -P / 2 + 0.03], [1.12, 0.8, 0.02], mats.de('#cfe9fb'))
      for (const s of [-1, 1]) caixa([x + s * 0.62, 1.4, -P / 2 + 0.06], [0.16, 1.1, 0.04], mats.de('#f7a3c6'), true)
    }
    for (let x = -L / 2 + 0.3; x < L / 2; x += 0.6) caixa([x, 0.45, -P / 2 + 0.005], [0.18, 0.9, 0.01], mats.de('#fbd5e3'))
    planta(-L / 2 + 0.6, P / 2 - 0.7, 1.2)
    planta(L / 2 - 0.6, -P / 2 + 0.7, 0.9)
    forma('disco', [0, 0.006, 1.2], [4.2, 3, 1], mats.de('#f9d7e5'), [-Math.PI / 2, 0, 0])
    forma('disco', [0, 0.008, 1.2], [3.4, 2.4, 1], mats.de('#fde9f1'), [-Math.PI / 2, 0, 0])
    const cores = ['#f7a3c6', '#b6a3f4', '#97d9c0', '#ffd394']
    for (let i = 0; i < 9; i++) {
      const x = -L / 2 + 0.6 + (i * (L - 1.2)) / 8
      caixa([x, A - 0.28 - Math.sin((i / 8) * Math.PI) * 0.12, -P / 2 + 0.12], [0.2, 0.22, 0.02], mats.de(cores[i % cores.length]!))
    }
    /* a porta do estoque, nos fundos */
    caixa([L / 2 - 1.1, 1, -P / 2 + 0.02], [0.9, 2, 0.05], mats.de('#c7b4f2'), true)
    forma('esfera', [L / 2 - 0.78, 1, -P / 2 + 0.08], [0.07, 0.07, 0.07], mats.de('#ffffff'))
  }

  if (tema === 'armazem') {
    /* as docas: portas de enrolar e para-choques zebrados */
    const docas = Math.max(2, Math.min(4, Math.round(L / 6)))
    for (let i = 0; i < docas; i++) {
      const x = -L / 2 + (L / (docas + 1)) * (i + 1)
      caixa([x, 1.5, -P / 2 + 0.02], [2.4, 3, 0.06], mats.de('#8e98a5', 'metal'))
      for (let k = 0; k < 10; k++) caixa([x, 0.15 + k * 0.29, -P / 2 + 0.06], [2.36, 0.04, 0.02], mats.de('#7a8491', 'metal'))
      for (const s of [-1, 1]) caixa([x + s * 1.3, 0.35, -P / 2 + 0.1], [0.12, 0.5, 0.12], mats.de('#1f2329'))
      caixa([x, 3.2, -P / 2 + 0.05], [1.2, 0.3, 0.04], mats.de('#e8772e'))
    }
    /* uma empilhadeira estacionada perto da expedição */
    const ex = L / 2 - 1.4, ez = P / 2 - 3
    caixa([ex, 0.55, ez], [0.9, 0.7, 1.3], mats.de('#f2c230'), false, true)
    caixa([ex, 1.15, ez + 0.1], [0.8, 0.06, 0.9], mats.de('#2c2f35'))
    for (const s of [-1, 1]) caixa([ex + s * 0.35, 1.1, ez - 0.55], [0.06, 1.9, 0.06], mats.de('#2c2f35'))
    for (const s of [-1, 1]) caixa([ex + s * 0.22, 0.1, ez - 1.05], [0.1, 0.05, 0.9], mats.de('#5b6068', 'metal'))
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) forma('cilindro', [ex + sx * 0.48, 0.18, ez + sz * 0.42], [0.36, 0.14, 0.36], mats.de('#1f2329'), [0, 0, Math.PI / 2])
  }

  if (tema === 'shopping') {
    /* a parede do depósito, com a passagem, separando a loja dos fundos */
    const deposito = areasDasZonas(estruturas, ambiente).find((z) => z.zona === 'deposito')
    if (deposito) {
      const zParede = deposito.z1 + 0.15
      const passagem = 1.2
      const xPassagem = L / 2 - 1.6
      const esquerda = xPassagem - passagem / 2 + L / 2
      caixa([-L / 2 + esquerda / 2, A / 2, zParede], [esquerda, A, 0.1], mats.vidro)
      caixa([-L / 2 + esquerda / 2, 1.1, zParede], [esquerda, 0.05, 0.11], mats.de(v.linha, 'metal'))
      const direita = L / 2 - (xPassagem + passagem / 2)
      caixa([L / 2 - direita / 2, A / 2, zParede], [direita, A, 0.1], parede)
    }
    /* a entrada é a frente aberta (é por ela que a câmera olha): uma soleira dourada no piso, e o letreiro na parede do fundo */
    caixa([0, 0.006, P / 2 - 0.08], [L, 0.012, 0.12], mats.de(v.linha, 'metal'))
    caixa([0, A - 0.35, -P / 2 + 0.02], [Math.min(4, L * 0.4), 0.36, 0.04], mats.de('#2b2a30', 'brilho'))
    caixa([0, A - 0.35, -P / 2 + 0.05], [Math.min(3.4, L * 0.34), 0.08, 0.02], mats.de(v.linha, 'metal'))
    planta(-L / 2 + 0.5, P / 2 - 0.9, 1.3)
    planta(L / 2 - 0.5, P / 2 - 0.9, 1.3)
  }
  return (
    <group>
      {pecas}
      <Paredes largura={L} profundidade={P} altura={A} material={parede} mats={mats}>{doFundo}</Paredes>
    </group>
  )
}

/** As três paredes (a frente é aberta), cada uma escondida quando a câmera está do lado de fora dela. */
function Paredes({ largura: L, profundidade: P, altura: A, material, mats, children }: { largura: number; profundidade: number; altura: number; material: Material; mats: Materiais; children: ReactNode }) {
  const fundo = useRef<Group>(null), esquerda = useRef<Group>(null), direita = useRef<Group>(null)
  useFrame(({ camera }) => {
    if (fundo.current) fundo.current.visible = camera.position.z > -P / 2
    if (esquerda.current) esquerda.current.visible = camera.position.x > -L / 2
    if (direita.current) direita.current.visible = camera.position.x < L / 2
  })
  const parede = (p: V3, t: V3) => <mesh geometry={mats.geometria.cubo} material={material} position={p} scale={t} receiveShadow />
  return (
    <>
      <group ref={fundo}>{parede([0, A / 2, -P / 2 - 0.08], [L + 0.32, A, 0.16])}{children}</group>
      <group ref={esquerda}>{parede([-(L / 2 + 0.08), A / 2, 0], [0.16, A, P + 0.32])}</group>
      <group ref={direita}>{parede([L / 2 + 0.08, A / 2, 0], [0.16, A, P + 0.32])}</group>
    </>
  )
}
