/**
 * Visão geral e Relatórios — o `dashboard.tsx` do mock, com a mesma marcação.
 *
 * Tudo aqui é lido do catálogo que a casca já carregou (`/api/estado`): a
 * margem de cada produto é a do cálculo que o SERVIDOR fez, com o preço
 * praticado quando há e o sugerido quando não há — a mesma base do mock.
 * Nada de faturamento, ROI ou tendência: sem venda registrada, seria inventar.
 */

import { BaixarArquivo } from '@/components/ArquivosDoEspaco'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, ArrowUpRight, Calculator, ChartNoAxesCombined, Check, Download, GitCompareArrows, Package, Percent, Plus,
  Store, Target, TriangleAlert,
} from 'lucide-react'
import type { Avaliacao } from '@shared/preco'
import { enderecos, type Estado, type Produto, type ResumoDaRevisao } from '@/lib/api'
import { usePainel } from '@/lib/painel'
import { Aviso, Botao, Selo, Vazio, brl, data, pct } from '@/components/ui'
import { ROTULO_DA_SITUACAO, SITUACOES, contarSituacoes, situacaoDoPreco, type SituacaoDoPreco } from '@/precos/situacao'


/** A avaliação que conta: a do preço que a pessoa cobra, e a sugerida enquanto não houver. */
export const avaliacaoDe = (p: Produto): Avaliacao | null => p.calculo?.atual ?? p.calculo?.resultado ?? null

/** Para abrir um produto no Precificar e voltar para a tela de onde saiu. */
export function useEditarProduto() {
  const navegar = useNavigate()
  return (p: Produto, voltar: string) => navegar(`/precificar/${p.id}`, { state: { voltar } })
}

export default function Inicio() {
  const estado = usePainel((s) => s.estado)!
  const navegar = useNavigate()
  const editar = useEditarProduto()
  const novo = () => navegar('/precificar')

  const produtos = estado.produtos.filter((p) => p.status === 'ativo')
  const validos = produtos.filter((p) => p.calculo)
  const media = validos.length ? validos.reduce((a, p) => a + Number(avaliacaoDe(p)!.margem), 0) / validos.length : null
  /*
   * O que pede decisão, do mais grave para o menos (PLANO-USABILIDADE-LUCRO.md, U3).
   * O tributo não conferido NÃO entra aqui: ele vale para o catálogo quase
   * inteiro e afogava o resto ("11 precisam de revisão", a mesma frase três
   * vezes). Vira um aviso só, logo abaixo dos cartões.
   */
  const contagem = contarSituacoes(produtos)
  const gravidade = (p: Produto) => SITUACOES.indexOf(situacaoDoPreco(p))
  const atencao = produtos.filter((p) => situacaoDoPreco(p) !== 'na_meta').sort((a, b) => gravidade(a) - gravidade(b))
  const semTributo = produtos.filter((p) => p.calculo && !p.premissas.tributoConferido).length
  const verProdutos = (situacao?: SituacaoDoPreco) => navegar('/produtos', { state: { situacao } })
  const motivo = (p: Produto): string => {
    const c = p.calculo
    switch (situacaoDoPreco(p)) {
      case 'prejuizo': return `Perde ${brl(Math.abs(Number(c!.atual!.lucro)))} a cada venda · mínimo para a meta ${brl(c!.minimo)}`
      case 'abaixo': return `${pct(c!.atual!.margem)} de margem · meta ${pct(p.premissas.meta)} · mínimo ${brl(c!.minimo)}`
      case 'sem_preco': return `Ainda sem preço de venda · mínimo para a meta ${brl(c!.minimo)}`
      default: return p.erro ?? 'Confira os custos e as taxas deste produto.'
    }
  }
  const margemDe = (p: Produto) => Number(avaliacaoDe(p)!.margem)
  const faixas = [
    { rotulo: 'Negativa', cor: '#bb4356', itens: validos.filter((p) => margemDe(p) < 0) },
    { rotulo: '0 a 15%', cor: '#bb7d33', itens: validos.filter((p) => margemDe(p) >= 0 && margemDe(p) < 15) },
    { rotulo: '15 a 30%', cor: '#8876ad', itens: validos.filter((p) => margemDe(p) >= 15 && margemDe(p) < 30) },
    { rotulo: '30% ou mais', cor: '#287c62', itens: validos.filter((p) => margemDe(p) >= 30) },
  ]
  const primeiroNome = estado.usuario.nome.split(' ')[0]

  return (
    <>
      <section className="welcome-panel">
        <div>
          <div className="eyebrow light">CLAREZA PARA O SEU NEGÓCIO</div>
          <h2>{produtos.length ? 'Seu próximo preço,\ncom mais confiança.' : `Olá, ${primeiroNome}.\nVamos encontrar seu preço?`}</h2>
          <p>Antes de vender, descubra o que fica com você.</p>
          {estado.podeEscrever ? <Botao onClick={novo}><Plus size={17} />Precificar produto<ArrowRight size={17} /></Botao> : null}
        </div>
        <div className="welcome-summary">
          <div className="summary-label"><span className="live-dot" />SEU CATÁLOGO, EM PERSPECTIVA</div>
          <div className="summary-number">{media === null ? '—' : pct(media)}</div>
          <span>margem média estimada</span>
          <div className="summary-rule" />
          <small>{validos.length ? `${validos.length} produto(s) com cálculo válido · média simples` : 'Seu primeiro cálculo aparece aqui.'}</small>
          <small>Base: preço praticado ou, se ausente, sugerido.</small>
        </div>
      </section>

      <div className="metric-grid">
        {[
          { rotulo: 'Produtos ativos', valor: produtos.length, sub: `${contagem.na_meta} na meta`, Icone: Package, filtro: undefined, tom: '' },
          { rotulo: 'Em prejuízo', valor: contagem.prejuizo, sub: contagem.prejuizo ? 'Vendendo, você perde dinheiro' : 'Nenhum vendendo no prejuízo', Icone: TriangleAlert, filtro: 'prejuizo' as const, tom: contagem.prejuizo ? 'bad' : '' },
          { rotulo: 'Abaixo da meta', valor: contagem.abaixo, sub: contagem.abaixo ? 'Sobra menos do que você quer' : 'Nenhum abaixo da meta', Icone: Target, filtro: 'abaixo' as const, tom: contagem.abaixo ? 'warn' : '' },
          { rotulo: 'Sem preço definido', valor: contagem.sem_preco + contagem.revisar, sub: contagem.sem_preco + contagem.revisar ? 'Defina quanto você cobra' : 'Todos com preço', Icone: Store, filtro: 'sem_preco' as const, tom: '' },
        ].map((m) => (
          <button type="button" className={`metric metric-link ${m.tom}`} key={m.rotulo} onClick={() => verProdutos(m.filtro)} aria-label={`${m.rotulo}: ${m.valor}. Ver na lista de produtos`}>
            <div className="between"><span>{m.rotulo}</span><m.Icone size={18} /></div>
            <strong>{m.valor}</strong>
            <small>{m.sub}</small>
          </button>
        ))}
      </div>

      {semTributo ? (
        <Aviso tipo="atencao">
          {semTributo === produtos.length ? 'Nenhum produto' : `${semTributo} produto(s)`} {semTributo === produtos.length ? 'tem' : 'estão sem'} o tributo conferido: se você recolhe imposto sobre a venda, a sobra real é menor do que a mostrada.{' '}
          Confira o tributo no Precificar, passo “Canal”.
        </Aviso>
      ) : null}

      <div className="dashboard-grid">
        <section className="panel">
          <div className="between">
            <div><h2>Onde sua margem está</h2><p className="muted small">Distribuição estimada dos produtos ativos</p></div>
            <ChartNoAxesCombined size={20} className="muted" />
          </div>
          {validos.length ? (
            <div className="margin-chart" role="img" aria-label={faixas.map((f) => `${f.rotulo}: ${f.itens.length} produtos`).join('; ')}>
              {faixas.map((f) => (
                <div key={f.rotulo}>
                  <div className="chart-top"><span>{f.rotulo}</span><strong>{f.itens.length} <small>produto(s)</small></strong></div>
                  <div className="chart-track"><i style={{ width: `${(f.itens.length / validos.length) * 100}%`, background: f.cor }} /></div>
                </div>
              ))}
            </div>
          ) : (
            <Vazio titulo="O primeiro produto já conta.">Após salvar, você verá como seus produtos se distribuem por margem.</Vazio>
          )}
        </section>

        <section className="panel attention-panel">
          <div className="between">
            <div><h2>Um olhar atento</h2><p className="muted small">O que merece a sua próxima decisão</p></div>
            <span className="attention-dot" />
          </div>
          {atencao.length ? (
            <div className="attention-list">
              {atencao.slice(0, 4).map((p) => {
                const situacao = situacaoDoPreco(p)
                return (
                  <button key={p.id} onClick={() => editar(p, '/')}>
                    <span className={`product-icon attention-${situacao}`}>{situacao === 'prejuizo' || situacao === 'revisar' ? <TriangleAlert size={18} /> : <Package size={18} />}</span>
                    <span><strong>{p.nome} <Selo tom={situacao === 'prejuizo' || situacao === 'revisar' ? 'vermelho' : situacao === 'abaixo' ? 'ambar' : 'neutro'}>{ROTULO_DA_SITUACAO[situacao]}</Selo></strong><small>{motivo(p)}</small></span>
                    <ArrowUpRight size={18} />
                  </button>
                )
              })}
              {atencao.length > 4 ? <button className="text-link attention-more" onClick={() => verProdutos(situacaoDoPreco(atencao[0]!))}>Ver todos os {atencao.length} na lista de produtos</button> : null}
            </div>
          ) : (
            <div className="attention-clear">
              <Check size={25} />
              <h3>{produtos.length ? 'Nenhuma margem abaixo da meta.' : 'Um bom preço começa nos custos.'}</h3>
              <p>{produtos.length ? 'Continue conferindo taxas, frete e custos quando mudarem.' : 'Produto, embalagem, taxas e frete: cada detalhe muda o que sobra.'}</p>
            </div>
          )}
        </section>
      </div>

      <section className="panel recent-panel">
        <div className="between">
          <div><h2>Últimos produtos</h2><p className="muted small">Retome de onde parou</p></div>
          <button className="text-link" onClick={() => navegar('/produtos')}>Ver catálogo<ArrowRight size={16} /></button>
        </div>
        {produtos.length ? (
          <div className="recent-list">
            {[...produtos].sort((a, b) => Date.parse(b.atualizadoEm) - Date.parse(a.atualizadoEm)).slice(0, 4).map((p) => (
              <button key={p.id} onClick={() => editar(p, '/')}>
                <div className="product-icon"><Package size={20} /></div>
                <div className="recent-name"><strong>{p.nome}</strong><small>{p.categoria}{p.exemplo ? ' · Exemplo' : ''}</small></div>
                <div><span>Sugerido</span><strong>{brl(p.calculo?.sugerido)}</strong></div>
                <div><span>Margem estimada</span><Selo tom={avaliacaoDe(p)?.atingeMeta ? 'verde' : 'ambar'}>{pct(avaliacaoDe(p)?.margem)}</Selo></div>
                <ArrowUpRight size={18} />
              </button>
            ))}
          </div>
        ) : (
          <Vazio
            titulo="Seu catálogo ainda está em branco."
            acao={estado.podeEscrever ? <Botao variante="secundario" onClick={novo}>Cadastrar meu primeiro produto</Botao> : undefined}
          >
            O primeiro produto precisa apenas de nome e custo para começar.
          </Vazio>
        )}
      </section>

      <div className="quick-grid">
        {[
          { para: '/simulacoes', estado: undefined, titulo: 'Simule uma mudança', texto: 'Preço, custo ou embalagem.', Icone: Calculator },
          { para: '/simulacoes', estado: { abrir: 'promocao' }, titulo: 'Encontre seu limite', texto: 'Quanto desconto cabe na margem?', Icone: Percent },
          { para: '/canais', estado: undefined, titulo: 'Compare os canais', texto: 'Veja o que sobra em cada um.', Icone: GitCompareArrows },
        ].map((q) => (
          <button key={q.titulo} onClick={() => navegar(q.para, { state: q.estado })}>
            <q.Icone size={20} />
            <div><strong>{q.titulo}</strong><span>{q.texto}</span></div>
            <ArrowUpRight size={18} />
          </button>
        ))}
      </div>
    </>
  )
}

/**
 * O que mudou numa revisão, em uma frase: o preço cobrado, a margem e o custo
 * (PLANO-USABILIDADE-LUCRO.md, "próximas"). Só "Revisão 3" não ajudava a
 * decidir nada; "R$ 34,73 → R$ 29,73 · margem 25% → 29,7%" conta a história.
 */
function mudancaDaRevisao(h: Estado['historico'][number]): string {
  const { antes, depois } = h
  const preco = (r: ResumoDaRevisao) => (Number(r.preco) > 0 ? brl(r.preco) : 'sem preço')
  /* sem preço cobrado, a margem guardada é a do sugerido — mostrá-la faria parecer que havia venda */
  const margem = (r: ResumoDaRevisao) => (r.margem === null || !(Number(r.preco) > 0) ? '—' : pct(r.margem))
  if (!antes) return `Primeiro preço: ${preco(depois)} · margem ${margem(depois)}`
  const partes: string[] = []
  if (antes.preco !== depois.preco) partes.push(`Preço ${preco(antes)} → ${preco(depois)}`)
  if (antes.custo !== depois.custo) partes.push(`custo ${brl(antes.custo)} → ${brl(depois.custo)}`)
  if (antes.margem !== depois.margem) partes.push(`margem ${margem(antes)} → ${margem(depois)}`)
  return partes.length ? partes.join(' · ') : 'Sem mudança de preço, custo ou margem (outros dados do produto)'
}

export function Relatorios() {
  const estado = usePainel((s) => s.estado)!
  const navegar = useNavigate()
  const editar = useEditarProduto()
  const produtos = estado.produtos.filter((p) => p.status === 'ativo' && p.calculo)
  const porMargem = [...produtos].sort((a, b) => Number(avaliacaoDe(b)!.margem) - Number(avaliacaoDe(a)!.margem))
  const porSobra = [...produtos].sort((a, b) => Number(avaliacaoDe(b)!.lucro) - Number(avaliacaoDe(a)!.lucro))
  const etiquetar = () =>
    navegar('/etiquetas', { state: { ids: produtos.filter((p) => Number(p.premissas.preco) > 0).slice(0, 100).map((p) => p.id) } })

  return (
    <>
      <div className="report-hero">
        <div>
          <div className="eyebrow">ANÁLISE DO CATÁLOGO</div>
          <h2>Mais clareza em cada decisão.</h2>
          <p>Resultados estimados, a partir dos seus custos e preços.</p>
        </div>
        <div className="actions">
          <BaixarArquivo className="btn secondary"  caminho={enderecos.exportar('pdf')}><Download size={16} />Relatório PDF</BaixarArquivo>
          <BaixarArquivo className="btn ghost"  caminho={enderecos.exportar('xlsx')}>Planilha Excel</BaixarArquivo>
          <Botao variante="secundario" onClick={etiquetar}>Gerar etiquetas</Botao>
        </div>
      </div>

      <div className="dashboard-grid section-gap">
        <section className="panel">
          <h2>Produtos por margem estimada</h2>
          <p className="muted small">Comparação simples, sem ponderação por vendas</p>
          {porMargem.length ? (
            <div className="ranking-chart">
              {porMargem.slice(0, 12).map((p) => {
                const m = Number(avaliacaoDe(p)!.margem)
                return (
                  <button key={p.id} onClick={() => editar(p, '/relatorios')}>
                    <div><span>{p.nome}</span><b className={m < 0 ? 'negative' : ''}>{pct(m)}</b></div>
                    <div className="chart-track"><i style={{ width: `${Math.min(100, Math.abs(m))}%`, background: m < 0 ? 'var(--danger)' : 'var(--green)' }} /></div>
                  </button>
                )
              })}
            </div>
          ) : (
            <Vazio titulo="Ainda não há produtos para comparar.">Salve um produto para começar.</Vazio>
          )}
        </section>
        <section className="panel">
          <h2>Sobra estimada por unidade</h2>
          <p className="muted small">Não representa o volume total vendido</p>
          <div className="profit-ranking">
            {porSobra.slice(0, 8).map((p, i) => (
              <button key={p.id} onClick={() => editar(p, '/relatorios')}>
                <span>{String(i + 1).padStart(2, '0')}</span><strong>{p.nome}</strong><b>{brl(avaliacaoDe(p)!.lucro)}</b>
              </button>
            ))}
          </div>
          {!produtos.length ? <Vazio titulo="O que sobra vai aparecer aqui.">Não utilizamos dados de venda fictícios.</Vazio> : null}
        </section>
      </div>

      <section className="panel section-gap">
        <h2>Histórico de precificação</h2>
        <div className="activity-list">
          {estado.historico.slice(0, 12).map((h) => (
            <div key={h.id}>
              <span className="activity-dot" />
              <div>
                <strong>{estado.produtos.find((p) => p.id === h.produtoId)?.nome ?? 'Produto'}</strong>
                <small>{mudancaDaRevisao(h)}</small>
                <small className="muted">Revisão {h.revisao}{h.loteId ? ' · alteração em lote' : ''}</small>
              </div>
              <time>{data(h.criadoEm)}</time>
            </div>
          ))}
        </div>
        {!estado.historico.length ? <p className="muted">Cada produto salvo gera uma revisão com suas premissas.</p> : null}
      </section>
      <Aviso>
        Para revisar composição de custos e impacto das alterações, abra o produto ou compare um cenário. Os relatórios não calculam
        ROI, faturamento ou tendências sem registros reais de vendas.
      </Aviso>
    </>
  )
}
