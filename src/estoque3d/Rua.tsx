/** A rua dos três espaços — PLANO-ESTOQUE-3D.md, evolução 6.
 * A circulação fica fora da planta editável: ampliar o diorama não altera
 * nenhum endereço ou metro quadrado cadastrado no estoque.
 */
import { useEffect, useMemo } from 'react'
import { CylinderGeometry, SphereGeometry, Group, Mesh } from 'three'
import type { Tema } from '@shared/enderecos'
import type { Materiais } from './materiais'
import type { Dimensoes } from './caminhos'

type V3 = [number, number, number]
const CORES = {
  loja_fofa: { calcada: '#e6d7e9', jardim: '#b8d5bf', copa: '#94c6a9', toldo: '#bf8fd3' },
  armazem: { calcada: '#c3cbd0', jardim: '#9dab94', copa: '#7f9f83', toldo: '#efa94f' },
  shopping: { calcada: '#dcdde5', jardim: '#b2c7bc', copa: '#7da995', toldo: '#a9a2ce' },
}
export function Rua({ ambiente, tema, mats }: { ambiente: Dimensoes; tema: Tema; mats: Materiais }) {
  const c = CORES[tema], L = ambiente.largura, frente = ambiente.profundidade / 2
  const geos = useMemo(() => ({ cilindro: new CylinderGeometry(0.5, 0.5, 1, 12), bola: new SphereGeometry(0.5, 16, 12) }), [])
  useEffect(() => () => { geos.cilindro.dispose(); geos.bola.dispose() }, [geos])
  const caixa = (p: V3, s: V3, cor: string, redonda = false) => <mesh position={p} scale={s} geometry={redonda ? mats.geometria.arredondado : mats.geometria.cubo} material={mats.de(cor)} receiveShadow castShadow />
  return <group name="Rua e recebimento">
    {caixa([0, -0.4, 2.5], [L + 3.4, 0.32, ambiente.profundidade + 8.2], c.jardim, true)}
    {caixa([0, -0.09, frente + 1.03], [L + 2.6, 0.18, 2.1], c.calcada)}
    {caixa([0, -0.15, frente + 4.1], [L + 3.3, 0.12, 4], '#717586')}
    {caixa([0, -0.04, frente + 2.02], [L + 2.8, 0.22, 0.14], '#f3edf6')}
    {caixa([0, -0.11, frente + 6.15], [L + 3.3, 0.08, 0.18], '#ece6f0')}
    {Array.from({ length: Math.floor((L + 2) / 1.5) }, (_, i) => <group key={`faixa${i}`}>{caixa([-L / 2 + i * 1.5, -0.081, frente + 4.5], [0.8, 0.008, 0.08], '#eee7cd')}</group>)}
    {[-1, 1].map(s => <group key={s}>
      {caixa([s * (L / 2 + 0.65), 0.18, frente + 0.65], [0.7, 0.38, 0.7], '#eae2ed', true)}
      <mesh geometry={geos.cilindro} material={mats.de('#89756c')} position={[s * (L / 2 + 0.65), 0.85, frente + 0.65]} scale={[0.14, 1.4, 0.14]} castShadow />
      <mesh geometry={geos.bola} material={mats.de(c.copa)} position={[s * (L / 2 + 0.65), 1.7, frente + 0.65]} scale={[1.2, 1.3, 1.2]} castShadow />
      <mesh geometry={geos.bola} material={mats.de(c.jardim)} position={[s * (L / 2 + 0.78), 2.1, frente + 0.65]} scale={[0.8, 0.7, 0.8]} castShadow />
      {caixa([s * (L / 2 - 0.2), 1.4, frente + 1.55], [0.06, 2.8, 0.06], '#585367')}
      {caixa([s * (L / 2 - 0.2), 2.83, frente + 1.55], [0.36, 0.1, 0.36], '#fff0c9', true)}
    </group>)}
    {/* O pórtico marca a porta de entrada sem tampar a mercadoria. */}
    {[-1, 1].map(s => <group key={`porta${s}`}>{caixa([s * 1.5, 1.25, frente + 0.08], [0.075, 2.5, 0.075], c.toldo)}</group>)}
    {caixa([0, 2.5, frente + 0.08], [3.1, 0.12, 0.12], c.toldo, true)}
    {caixa([0, 0.012, frente + 0.65], [1.05, 0.024, 0.7], c.toldo, true)}
    {caixa([0, 0.026, frente + 0.65], [0.8, 0.004, 0.018], '#eee5fa')}
    {/* Travessia só na extremidade: a área junto à porta é da coleta. */}
    {Array.from({ length: 6 }, (_, i) => <group key={`travessia${i}`}>{caixa([-L / 2 + 0.7, -0.08, frente + 2.5 + i * 0.52], [1.35, 0.006, 0.27], '#eeeaf3')}</group>)}
  </group>
}

/** Caminhão autoral; a frente aponta para +x e a porta de carga fica na calçada (-z). */
export function criarCaminhao(mats: Materiais) {
  const grupo = new Group(); grupo.name = 'Caminhão de coleta'
  const rodaGeo = new CylinderGeometry(0.28, 0.28, 0.15, 20)
  const rodas: Mesh[] = []
  const caixa = (pai: Group, p: V3, s: V3, cor: string, redonda = true) => {
    const m = new Mesh(redonda ? mats.geometria.arredondado : mats.geometria.cubo, mats.de(cor)); m.position.set(...p); m.scale.set(...s); m.castShadow = true; pai.add(m); return m
  }
  caixa(grupo, [0, 0.32, 0], [3.1, 0.22, 1.25], '#383647')
  caixa(grupo, [-0.5, 1.08, 0], [2.05, 1.42, 1.3], '#f0eaf7')
  caixa(grupo, [1.06, 0.8, 0], [1.08, 1.12, 1.24], '#ad8bdb')
  caixa(grupo, [1.08, 1.44, 0], [1.07, 0.11, 1.27], '#c5a9e7')
  caixa(grupo, [1.603, 1.13, 0], [0.016, 0.43, 1.02], '#b9d8e6', false)
  for (const s of [-1, 1]) {
    caixa(grupo, [1.07, 1.13, s * 0.625], [0.72, 0.43, 0.016], '#b9d8e6', false)
    caixa(grupo, [0.82, 0.81, s * 0.633], [0.18, 0.035, 0.025], '#554866')
    caixa(grupo, [1.63, 0.65, s * 0.42], [0.045, 0.19, 0.24], '#fff0c0')
    caixa(grupo, [-1.54, 0.52, s * 0.44], [0.03, 0.17, 0.17], '#dd778b')
    for (const x of [-0.96, 1.02]) {
      const roda = new Mesh(rodaGeo, mats.de('#35333f')); roda.position.set(x, 0.27, s * 0.64); roda.rotation.x = Math.PI / 2; grupo.add(roda); rodas.push(roda)
      const calota = new Mesh(rodaGeo, mats.de('#b9b4c9')); calota.scale.set(0.48, 1.05, 0.48); roda.add(calota)
    }
    caixa(grupo, [-0.6, 1.03, s * 0.66], [1.4, 0.16, 0.02], '#ad8bdb', false)
  }
  caixa(grupo, [1.64, 0.39, 0], [0.12, 0.15, 1.13], '#f4f0fa')
  caixa(grupo, [1.66, 0.71, 0], [0.02, 0.17, 0.43], '#655476', false)
  caixa(grupo, [-0.45, 1.03, -0.665], [1.2, 1.05, 0.03], '#50465f', false)
  const porta = new Group(); porta.position.set(-1.05, 1.56, -0.69); grupo.add(porta)
  caixa(porta, [0.6, -0.53, 0], [1.2, 1.05, 0.045], '#e7def0', false)
  for (let k = 0; k < 5; k++) caixa(porta, [0.6, -0.13 - k * 0.19, -0.025], [1.15, 0.016, 0.008], '#cfc3dd', false)
  const carga = caixa(grupo, [-0.45, 0.7, -0.5], [0.4, 0.4, 0.4], '#cfa77f'); carga.visible = false
  return { grupo, porta, carga, rodar: (metros: number) => rodas.forEach(r => { r.rotation.y = metros / 0.28 }), descartar: () => rodaGeo.dispose() }
}
