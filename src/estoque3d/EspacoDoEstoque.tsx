/**
 * O estoque em 3D — PLANO-ESTOQUE-3D.md.
 *
 * Carregado sob demanda pela tela de Estoque (E7): o three.js e a cena só
 * baixam quando esta aba abre. Aqui mora o estado — o que está selecionado,
 * apontado, procurado, de que cor e em que vista —; o `Palco` só desenha.
 *
 * **O fluxo anda na tela.** A cada leitura do mapa (depois de uma ação, ou a
 * cada 20 s com a aba visível), a diferença para a leitura anterior vira voos
 * (`voos.ts`): a caixa sai da prateleira e vai para o caixa, chega pela doca e
 * cai no chão do recebimento. Vale para a ação de quem está aqui e para a de
 * qualquer outra pessoa do espaço.
 *
 * Toda gravação é do servidor e passa por `agir` (avisa e recarrega o painel);
 * a cena só mostra o que voltou.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, History, Layers, LayoutGrid, LocateFixed, Map as IconeDaPlanta, Rotate3d, X } from 'lucide-react'
import { NOMES_DAS_ZONAS, conferirEstrutura, retanguloDa, rotuloDoEndereco, sobrepoe, type Endereco, type Tema } from '@shared/enderecos'
import { NOMES_DOS_MOVIMENTOS, rotuloDaQuantidade, type TipoDeMovimento } from '@shared/estoque'
import { lucroApi, type MapaDoEstoque, type PosicaoNoMapa } from '@/lib/api'
import { agir, usePainel } from '@/lib/painel'
import { toast } from '@/lib/avisos'
import { Aviso, Botao, Combo, Selecao, erroDe, quantidade } from '@/components/ui'
import { coresDosProdutos, MODOS_DE_COR, type ModoDeCor } from './calor'
import type { ControleDaCamera, OuvinteDeQuadro } from './camera'
import { areasDasZonas } from './Cenario'
import { medidasDe } from './Estruturas'
import { EditorDoEspaco } from './EditorDoEspaco'
import { EscolhaDoEspaco } from './EscolhaDoEspaco'
import { JanelasDoEspaco, type Pedido } from './JanelasDoEspaco'
import { centroNoMundo, lugaresDoEspaco, pontoDoChao } from './lugares'
import { Palco } from './Palco'
import { PainelDoEspaco, type Selecao as SelecaoDoPainel } from './PainelDoEspaco'
import { celulaDa, type AlvoDeRotulo, type LevaDeVoos } from './Sinais'
import { voosDaDiferenca, voosDoMovimento } from './voos'

const ATUALIZAR_A_CADA = 20_000
const MOVIMENTOS_DO_REPLAY = 12

function usePrefereMenosMovimento(): boolean {
  const [reduzir, setReduzir] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const consulta = matchMedia('(prefers-reduced-motion: reduce)')
    const mudou = () => setReduzir(consulta.matches)
    consulta.addEventListener('change', mudou)
    return () => consulta.removeEventListener('change', mudou)
  }, [])
  return reduzir
}

const mesmo = (a: Endereco | null, b: Endereco | null) => !!a && !!b && a.estruturaId === b.estruturaId && a.nivel === b.nivel && a.vao === b.vao

export default function EspacoDoEstoque({ aoMudar }: { aoMudar: () => void }) {
  const estado = usePainel((s) => s.estado)!
  const escreve = estado.podeEscrever
  const reduzirMovimento = usePrefereMenosMovimento()
  const [mapa, setMapa] = useState<MapaDoEstoque | null>(null)
  const [erro, setErro] = useState('')
  const [modoDeCor, setModoDeCor] = useState<ModoDeCor>('categoria')
  const [planta, setPlanta] = useState(false)
  const [apontado, setApontado] = useState<Endereco | null>(null)
  const [chaoApontado, setChaoApontado] = useState(false)
  const [selecao, setSelecao] = useState<SelecaoDoPainel>(null)
  const [procurado, setProcurado] = useState('')
  const [pedido, setPedido] = useState<Pedido | null>(null)
  /* "clique na posição de destino": o pedido de mudança espera o clique no mapa */
  const [escolhendoDestino, setEscolhendoDestino] = useState<Extract<Pedido, { tipo: 'mover' }> | null>(null)
  const [legenda, setLegenda] = useState('')
  /* o editor da planta (fatia 6): a estrutura em edição e a que está sendo arrastada */
  const [editando, setEditando] = useState(false)
  const [editada, setEditada] = useState<string | null>(null)
  const [arrasto, setArrasto] = useState<{ id: string; dx: number; dz: number; x: number; z: number; x0: number; z0: number } | null>(null)
  const cameraLivre = useRef(true)
  /* palco estreito (celular): só o rótulo da estrutura apontada ou escolhida, senão os nomes cobrem a cena */
  const palco = useRef<HTMLDivElement>(null)
  const [estreito, setEstreito] = useState(false)
  useEffect(() => {
    const el = palco.current
    if (!el || typeof ResizeObserver !== 'function') return
    const observar = new ResizeObserver(([e]) => setEstreito((e?.contentRect.width ?? 1000) < 640))
    observar.observe(el)
    return () => observar.disconnect()
  }, [!!mapa?.ambiente])

  const controle = useRef<ControleDaCamera | null>(null)
  const voos = useRef<LevaDeVoos[]>([])
  const ouvintes = useRef(new Set<OuvinteDeQuadro>())
  const alvos = useRef<AlvoDeRotulo[]>([])
  const elementos = useRef(new Map<string, HTMLElement>())
  const anterior = useRef<MapaDoEstoque | null>(null)
  const relogios = useRef<number[]>([])
  /* cada leitura do mapa leva um número; a que chega depois de uma mais nova é descartada */
  const leitura = useRef(0)

  /** Lê o mapa e, se a planta é a mesma, anima o que mudou desde a última leitura. */
  const carregar = useCallback(async (animar: boolean) => {
    const minha = ++leitura.current
    try {
      const novo = await lucroApi.mapaDoEstoque()
      /* a releitura de 20 s e a de depois de gravar podem voltar trocadas: a velha não volta o mapa um passo nem anima ao contrário */
      if (minha !== leitura.current) return
      const antes = anterior.current
      if (animar && antes?.ambiente && novo.ambiente && antes.ambiente.revisao === novo.ambiente.revisao) {
        const leva = voosDaDiferenca(antes, novo, lugaresDoEspaco(novo.estruturas, novo.ambiente))
        if (leva.length) voos.current = [...voos.current, { voos: leva, inicio: performance.now() }]
      }
      anterior.current = novo
      setMapa(novo)
      setErro('')
    } catch (e) {
      if (minha === leitura.current) setErro(erroDe(e))
    }
  }, [])

  useEffect(() => { void carregar(false) }, [carregar])

  /* o fluxo de quem mais está trabalhando no espaço: relê enquanto a aba está à vista e ninguém está no meio de uma ação */
  const ocupadoComAcao = !!pedido || !!escolhendoDestino || editando
  useEffect(() => {
    const relogio = setInterval(() => {
      if (document.visibilityState === 'visible' && !ocupadoComAcao) void carregar(true)
    }, ATUALIZAR_A_CADA)
    return () => clearInterval(relogio)
  }, [carregar, ocupadoComAcao])

  useEffect(() => () => { for (const r of relogios.current) clearTimeout(r) }, [])

  useEffect(() => { controle.current?.planta(planta) }, [planta])
  /* organizar é olhar de cima, e o botão esquerdo passa a ser das estruturas */
  useEffect(() => {
    if (editando) {
      setPlanta(true)
      /* o que estava apontado ou à espera de um destino não vale no editor */
      setApontado(null)
      setEscolhendoDestino(null)
    }
    cameraLivre.current = !editando
  }, [editando])

  const tema: Tema = mapa?.ambiente?.tema ?? 'loja_fofa'
  /* durante o arraste, a estrutura (e a mercadoria nela) já aparece no lugar novo */
  const estruturasNaTela = useMemo(
    () => (mapa?.estruturas ?? []).map((e) => (arrasto && e.id === arrasto.id ? { ...e, x: arrasto.x, z: arrasto.z } : e)),
    [mapa?.estruturas, arrasto],
  )
  /* a pegada da estrutura em edição: verde se cabe, vermelha se bate ou sai — a mesma conta do servidor */
  const pegada = useMemo(() => {
    const e = editando && editada ? estruturasNaTela.find((x) => x.id === editada) : undefined
    if (!e || !mapa?.ambiente) return undefined
    const r = retanguloDa(e)
    const ok = !conferirEstrutura(e, mapa.ambiente) && !estruturasNaTela.some((o) => o.id !== e.id && sobrepoe(r, retanguloDa(o)))
    return { retangulo: r, ok }
  }, [editando, editada, estruturasNaTela, mapa?.ambiente])
  const cores = useMemo(() => coresDosProdutos(modoDeCor, tema, mapa?.produtos ?? []), [modoDeCor, tema, mapa?.produtos])
  const porProduto = useMemo(() => new Map((mapa?.produtos ?? []).map((p) => [p.id, p])), [mapa?.produtos])
  const porEstrutura = useMemo(() => new Map((mapa?.estruturas ?? []).map((e) => [e.id, e])), [mapa?.estruturas])
  const chao = useMemo(() => (mapa?.ambiente ? pontoDoChao(mapa.estruturas, mapa.ambiente) : { x: 0, y: 0, z: 0 }), [mapa?.ambiente, mapa?.estruturas])

  /* o produto procurado: um sinalizador sobre cada posição dele, e no chão se houver a guardar */
  const sinais = useMemo(() => {
    if (!mapa || !procurado) return []
    const pontos = mapa.posicoes.filter((p) => p.produtoId === procurado).flatMap((p) => {
      const e = porEstrutura.get(p.estruturaId)
      return e ? [centroNoMundo(e, p.nivel, p.vao)] : []
    })
    if (Number(porProduto.get(procurado)?.aGuardar ?? 0) > 0) pontos.push({ ...chao, y: 0.6 })
    return pontos
  }, [mapa, procurado, porEstrutura, porProduto, chao])

  const procurar = (produtoId: string) => {
    setProcurado(produtoId)
    if (!produtoId || !mapa) return
    const pontos = mapa.posicoes.filter((p) => p.produtoId === produtoId).flatMap((p) => {
      const e = porEstrutura.get(p.estruturaId)
      return e ? [centroNoMundo(e, p.nivel, p.vao)] : []
    })
    const alvo = pontos.length ? pontos : [chao]
    controle.current?.voarPara(alvo.reduce((s, p) => s + p.x, 0) / alvo.length, alvo.reduce((s, p) => s + p.z, 0) / alvo.length, 5.5)
  }

  /*
   * ── os rótulos de HTML: zonas, a mercadoria, o apontado e o "a guardar" ──
   * A etiqueta vai no ITEM, não no lugar: quem olha quer saber o que tem ali, e
   * o nome da estante já aparece ao apontar. O nome das estruturas só volta no
   * editor da planta, onde é a estrutura que se escolhe.
   */
  const rotulos = useMemo(() => {
    if (!mapa?.ambiente) return []
    const lista: Array<AlvoDeRotulo & { texto: string; classe: string; detalhe?: string; cor?: string }> = []
    for (const z of areasDasZonas(mapa.estruturas, mapa.ambiente)) {
      lista.push({ chave: `zona:${z.zona}`, ponto: { x: (z.x0 + z.x1) / 2, y: 0.02, z: z.z1 - 0.2 }, texto: NOMES_DAS_ZONAS[z.zona], classe: 'zone' })
    }
    const foco = escolhendoDestino ? apontado : apontado ?? (selecao?.tipo === 'posicao' ? selecao.endereco : null)
    if (editando) {
      for (const e of estruturasNaTela) lista.push({ chave: `est:${e.id}`, ponto: { x: e.x, y: medidasDe(e).altura + 0.32, z: e.z }, texto: e.nome, classe: 'structure' })
    } else {
      const celulas = new Map<string, { endereco: Endereco; ocupantes: PosicaoNoMapa[] }>()
      for (const p of mapa.posicoes) {
        const chave = `${p.estruturaId}:${p.nivel}:${p.vao}`
        const c = celulas.get(chave) ?? { endereco: { estruturaId: p.estruturaId, nivel: p.nivel, vao: p.vao }, ocupantes: [] }
        c.ocupantes.push(p)
        celulas.set(chave, c)
      }
      /* muitas posições (ou o celular): só as da estrutura apontada ou escolhida, senão as etiquetas cobrem a cena */
      const todas = celulas.size <= 36 && !estreito
      const naTela = new Map(estruturasNaTela.map((e) => [e.id, e]))
      for (const [chave, { endereco, ocupantes }] of celulas) {
        const e = naTela.get(endereco.estruturaId)
        if (!e || endereco.nivel >= e.niveis || endereco.vao >= e.vaos) continue
        if (!todas && e.id !== foco?.estruturaId) continue
        /* a posição em foco já tem o balão completo */
        if (mesmo(endereco, foco)) continue
        const [maior, ...outros] = [...ocupantes].sort((a, b) => Number(b.quantidade) - Number(a.quantidade))
        const p = porProduto.get(maior!.produtoId)
        const c = celulaDa(e, endereco.nivel, endereco.vao)
        lista.push({
          chave: `item:${chave}`,
          ponto: { x: c.centro[0], y: c.centro[1], z: c.centro[2] },
          texto: p?.nome ?? '—',
          detalhe: outros.length ? `+ ${outros.length} produto${outros.length > 1 ? 's' : ''}` : p ? rotuloDaQuantidade(maior!.quantidade, p.unidade) : undefined,
          cor: cores.get(maior!.produtoId),
          classe: 'item',
        })
      }
    }
    const aGuardar = mapa.produtos.reduce((s, p) => s + Number(p.aGuardar), 0)
    if (aGuardar > 0) lista.push({ chave: 'chao', ponto: { ...chao, y: 1.25 }, texto: 'A guardar', detalhe: `${quantidade(aGuardar)} item(ns)`, classe: `floor${chaoApontado ? ' hover' : ''}` })
    const e = foco ? porEstrutura.get(foco.estruturaId) : undefined
    if (foco && e && !editando) {
      const c = celulaDa(e, foco.nivel, foco.vao)
      const aqui = mapa.posicoes.filter((p) => mesmo(p, foco))
      lista.push({
        chave: 'foco',
        ponto: { x: c.centro[0], y: c.centro[1] + c.tamanho[1] / 2 + 0.1, z: c.centro[2] },
        texto: escolhendoDestino ? `Levar para ${rotuloDoEndereco(e, foco.nivel, foco.vao)}` : rotuloDoEndereco(e, foco.nivel, foco.vao),
        detalhe: escolhendoDestino ? undefined : aqui.length
          ? aqui.map((p) => { const d = porProduto.get(p.produtoId); return `${d?.nome ?? '—'}: ${d ? rotuloDaQuantidade(p.quantidade, d.unidade) : quantidade(p.quantidade)}` }).join(' · ')
          : 'Vazia',
        classe: 'focus',
      })
    }
    return lista
  }, [mapa, estruturasNaTela, estreito, apontado, selecao, chao, chaoApontado, escolhendoDestino, editando, porEstrutura, porProduto, cores])

  useLayoutEffect(() => {
    alvos.current = rotulos
    controle.current?.redesenhar()
  }, [rotulos])

  /* ── as ações ── */

  const depoisDeGravar = async () => {
    await carregar(true)
    aoMudar()
  }

  const montar = async (t: Tema) => {
    if ((await agir(() => lucroApi.montarEspaco(t), 'Espaço montado. Agora é guardar a mercadoria nas posições.')) !== null) {
      await carregar(false)
      aoMudar()
    }
  }

  const clicarNaPosicao = (endereco: Endereco) => {
    if (escolhendoDestino) {
      setPedido({ ...escolhendoDestino, destino: endereco })
      setEscolhendoDestino(null)
      return
    }
    setSelecao({ tipo: 'posicao', endereco })
  }

  const replay = () => {
    if (!mapa?.ambiente) return
    for (const r of relogios.current) clearTimeout(r)
    const lugares = lugaresDoEspaco(mapa.estruturas, mapa.ambiente)
    const ultimos = [...mapa.movimentos].slice(0, MOVIMENTOS_DO_REPLAY).reverse()
    if (!ultimos.length) { setLegenda('Ainda não há movimentações para mostrar.'); return }
    const passo = reduzirMovimento ? 1600 : 900
    const leva = ultimos.flatMap((m, i) => voosDoMovimento(m, lugares, i * passo))
    voos.current = [...voos.current, { voos: leva, inicio: performance.now() }]
    controle.current?.redesenhar()
    relogios.current = ultimos.map((m, i) => window.setTimeout(() => {
      const p = porProduto.get(m.produtoId)
      const quando = new Date(m.criadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      const q = m.tipo === 'transferencia' ? (m.linhas.find((l) => Number(l.quantidade) > 0)?.quantidade ?? m.linhas[0]?.quantidade ?? '0') : m.quantidade
      setLegenda(`${quando} · ${NOMES_DOS_MOVIMENTOS[m.tipo as TipoDeMovimento] ?? m.tipo} · ${p?.nome ?? 'Produto'} · ${quantidade(Math.abs(Number(q)))} ${p?.unidade ?? ''}`)
    }, i * passo))
    relogios.current.push(window.setTimeout(() => setLegenda(''), ultimos.length * passo + 1500))
  }

  /* o editor: clicar escolhe a estrutura; arrastar muda o lugar dela, com encaixe de 10 cm, e grava ao soltar */
  const encaixe = (v: number) => Math.round(v * 10) / 10
  const eventosDoEditor = {
    aoApontar: () => undefined,
    aoClicar: (e: Endereco) => setEditada(e.estruturaId),
    arraste: {
      aoComecar: (id: string, x: number, z: number) => {
        const e = porEstrutura.get(id)
        if (!e) return
        setEditada(id)
        setArrasto({ id, dx: e.x - x, dz: e.z - z, x: e.x, z: e.z, x0: e.x, z0: e.z })
      },
      aoMover: (x: number, z: number) => setArrasto((a) => (a ? { ...a, x: encaixe(x + a.dx), z: encaixe(z + a.dz) } : a)),
      aoSoltar: () => {
        const a = arrasto
        if (!a || (a.x === a.x0 && a.z === a.z0)) { setArrasto(null); return }
        if (pegada && !pegada.ok) {
          toast.error('Ali não cabe: a estrutura bate em outra ou sai do espaço.')
          setArrasto(null)
          return
        }
        void agir(() => lucroApi.alterarEstrutura(a.id, { x: a.x, z: a.z }), 'Estrutura no lugar novo.').then(async () => {
          await carregar(false)
          setArrasto(null)
        })
      },
    },
  }

  const painel = (s: SelecaoDoPainel) => (
    <PainelDoEspaco
      mapa={mapa!}
      selecao={s}
      escreve={escreve}
      cores={cores}
      aoFechar={() => setSelecao(null)}
      aoPedir={(p) => setPedido(p)}
      aoProcurar={procurar}
      aoSelecionar={(endereco) => { setSelecao({ tipo: 'posicao', endereco }); const e = porEstrutura.get(endereco.estruturaId); if (e) { const c = centroNoMundo(e, endereco.nivel, endereco.vao); controle.current?.voarPara(c.x, c.z) } }}
    />
  )

  if (erro && !mapa) return <Aviso tipo="erro">{erro}</Aviso>
  if (!mapa) return <div className="skeleton space-loading section-gap" />
  if (!mapa.ambiente) return <EscolhaDoEspaco mapa={mapa} escreve={escreve} aoMontar={montar} reduzirMovimento={reduzirMovimento} />
  const ambiente = mapa.ambiente

  return (
    <section className="space section-gap">
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {editando ? null : painel(null)}
      {mapa.produtosTruncados ? <Aviso tipo="atencao">O espaço mostra os primeiros 2.000 produtos. Use a lista para ver todos.</Aviso> : null}
      <div className="space-toolbar">
        {escreve ? (
          <Selecao
            rotulo="Tema"
            valor={tema}
            aoMudar={async (t) => {
              if ((await agir(() => lucroApi.alterarEspaco({ tema: t }), 'Tema trocado. A planta e a mercadoria continuam no lugar.')) !== null) {
                await carregar(false)
                controle.current?.inicio()
              }
            }}
            opcoes={mapa.temas.map((t) => ({ valor: t.tema, rotulo: t.nome }))}
          />
        ) : null}
        <Selecao rotulo="Cores" valor={modoDeCor} aoMudar={setModoDeCor} opcoes={(Object.keys(MODOS_DE_COR) as ModoDeCor[]).map((m) => ({ valor: m, rotulo: MODOS_DE_COR[m].nome }))} />
        <div className="space-find">
          <Combo
            rotulo="Localizar produto"
            valor={procurado}
            aoMudar={procurar}
            marcador="Onde está…"
            opcoes={mapa.produtos.map((p) => ({ valor: p.id, rotulo: p.nome }))}
          />
          {procurado ? <button className="icon-button" aria-label="Parar de localizar" onClick={() => setProcurado('')}><X size={17} /></button> : null}
        </div>
        <div className="space-view" role="group" aria-label="Vista">
          <button className={planta ? '' : 'active'} onClick={() => setPlanta(false)}><Rotate3d size={16} />3D</button>
          <button className={planta ? 'active' : ''} onClick={() => setPlanta(true)}><IconeDaPlanta size={16} />Planta</button>
        </div>
        <Botao variante="fantasma" onClick={replay}><History size={16} />Ver o movimento</Botao>
        {escreve ? <Botao variante={editando ? 'primario' : 'fantasma'} onClick={() => { setEditando(!editando); setEditada(null); setSelecao(null) }}><LayoutGrid size={16} />{editando ? 'Organizando…' : 'Organizar o espaço'}</Botao> : null}
        <Botao variante="fantasma" onClick={() => controle.current?.inicio()} aria-label="Voltar ao enquadramento inicial"><Crosshair size={16} /></Botao>
      </div>

      <div ref={palco} className={`space-stage${escolhendoDestino ? ' choosing' : ''}`}>
        <Palco
          tema={tema}
          ambiente={ambiente}
          estruturas={estruturasNaTela}
          posicoes={mapa.posicoes}
          produtos={mapa.produtos}
          cores={cores}
          chao={chao}
          pegada={pegada}
          cameraLivre={cameraLivre}
          apontado={escolhendoDestino || editando ? null : apontado}
          destino={escolhendoDestino ? apontado : null}
          selecionado={selecao?.tipo === 'posicao' ? selecao.endereco : null}
          sinais={sinais}
          eventos={editando ? eventosDoEditor : { aoApontar: setApontado, aoClicar: clicarNaPosicao }}
          aoClicarNoChao={() => { if (!escolhendoDestino) setSelecao({ tipo: 'chao' }) }}
          aoApontarNoChao={setChaoApontado}
          aoClicarNoVazio={() => { if (!escolhendoDestino) setSelecao(null) }}
          controle={controle}
          voos={voos}
          rotulos={{ ouvintes, alvos, elementos }}
          reduzirMovimento={reduzirMovimento}
        />
        <div className="space-labels" aria-hidden="true">
          {rotulos.map((r) => (
            <div key={r.chave} className={`space-label ${r.classe}`} ref={(el) => { if (el) elementos.current.set(r.chave, el); else elementos.current.delete(r.chave) }}>
              <span style={r.cor ? { borderLeftColor: r.cor } : undefined}><strong>{r.texto}</strong>{r.detalhe ? <small>{r.detalhe}</small> : null}</span>
            </div>
          ))}
        </div>
        {escolhendoDestino ? (
          <div className="space-banner" role="status">
            <LocateFixed size={17} />
            <span>Clique na posição para onde vai <strong>{porProduto.get(escolhendoDestino.produtoId)?.nome}</strong>.</span>
            <Botao variante="fantasma" onClick={() => setEscolhendoDestino(null)}>Cancelar</Botao>
          </div>
        ) : null}
        {legenda ? <div className="space-caption" role="status"><History size={15} />{legenda}</div> : null}
        {MODOS_DE_COR[modoDeCor].legenda.length ? (
          <ul className="space-legend" aria-label={`Legenda: ${MODOS_DE_COR[modoDeCor].nome}`}>
            {MODOS_DE_COR[modoDeCor].legenda.map(([cor, texto]) => <li key={texto}><i style={{ background: cor }} />{texto}</li>)}
          </ul>
        ) : null}
        {/* a posição escolhida, o "a guardar" e o editor flutuam sobre a cena, à direita: ela fica com a largura toda */}
        {editando ? (
          <div className="space-float">
            <EditorDoEspaco mapa={mapa} editada={editada} aoEditar={setEditada} aoConcluir={() => { setEditando(false); setEditada(null) }} aoGravar={() => carregar(false)} />
          </div>
        ) : selecao ? (
          <div className="space-float">{painel(selecao)}</div>
        ) : null}
        <p className="space-hint"><Layers size={13} />Clique numa estrutura, num item ou no chão do recebimento para ver os detalhes. Arraste para girar; botão direito ou Shift para mover; roda para aproximar.</p>
      </div>

      <JanelasDoEspaco
        mapa={mapa}
        pedido={pedido}
        aoFechar={() => setPedido(null)}
        aoEscolherNoMapa={(p) => { setPedido(null); setEscolhendoDestino(p) }}
        aoGravar={depoisDeGravar}
      />
    </section>
  )
}
