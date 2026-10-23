/**
 * O palco 3D — PLANO-ESTOQUE-3D.md, fatia 2.
 *
 * Só desenha: quem decide o que está selecionado, o que voa e de que cor é cada
 * produto é o `EspacoDoEstoque`. O canvas renderiza SOB DEMANDA (a terceira
 * lição do Viewer3D): parado, não gasta bateria; a câmera, os voos e cada
 * mudança de dado pedem o quadro que precisam.
 *
 * `flat`: as cores saem como foram escolhidas, sem o tone mapping que desbota
 * o pastel da lojinha.
 */

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { Canvas } from '@react-three/fiber'
import type { Ambiente, Endereco, Estrutura, Tema } from '@shared/enderecos'
import type { PosicaoNoMapa, ProdutoNoMapa } from '@/lib/api'
import { CameraDoEstoque, type ControleDaCamera, type OuvinteDeQuadro } from './camera'
import { Cenario } from './Cenario'
import { EstruturaNaCena, type EventosDaEstrutura } from './Estruturas'
import { criarMateriais } from './materiais'
import { Mercadoria, MonteAGuardar } from './Mercadoria'
import { Pegada, Projetor, Realce, Sinalizadores, type AlvoDeRotulo, type LevaDeVoos } from './Sinais'
import { VISUAL } from './temas'
import type { Ponto } from './voos'
import { Rua } from './Rua'
import { OperacaoAnimada, type EstadoDaOperacao } from './OperacaoAnimada'

export interface PropsDoPalco {
  tema: Tema
  ambiente: Pick<Ambiente, 'largura' | 'profundidade'>
  estruturas: Estrutura[]
  posicoes: PosicaoNoMapa[]
  produtos: ProdutoNoMapa[]
  cores: Map<string, string>
  chao: Ponto
  apontado?: Endereco | null
  selecionado?: Endereco | null
  destino?: Endereco | null
  sinais?: Ponto[]
  eventos?: EventosDaEstrutura
  aoClicarNoChao?: () => void
  aoApontarNoChao?: (dentro: boolean) => void
  aoClicarNoVazio?: () => void
  controle?: MutableRefObject<ControleDaCamera | null>
  voos?: MutableRefObject<LevaDeVoos[]>
  rotulos?: { ouvintes: MutableRefObject<Set<OuvinteDeQuadro>>; alvos: MutableRefObject<AlvoDeRotulo[]>; elementos: MutableRefObject<Map<string, HTMLElement>> }
  reduzirMovimento: boolean
  animacaoPausada?: boolean
  reinicioDaAnimacao?: number
  posicaoDaAssistente?: MutableRefObject<Ponto>
  aoEstadoDaAnimacao?: (estado: EstadoDaOperacao) => void
  /** a vitrine da escolha de tema: sem clique e sem rótulo */
  soVer?: boolean
  /** o editor: a pegada da estrutura em edição, e a câmera presa durante o arraste */
  pegada?: { retangulo: { x0: number; x1: number; z0: number; z1: number } | null; ok: boolean }
  cameraLivre?: MutableRefObject<boolean>
}

function Conteudo(props: PropsDoPalco) {
  const { tema, ambiente, estruturas } = props
  const mats = useMemo(() => criarMateriais(VISUAL[tema]), [tema])
  useEffect(() => () => mats.descartar(), [mats])
  const v = VISUAL[tema]
  const maior = Math.max(ambiente.largura, ambiente.profundidade)
  const sombra = (maior + 8) * 0.8
  return (
    <>
      <color attach="background" args={[v.fundo]} />
      <hemisphereLight args={[v.luz.ceu, v.luz.terra, v.luz.ambiente]} />
      <directionalLight
        position={[maior * 0.35, maior * 0.9, maior * 0.55]}
        color={v.luz.sol}
        intensity={v.luz.forca}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-sombra}
        shadow-camera-right={sombra}
        shadow-camera-top={sombra}
        shadow-camera-bottom={-sombra}
        shadow-camera-near={0.5}
        shadow-camera-far={maior * 3}
      />
      <CameraDoEstoque largura={ambiente.largura} profundidade={ambiente.profundidade} controle={props.controle} ouvintes={props.rotulos?.ouvintes} reduzirMovimento={props.reduzirMovimento} livre={props.cameraLivre} />
      <Rua ambiente={ambiente} tema={tema} mats={mats} />
      <Cenario tema={tema} ambiente={ambiente} estruturas={estruturas} mats={mats} />
      {estruturas.map((e) => <EstruturaNaCena key={e.id} e={e} tema={tema} mats={mats} eventos={props.eventos} clicavel={!props.soVer} />)}
      <Mercadoria tema={tema} estruturas={estruturas} posicoes={props.posicoes} cores={props.cores} mats={mats} />
      <MonteAGuardar
        ponto={props.chao}
        produtos={props.produtos}
        cores={props.cores}
        mats={mats}
        aoClicar={() => props.aoClicarNoChao?.()}
        aoApontar={(dentro) => props.aoApontarNoChao?.(dentro)}
      />
      {props.soVer ? null : (
        <>
          <Realce endereco={props.apontado ?? null} estruturas={estruturas} mats={mats} tipo="apontado" />
          <Realce endereco={props.selecionado ?? null} estruturas={estruturas} mats={mats} tipo="selecionado" />
          <Realce endereco={props.destino ?? null} estruturas={estruturas} mats={mats} tipo="destino" />
          <Sinalizadores pontos={props.sinais ?? []} mats={mats} />
          {props.pegada ? <Pegada retangulo={props.pegada.retangulo} ok={props.pegada.ok} mats={mats} /> : null}
        </>
      )}
      {/* a vitrine da escolha de tema não anima nada: sem Assistente, o modelo de 4,7 MB não desce antes da escolha */}
      {props.soVer ? null : <OperacaoAnimada tema={tema} ambiente={ambiente} estruturas={estruturas} mats={mats} fila={props.voos} reduzirMovimento={props.reduzirMovimento} pausada={props.animacaoPausada} reinicio={props.reinicioDaAnimacao} posicaoDaAssistente={props.posicaoDaAssistente} aoEstado={props.aoEstadoDaAnimacao} />}
      {props.rotulos ? <Projetor {...props.rotulos} /> : null}
    </>
  )
}

export function Palco(props: PropsDoPalco) {
  /* um clique no vazio limpa a seleção — mas só se não foi o fim de um arraste */
  const apertou = useRef<{ x: number; y: number } | null>(null)
  return (
    <Canvas
      /* "percentage" é o PCFShadowMap: o PCFSoftShadowMap, padrão do r3f, saiu do three r18x */
      shadows="percentage"
      frameloop="demand"
      flat
      dpr={[1, 2]}
      camera={{ fov: 42, near: 0.1, far: 400, position: [8, 8, 8] }}
      gl={{ antialias: true }}
      onPointerDown={(e) => { apertou.current = { x: e.clientX, y: e.clientY } }}
      onPointerMissed={(e) => {
        const a = apertou.current
        if (a && Math.hypot(e.clientX - a.x, e.clientY - a.y) < 6) props.aoClicarNoVazio?.()
      }}
      aria-label="O estoque em 3D. Arraste para girar, use a roda para aproximar e clique numa prateleira para ver o que tem nela."
    >
      <Conteudo {...props} />
    </Canvas>
  )
}
