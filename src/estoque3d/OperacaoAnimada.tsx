/** A Assistente executa a fila de estoque — PLANO-ESTOQUE-3D.md, evolução 6.
 * Tempo local, passos limitados e demand: aba oculta não pula uma entrega,
 * animação parada não pede quadros. O mapa confirmado nunca espera este motor.
 */
import { Component, Suspense, useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { Group, Mesh, TextureLoader, Vector3 } from 'three'
import type { Estrutura, Tema } from '@shared/enderecos'
import type { Materiais } from './materiais'
import type { LevaDeVoos } from './Sinais'
import type { Ponto, Voo } from './voos'
import { criarNavegacao, descansoDaAssistente, percorrerCaminho, type Dimensoes } from './caminhos'
import { ALTURA_DA_CARGA, criarAssistente } from './Assistente'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import modeloDaAssistente from '@/assets/assistente/assistente.glb?url'
import { criarCaminhao } from './Rua'
import { GIRO_DE_REPOUSO, NOMES_DAS_FASES, planejarTarefa, suavizar, VELOCIDADE, type Tarefa } from './tarefas'

export interface EstadoDaOperacao { texto: string; produtoId?: string; pendentes: number; ativa: boolean }
interface PropsDaOperacao {
  ambiente: Dimensoes; tema: Tema; estruturas: Estrutura[]; mats: Materiais; fila?: MutableRefObject<LevaDeVoos[]>;
  posicaoDaAssistente?: MutableRefObject<Ponto>;
  reduzirMovimento: boolean; pausada?: boolean; reinicio?: number; aoEstado?: (estado: EstadoDaOperacao) => void
}
function OperacaoComAssistente({ ambiente, tema, estruturas, mats, fila, reduzirMovimento, pausada, reinicio, posicaoDaAssistente, aoEstado }: PropsDaOperacao) {
  const invalidate = useThree(s => s.invalidate)
  const assinatura = estruturas.map(e => `${e.id}:${e.tipo}:${e.x}:${e.z}:${e.rotacao}:${e.vaos}:${e.niveis}`).join('|')
  const nav = useMemo(() => criarNavegacao(ambiente, estruturas, tema), [ambiente.largura, ambiente.profundidade, assinatura, tema])
  const arquivo = useLoader(GLTFLoader, modeloDaAssistente, loader => {
    loader.register(parser => {
      // ImageBitmapLoader usa fetch(blob:), barrado pelo connect-src do painel.
      // TextureLoader usa <img>, já permitido por img-src, sem mudar a CSP.
      parser.textureLoader = new TextureLoader(parser.options.manager)
      return { name: 'texturas-locais-da-assistente' }
    })
  })
  const modelo = useMemo(() => criarAssistente(arquivo), [arquivo])
  const caminhao = useMemo(() => criarCaminhao(mats), [mats])
  const caixa = useMemo(() => {
    const g = new Group(); g.name = 'Encomenda em movimento'
    const pacote = new Mesh(mats.geometria.arredondado, mats.de('#caa47f')); pacote.scale.set(0.7, 0.4, 0.42); pacote.castShadow = true; g.add(pacote)
    const fita = new Mesh(mats.geometria.cubo, mats.de('#eddbc0')); fita.scale.set(0.07, 0.405, 0.425); g.add(fita)
    const etiqueta = new Mesh(mats.geometria.cubo, mats.de('#fff8ef')); etiqueta.position.set(0.18, 0.01, 0.213); etiqueta.scale.set(0.1, 0.11, 0.003); g.add(etiqueta)
    return g
  }, [mats])
  const elevador = useMemo(() => {
    const g = new Group(); g.name = 'Plataforma de alcance'
    const base = new Mesh(mats.geometria.arredondado, mats.de('#a99abb')); base.scale.set(0.7, 0.08, 0.65); g.add(base)
    const topo = base.clone(); g.add(topo)
    const hastes = [-1, 1].map(s => {
      const h = new Mesh(mats.geometria.cubo, mats.de('#80738f')); h.scale.set(0.045, 1, 0.045); h.position.x = s * 0.26; g.add(h); return h
    })
    return { grupo: g, ajustar: (h: number) => { topo.position.y = h; hastes.forEach(v => { v.scale.y = h; v.position.y = h / 2 }) } }
  }, [mats])
  const atual = useRef<{ tarefa: Tarefa; etapa: number; tempo: number } | null>(null)
  const pendentes = useRef<Voo[]>([])
  const estadoAnterior = useRef('')
  const iniciada = useRef(false)
  const mao = useMemo(() => new Vector3(), [])
  const alvoDaCaixa = useMemo(() => new Vector3(), [])
  const visivel = useRef(typeof document === 'undefined' || document.visibilityState === 'visible')
  const anunciar = (texto: string, ativa: boolean, produtoId?: string) => {
    const chave = `${texto}:${produtoId}:${pendentes.current.length}:${ativa}`
    if (chave === estadoAnterior.current) return
    estadoAnterior.current = chave
    aoEstado?.({ texto, ativa, produtoId, pendentes: pendentes.current.length })
  }
  useEffect(() => () => modelo.descartar(), [modelo])
  useEffect(() => () => caminhao.descartar(), [caminhao])
  useEffect(() => {
    const mudou = () => { visivel.current = document.visibilityState === 'visible'; if (visivel.current) invalidate() }
    document.addEventListener('visibilitychange', mudou)
    return () => document.removeEventListener('visibilitychange', mudou)
  }, [invalidate])
  useEffect(() => {
    atual.current = null; pendentes.current = []
    if (fila && iniciada.current) fila.current = []
    iniciada.current = true
    const inicio = descansoDaAssistente(ambiente)
    if (posicaoDaAssistente) posicaoDaAssistente.current = inicio
    modelo.grupo.position.set(inicio.x, 0, inicio.z); modelo.grupo.rotation.y = GIRO_DE_REPOUSO
    modelo.animar({ andando: false, carregando: false, delta: 0, imediato: true }); caminhao.grupo.visible = false; caixa.visible = false; elevador.grupo.visible = false
    anunciar(reduzirMovimento ? 'Movimento reduzido: estoque atualizado sem animação' : 'Assistente pronta para o próximo movimento', false)
    invalidate()
  }, [nav, reinicio, reduzirMovimento, modelo])
  useEffect(() => { invalidate() }, [pausada, invalidate])

  useFrame((_, delta) => {
    if (reduzirMovimento) { if (fila) fila.current = []; return }
    if (!visivel.current) return
    if (fila?.current.length) {
      const recebidos = fila.current.flatMap(l => l.voos)
      fila.current = []
      // O mapa já representa tudo. Limitamos apenas o replay visual para não
      // transformar uma importação grande em horas de espera da interface.
      pendentes.current = [...pendentes.current, ...recebidos].slice(-48)
    }
    if (pausada) return
    if (!atual.current && pendentes.current.length) {
      const voo = pendentes.current.shift()!
      const origem: Ponto = { x: modelo.grupo.position.x, y: 0, z: modelo.grupo.position.z }
      const tarefa = planejarTarefa(voo, origem, nav, ambiente)
      if (!tarefa) {
        anunciar('Sem passagem até essa posição. Libere um corredor em Organizar o espaço.', false, voo.produtoId)
        if (pendentes.current.length) invalidate()
        return
      }
      atual.current = { tarefa, etapa: 0, tempo: 0 }
      caminhao.grupo.visible = voo.operacao === 'entregar'; caminhao.carga.visible = false
      caminhao.porta.rotation.x = 0
    }
    const a = atual.current
    if (!a) return
    const dt = Math.min(delta, 0.06); a.tempo += dt
    const etapa = a.tarefa.etapas[a.etapa]!, voo = a.tarefa.voo
    const t = Math.min(1, a.tempo / etapa.duracao)
    const andando = !!etapa.caminho
    const gesto = etapa.fase === 'pegar' || etapa.fase === 'guardar' ? etapa.fase : undefined
    let altura = 0
    anunciar(voo.legenda ? `${NOMES_DAS_FASES[etapa.fase]} · ${voo.legenda}` : NOMES_DAS_FASES[etapa.fase], true, voo.produtoId)
    if (etapa.caminho) {
      const p = percorrerCaminho(etapa.caminho, a.tempo * VELOCIDADE)
      modelo.grupo.position.set(p.ponto.x, 0, p.ponto.z)
      const diferenca = Math.atan2(Math.sin(p.giro - modelo.grupo.rotation.y), Math.cos(p.giro - modelo.grupo.rotation.y))
      modelo.grupo.rotation.y += diferenca * Math.min(1, dt * 14)
    }
    if (etapa.fase === 'orientar') {
      const diferenca = Math.atan2(Math.sin(GIRO_DE_REPOUSO - modelo.grupo.rotation.y), Math.cos(GIRO_DE_REPOUSO - modelo.grupo.rotation.y))
      modelo.grupo.rotation.y += diferenca * Math.min(1, dt * 14)
    }
    if (etapa.fase === 'pegar' || etapa.fase === 'guardar') {
      const alvo = etapa.fase === 'pegar' ? voo.de : voo.para
      const giro = Math.atan2(alvo.x - modelo.grupo.position.x, alvo.z - modelo.grupo.position.z)
      modelo.grupo.rotation.y += Math.atan2(Math.sin(giro - modelo.grupo.rotation.y), Math.cos(giro - modelo.grupo.rotation.y)) * Math.min(1, dt * 12)
      const subida = suavizar(t / 0.3) * (1 - suavizar((t - 0.7) / 0.3))
      altura = Math.max(0, alvo.y - ALTURA_DA_CARGA) * subida
    }
    if (posicaoDaAssistente) posicaoDaAssistente.current = { x: modelo.grupo.position.x, y: altura, z: modelo.grupo.position.z }
    modelo.grupo.position.y = altura
    modelo.animar({ andando, carregando: etapa.fase === 'levar', gesto, progresso: t, baixo: (etapa.fase === 'pegar' ? voo.de.y : voo.para.y) < 0.65, delta: dt })
    elevador.grupo.visible = altura > 0.01
    elevador.grupo.position.set(modelo.grupo.position.x, 0.03, modelo.grupo.position.z); elevador.ajustar(altura)
    modelo.grupo.updateMatrixWorld(true)
    modelo.centroDaCarga(mao)
    caixa.visible = ['buscar', 'pegar', 'levar', 'guardar'].includes(etapa.fase)
    caixa.rotation.y = modelo.grupo.rotation.y
    if (etapa.fase === 'buscar') caixa.position.set(voo.de.x, voo.de.y, voo.de.z)
    if (etapa.fase === 'levar') caixa.position.copy(mao)
    if (etapa.fase === 'pegar') caixa.position.set(voo.de.x, voo.de.y, voo.de.z).lerp(mao, suavizar((t - 0.3) / 0.35))
    if (etapa.fase === 'guardar') caixa.position.copy(mao).lerp(alvoDaCaixa.set(voo.para.x, voo.para.y, voo.para.z), suavizar((t - 0.35) / 0.3))
    const limite = ambiente.largura / 2 + 5
    const xCaminhao = etapa.fase === 'caminhao_chega' ? -limite * (1 - suavizar(t)) : etapa.fase === 'caminhao_sai' ? limite * suavizar(t) : 0
    caminhao.grupo.position.set(xCaminhao + 0.45, 0, ambiente.profundidade / 2 + 2.85)
    caminhao.rodar(xCaminhao)
    const portaAberta = etapa.fase === 'caminhao_chega' ? suavizar((t - 0.75) * 4) : etapa.fase === 'caminhao_sai' ? 1 - suavizar(t * 5) : 1
    caminhao.porta.rotation.x = -portaAberta * Math.PI * 0.48
    if (etapa.fase === 'guardar' && t > 0.65) caminhao.carga.visible = true
    if (t >= 1) {
      a.etapa++; a.tempo = 0
      if (etapa.fase === 'orientar') modelo.grupo.rotation.y = GIRO_DE_REPOUSO
      if (etapa.fase === 'caminhao_sai') caminhao.grupo.visible = false
      if (a.etapa >= a.tarefa.etapas.length) {
        atual.current = null; caixa.visible = false; caminhao.grupo.visible = false; elevador.grupo.visible = false
        modelo.grupo.position.y = 0; modelo.animar({ andando: false, carregando: false, delta: 0, imediato: true })
        anunciar(pendentes.current.length ? 'Preparando o próximo movimento' : 'Movimentação concluída', pendentes.current.length > 0)
      }
    }
    if (atual.current || pendentes.current.length) invalidate()
  })
  return <group name="Operação do estoque" dispose={null}>
    <primitive object={modelo.grupo} /><primitive object={caminhao.grupo} />
    <primitive object={caixa} /><primitive object={elevador.grupo} />
  </group>
}

/** Uma falha no asset não impede consultar ou movimentar o estoque. */
class LimiteDaAssistente extends Component<{ children: ReactNode; aoErro: () => void }, { erro: boolean }> {
  state = { erro: false }
  static getDerivedStateFromError() { return { erro: true } }
  componentDidCatch() { this.props.aoErro() }
  render() { return this.state.erro ? null : this.props.children }
}
function CarregandoAssistente({ aoEstado }: Pick<PropsDaOperacao, 'aoEstado'>) {
  useEffect(() => { aoEstado?.({ texto: 'Carregando assistente…', ativa: false, pendentes: 0 }) }, [aoEstado])
  return null
}
export function OperacaoAnimada(props: PropsDaOperacao) {
  return <LimiteDaAssistente aoErro={() => props.aoEstado?.({ texto: 'Não foi possível carregar a assistente. Atualize a página para tentar novamente.', ativa: false, pendentes: 0 })}>
    <Suspense fallback={<CarregandoAssistente aoEstado={props.aoEstado} />}>
      <OperacaoComAssistente {...props} />
    </Suspense>
  </LimiteDaAssistente>
}
