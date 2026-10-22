/**
 * Estoque e vendas — o `inventory.tsx` do mock, com a mesma marcação.
 *
 * O saldo, o custo médio e o resultado estimado são do servidor: a tela manda
 * o movimento e lê de volta. Toda ação que mexe no saldo leva uma
 * `chaveDaOperacao` nova por abertura de janela — o duplo clique, ou a rede
 * que reenviou, chega ao servidor com a mesma chave e não baixa o estoque duas
 * vezes.
 *
 * Três abas: o **espaço 3D** (PLANO-ESTOQUE-3D.md, carregado sob demanda e
 * aberto primeiro quando o aparelho tem WebGL), a **lista** de sempre — que é a
 * saída de quem não tem WebGL — e as **movimentações**.
 */

import { BaixarArquivo } from '@/components/ArquivosDoEspaco'
import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Boxes, Box, Download, History, PackagePlus, Plus, Search, ShoppingBag } from 'lucide-react'
import { D } from '@shared/preco'
import { NOMES_DOS_MOVIMENTOS, rotuloDaQuantidade, type TipoDeMovimento } from '@shared/estoque'
import { enderecos, lucroApi, type Movimento, type Produto, type ProdutoNoEstoque, type TelaDoEstoque } from '@/lib/api'
import { agir, usePainel } from '@/lib/painel'
import { toast } from '@/lib/avisos'
import { CamposDoMovimento, novoFormulario, type FormularioDeMovimento } from '@/components/FormularioDeMovimento'
import { Aviso, Botao, CampoDeTexto, CampoNumero, Janela, Selecao, Selo, Vazio, brl, data, erroDe, novaChave, quantidade } from '@/components/ui'

/* o three.js e a cena só baixam quando a aba abre: quem usa a lista não paga por eles */
const EspacoDoEstoque = lazy(() => import('@/estoque3d/EspacoDoEstoque'))

type Secao = 'espaco' | 'estoque' | 'historico'

/** WebGL de verdade, não só a promessa do navegador: sem ele, a aba 3D nem aparece. */
export function temWebGL(): boolean {
  try {
    const tela = document.createElement('canvas')
    return !!(tela.getContext('webgl2') ?? tela.getContext('webgl'))
  } catch {
    return false
  }
}

const CHAVE_DA_ABA = 'lucro.estoque.aba'
/* `localStorage` lança em janela anônima e com dados de site bloqueados: a aba lembrada é conveniência, nunca requisito */
function abaLembrada(com3d: boolean): Secao {
  try {
    const v = localStorage.getItem(CHAVE_DA_ABA)
    if (v === 'estoque' || v === 'historico' || (v === 'espaco' && com3d)) return v
  } catch { /* sem armazenamento: vale o padrão */ }
  return com3d ? 'espaco' : 'estoque'
}

export default function Estoque() {
  const estado = usePainel((s) => s.estado)!
  const [tela, setTela] = useState<TelaDoEstoque | null>(null)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'repor'>('todos')
  const [pagina, setPagina] = useState(1)
  const [ocupado, setOcupado] = useState(false)
  const [com3d] = useState(temWebGL)
  const [secao, setSecaoAgora] = useState<Secao>(() => abaLembrada(com3d))
  const setSecao = (s: Secao) => {
    setSecaoAgora(s)
    try { localStorage.setItem(CHAVE_DA_ABA, s) } catch { /* idem */ }
  }
  const [form, setForm] = useState<FormularioDeMovimento | null>(null)
  const [minimo, setMinimo] = useState<{ produtoId: string; minimo: string; nome: string; unidade: string } | null>(null)
  const [devolvendo, setDevolvendo] = useState<(Movimento & { chaveDaOperacao: string }) | null>(null)
  const [motivo, setMotivo] = useState('')
  const escreve = estado.podeEscrever

  const carregar = useCallback(async () => {
    try {
      setTela(await lucroApi.estoque({ pagina, busca, filtro }))
      setErro('')
    } catch (e) {
      setErro(erroDe(e))
    }
  }, [pagina, busca, filtro])

  /* espera a pessoa parar de digitar, e descarta a resposta de uma busca que já ficou para trás */
  useEffect(() => {
    let viva = true
    const relogio = setTimeout(async () => {
      try {
        const r = await lucroApi.estoque({ pagina, busca, filtro })
        if (viva) { setTela(r); setErro('') }
      } catch (e) {
        if (viva) setErro(erroDe(e))
      }
    }, 180)
    return () => { viva = false; clearTimeout(relogio) }
  }, [pagina, busca, filtro])

  const produtos = estado.produtos.filter((p) => p.status === 'ativo')
  const abrir = (p?: Pick<Produto, 'id' | 'premissas' | 'canalId'>, tipo: TipoDeMovimento = 'entrada') => {
    const escolhido = p ?? produtos[0]
    if (!escolhido) return
    setForm(novoFormulario(escolhido, tipo))
  }

  async function salvar() {
    if (!form) return
    setOcupado(true)
    try {
      const r = await agir(() => lucroApi.registrarMovimento(form), form.tipo === 'venda' ? 'Venda registrada e estoque atualizado.' : 'Movimentação registrada no histórico.')
      if (r) { setForm(null); await carregar() }
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="inventory-content">
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <div className="toolbar">
        <div className="subnav">
          {com3d ? <button className={secao === 'espaco' ? 'active' : ''} onClick={() => setSecao('espaco')}><Box size={16} />Espaço 3D</button> : null}
          <button className={secao === 'estoque' ? 'active' : ''} onClick={() => setSecao('estoque')}><Boxes size={16} />Lista</button>
          <button className={secao === 'historico' ? 'active' : ''} onClick={() => setSecao('historico')}><History size={16} />Movimentações</button>
        </div>
        <div className="toolbar-actions">
          <BaixarArquivo className="btn ghost"  caminho={enderecos.estoqueEmCsv}><Download size={16} />Exportar estoque</BaixarArquivo>
          {escreve ? (
            <>
              <Botao variante="secundario" disabled={!produtos.length} onClick={() => abrir(undefined, 'venda')}><ShoppingBag size={16} />Registrar venda</Botao>
              <Botao disabled={!produtos.length} onClick={() => abrir()}><Plus size={16} />Registrar movimentação</Botao>
            </>
          ) : null}
        </div>
      </div>

      {tela ? (
        <>
          {/* no Espaço 3D os números viram uma faixa fina: a cena é o assunto ali (pedido do Pedro, 22/10/2026) */}
          {secao === 'espaco' ? (
            <dl className="stock-strip">
              <div title="Saldo inicial ou movimentação registrada"><dt>Com estoque controlado</dt><dd>{tela.totais.controlados}</dd></div>
              <div title="Saldo igual ou abaixo do mínimo"><dt>Precisam de reposição</dt><dd>{tela.totais.repor}</dd></div>
              <div title="Baseado no custo médio registrado"><dt>Valor de aquisição</dt><dd>{brl(tela.totais.valorEmEstoque)}</dd></div>
              <div title={`${tela.totais.vendas} venda(s) · exclui devoluções integrais`}><dt>Vendas registradas</dt><dd>{brl(tela.totais.totalVendido)}</dd></div>
              <div title="Inclui o custo médio e os custos do perfil usado em cada venda"><dt>Resultado estimado</dt><dd>{brl(tela.totais.resultadoEstimado)}</dd></div>
            </dl>
          ) : (
            <>
              <div className="metric-grid stock-metrics">
                <div className="metric"><span>Produtos com estoque controlado</span><strong>{tela.totais.controlados}</strong><small>Saldo inicial ou movimentação registrada</small></div>
                <div className="metric"><span>Precisam de reposição</span><strong>{tela.totais.repor}</strong><small>Saldo igual ou abaixo do mínimo</small></div>
                <div className="metric"><span>Valor de aquisição em estoque</span><strong>{brl(tela.totais.valorEmEstoque)}</strong><small>Baseado no custo médio registrado</small></div>
                <div className="metric"><span>Vendas registradas</span><strong>{brl(tela.totais.totalVendido)}</strong><small>{tela.totais.vendas} venda(s) · exclui devoluções integrais</small></div>
              </div>
              <Aviso>
                Resultado estimado das vendas registradas: <strong>{brl(tela.totais.resultadoEstimado)}</strong>. Inclui o custo médio e os custos do perfil usado
                em cada venda. Consulte os detalhes no histórico.
              </Aviso>
            </>
          )}

          {secao === 'espaco' ? (
            <Suspense fallback={<div className="skeleton space-loading section-gap" />}>
              <EspacoDoEstoque aoMudar={() => void carregar()} />
            </Suspense>
          ) : secao === 'estoque' ? (
            <>
              <div className="toolbar section-gap">
                <div className="search">
                  <Search size={18} />
                  <input aria-label="Buscar produto no estoque" type="search" placeholder="Buscar produto ou código" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1) }} />
                </div>
                <Selecao
                  rotulo="Mostrar"
                  valor={filtro}
                  aoMudar={(v) => { setFiltro(v); setPagina(1) }}
                  opcoes={[{ valor: 'todos', rotulo: 'Todos os produtos' }, { valor: 'repor', rotulo: 'Precisa de reposição' }]}
                />
              </div>
              <div className="stock-grid">
                {tela.produtos.map((p: ProdutoNoEstoque) => {
                  const repor = D(p.quantidade).lte(p.minimo)
                  return (
                    <article className="panel stock-card" key={p.id}>
                      <div className="between">
                        <div><h3>{p.nome}</h3><small className="muted">{p.sku ? `Cód. ${p.sku} · ` : ''}Vendido por {p.unidade}</small></div>
                        <Selo tom={!p.revisao ? 'neutro' : repor ? 'ambar' : 'verde'}>{!p.revisao ? 'A iniciar' : repor ? 'Repor estoque' : 'Disponível'}</Selo>
                      </div>
                      <div className="stock-quantity">{quantidade(p.quantidade)} <span>{p.unidade}</span></div>
                      <dl className="stock-facts">
                        <div><dt>Custo médio por {p.unidade}</dt><dd>{brl(p.custoMedio)}</dd></div>
                        <div>
                          <dt>Estoque mínimo</dt>
                          <dd>
                            {escreve ? (
                              <button className="text-link" onClick={() => setMinimo({ produtoId: p.id, minimo: p.minimo, nome: p.nome, unidade: p.unidade })}>
                                {quantidade(p.minimo)} {p.unidade}
                              </button>
                            ) : `${quantidade(p.minimo)} ${p.unidade}`}
                          </dd>
                        </div>
                      </dl>
                      {escreve ? (
                        <div className="stock-actions">
                          <Botao variante="secundario" onClick={() => abrir(p, p.revisao ? 'entrada' : 'inicial')}><PackagePlus size={16} />{p.revisao ? 'Entrada' : 'Informar saldo'}</Botao>
                          <Botao variante="fantasma" disabled={!D(p.quantidade).gt(0)} onClick={() => abrir(p, 'venda')}><ArrowUpRight size={16} />Venda</Botao>
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
              {!tela.produtos.length ? (
                <Vazio icone={<Boxes size={28} />} titulo={produtos.length ? 'Nenhum produto neste filtro.' : 'Seu estoque começa pelo produto.'}>
                  Cadastre um produto e depois informe a quantidade que você tem disponível.
                </Vazio>
              ) : null}
              <div className="pagination">
                <span>{tela.total} produto(s) · página {pagina}</span>
                <div>
                  <Botao variante="fantasma" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Botao>
                  <Botao variante="fantasma" disabled={pagina * tela.porPagina >= tela.total} onClick={() => setPagina((p) => p + 1)}>Próxima</Botao>
                </div>
              </div>
            </>
          ) : (
            <section className="panel section-gap">
              <div className="between"><h2>Últimas movimentações</h2><span className="small muted">Até 60 registros recentes</span></div>
              <div className="stock-history">
                {tela.movimentos.map((m) => {
                  const entra = D(m.quantidade).gte(0)
                  const transferencia = m.tipo === 'transferencia'
                  const de = m.enderecos.filter((l) => D(l.quantidade).lt(0)).map((l) => l.rotulo)
                  const para = m.enderecos.filter((l) => D(l.quantidade).gt(0)).map((l) => l.rotulo)
                  const lugar = transferencia
                    ? `${de.join(', ') || 'A guardar'} → ${para.join(', ') || 'A guardar'}`
                    : (para.length ? `para ${para.join(', ')}` : de.length ? `de ${de.join(', ')}` : '')
                  return (
                    <article key={m.id}>
                      <div className={`movement-direction ${transferencia ? 'move' : entra ? 'in' : 'out'}`}>{transferencia ? <ArrowLeftRight size={19} /> : entra ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}</div>
                      <div className="movement-description">
                        <strong>{m.produto}</strong>
                        <span>{NOMES_DOS_MOVIMENTOS[m.tipo as TipoDeMovimento] ?? m.tipo} · {data(m.criadoEm)}</span>
                        <small>{m.motivo ? `${m.motivo} · ` : ''}saldo após: {rotuloDaQuantidade(m.saldoDepois, m.unidade)}</small>
                        {lugar ? <small>{lugar}</small> : null}
                        {transferencia ? null : <small>Custo de aquisição usado: {brl(m.custoUnitario)} por {m.unidade}</small>}
                      </div>
                      <strong className="movement-amount">{transferencia
                        ? rotuloDaQuantidade(m.enderecos.find((l) => D(l.quantidade).gt(0))?.quantidade ?? D(m.enderecos[0]?.quantidade ?? 0).abs().toString(), m.unidade)
                        : `${D(m.quantidade).gt(0) ? '+' : ''}${rotuloDaQuantidade(m.quantidade, m.unidade)}`}</strong>
                      {m.tipo === 'venda' && m.vendaId ? (
                        <>
                          {m.statusDaVenda === 'concluida' ? (
                            escreve ? <Botao variante="fantasma" onClick={() => { setDevolvendo({ ...m, chaveDaOperacao: novaChave() }); setMotivo('') }}>Devolver venda</Botao> : null
                          ) : (
                            <Selo>Devolvida</Selo>
                          )}
                          <button
                            className="text-link"
                            onClick={async () => {
                              try {
                                const v = await lucroApi.venda(m.vendaId!)
                                toast(`Venda: ${brl(v.total)} · sobra estimada: ${brl(v.resultadoEstimado)} · ${v.canal} · ${v.formaDePagamento}.`)
                              } catch (e) {
                                toast(erroDe(e))
                              }
                            }}
                          >
                            Ver resultado
                          </button>
                        </>
                      ) : null}
                    </article>
                  )
                })}
              </div>
              {!tela.movimentos.length ? <Vazio titulo="O histórico começa na primeira movimentação.">Entradas, vendas e ajustes ficam registrados aqui.</Vazio> : null}
            </section>
          )}
        </>
      ) : !erro ? <div className="skeleton loading-title" /> : null}

      <Janela aberta={!!form} aoFechar={() => { if (!ocupado) setForm(null) }} titulo="Registrar movimentação" descricao="Confira o produto, a quantidade e os valores antes de salvar.">
        {form ? <CamposDoMovimento form={form} aoMudar={setForm} produtos={produtos} canais={estado.canais} ocupado={ocupado} aoSalvar={() => void salvar()} /> : null}
      </Janela>

      <Janela aberta={!!minimo} aoFechar={() => setMinimo(null)} titulo="Definir estoque mínimo" descricao={minimo?.nome}>
        {minimo ? (
          <div className="form-stack">
            <CampoNumero rotulo="Avisar quando o saldo chegar a" prefixo={minimo.unidade} valor={minimo.minimo} aoMudar={(v) => setMinimo({ ...minimo, minimo: v })} />
            <Botao
              ocupado={ocupado}
              onClick={async () => {
                setOcupado(true)
                try {
                  if ((await agir(() => lucroApi.definirMinimo(minimo.produtoId, minimo.minimo), 'Estoque mínimo atualizado.')) !== null) {
                    setMinimo(null)
                    await carregar()
                  }
                } finally {
                  setOcupado(false)
                }
              }}
            >
              Salvar mínimo
            </Botao>
          </div>
        ) : null}
      </Janela>

      <Janela
        aberta={!!devolvendo}
        aoFechar={() => { if (!ocupado) setDevolvendo(null) }}
        titulo="Devolver todos os itens desta venda?"
        descricao="A quantidade volta ao estoque e a venda sai dos totais ativos. O histórico é preservado."
      >
        {devolvendo ? (
          <div className="form-stack">
            <p>{devolvendo.produto} · {quantidade(D(devolvendo.quantidade).abs().toString())} {devolvendo.unidade}</p>
            <CampoDeTexto rotulo="Motivo da devolução" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={250} />
            <Aviso>Esta ação não transfere dinheiro ao cliente. Registre o reembolso no meio de pagamento utilizado.</Aviso>
            <Botao
              variante="perigo"
              ocupado={ocupado}
              disabled={motivo.trim().length < 3}
              onClick={async () => {
                setOcupado(true)
                try {
                  const r = await agir(
                    () => lucroApi.devolverVenda({ chaveDaOperacao: devolvendo.chaveDaOperacao, movimentoId: devolvendo.id, motivo }),
                    'Devolução registrada e estoque atualizado.',
                  )
                  if (r) { setDevolvendo(null); await carregar() }
                } finally {
                  setOcupado(false)
                }
              }}
            >
              Confirmar devolução integral
            </Botao>
          </div>
        ) : null}
      </Janela>
    </div>
  )
}
