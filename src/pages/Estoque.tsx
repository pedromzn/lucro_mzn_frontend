/**
 * Estoque e vendas — o `inventory.tsx` do mock, com a mesma marcação.
 *
 * O saldo, o custo médio e o resultado estimado são do servidor: a tela manda
 * o movimento e lê de volta. Toda ação que mexe no saldo leva uma
 * `chaveDaOperacao` nova por abertura de janela — o duplo clique, ou a rede
 * que reenviou, chega ao servidor com a mesma chave e não baixa o estoque duas
 * vezes.
 */

import { BaixarArquivo } from '@/components/ArquivosDoEspaco'
import { useCallback, useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Boxes, Download, History, PackagePlus, Plus, Search, ShoppingBag } from 'lucide-react'
import { D } from '@shared/preco'
import { FORMAS_DE_PAGAMENTO_DA_VENDA, NOMES_DOS_MOVIMENTOS, TIPOS_DE_MOVIMENTO, type TipoDeMovimento } from '@shared/estoque'
import { enderecos, lucroApi, type Movimento, type PedidoDeMovimento, type Produto, type ProdutoNoEstoque, type TelaDoEstoque } from '@/lib/api'
import { agir, usePainel } from '@/lib/painel'
import { toast } from '@/lib/avisos'
import { Aviso, Botao, CampoDeTexto, CampoNumero, Combo, Janela, Selecao, Selo, Vazio, brl, data, erroDe, novaChave, quantidade } from '@/components/ui'

type Formulario = Required<Omit<PedidoDeMovimento, 'canalId'>> & { canalId: string | null }

/* o custo de uma unidade, a partir do custo do lote no cadastro do produto */
const custoUnitarioDe = (p: Pick<Produto, 'premissas'>) => {
  try {
    return D(p.premissas.custo).div(p.premissas.quantidade).toFixed(6)
  } catch {
    return '0'
  }
}

export default function Estoque() {
  const estado = usePainel((s) => s.estado)!
  const [tela, setTela] = useState<TelaDoEstoque | null>(null)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'repor'>('todos')
  const [pagina, setPagina] = useState(1)
  const [ocupado, setOcupado] = useState(false)
  const [secao, setSecao] = useState<'estoque' | 'historico'>('estoque')
  const [form, setForm] = useState<Formulario | null>(null)
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
    setForm({
      chaveDaOperacao: novaChave(), produtoId: escolhido.id, tipo: tipo as Formulario['tipo'], quantidade: '1', custoUnitario: custoUnitarioDe(escolhido),
      precoUnitario: escolhido.premissas.preco, desconto: '0', canalId: escolhido.canalId ?? null, formaDePagamento: 'Pix', motivo: '',
    })
  }
  const escolhido = produtos.find((p) => p.id === form?.produtoId)
  let totalDaVenda = '—'
  try {
    if (form) totalDaVenda = brl(D(form.precoUnitario || 0).minus(form.desconto || 0).times(form.quantidade || 0).toFixed(2))
  } catch { /* o campo ainda está sendo digitado */ }

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
          <button className={secao === 'estoque' ? 'active' : ''} onClick={() => setSecao('estoque')}><Boxes size={16} />Estoque</button>
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

          {secao === 'estoque' ? (
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
                  return (
                    <article key={m.id}>
                      <div className={`movement-direction ${entra ? 'in' : 'out'}`}>{entra ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}</div>
                      <div className="movement-description">
                        <strong>{m.produto}</strong>
                        <span>{NOMES_DOS_MOVIMENTOS[m.tipo as TipoDeMovimento] ?? m.tipo} · {data(m.criadoEm)}</span>
                        <small>{m.motivo ? `${m.motivo} · ` : ''}saldo após: {quantidade(m.saldoDepois)} {m.unidade}</small>
                        <small>Custo de aquisição usado: {brl(m.custoUnitario)} por {m.unidade}</small>
                      </div>
                      <strong className="movement-amount">{D(m.quantidade).gt(0) ? '+' : ''}{quantidade(m.quantidade)} {m.unidade}</strong>
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
        {form ? (
          <div className="form-stack">
            <Combo
              rotulo="Produto"
              valor={form.produtoId}
              opcoes={produtos.map((p) => ({ valor: p.id, rotulo: p.nome }))}
              aoMudar={(v) => {
                const p = produtos.find((a) => a.id === v)
                if (p) setForm({ ...form, produtoId: v, custoUnitario: custoUnitarioDe(p), precoUnitario: p.premissas.preco, canalId: p.canalId ?? null })
              }}
            />
            <Selecao
              rotulo="O que aconteceu?"
              valor={form.tipo}
              aoMudar={(tipo) => setForm({ ...form, tipo })}
              opcoes={TIPOS_DE_MOVIMENTO.map((t) => ({ valor: t, rotulo: NOMES_DOS_MOVIMENTOS[t] }))}
            />
            <CampoNumero
              rotulo={form.tipo === 'conferencia' ? 'Quantidade contada no estoque' : 'Quantidade desta movimentação'}
              prefixo={escolhido?.unidade ?? 'un.'}
              valor={form.quantidade}
              aoMudar={(v) => setForm({ ...form, quantidade: v })}
              dica={form.tipo === 'conferencia' ? 'Informe o saldo final contado, não a diferença.' : 'Use a mesma unidade do cadastro do produto.'}
            />
            {form.tipo === 'inicial' || form.tipo === 'entrada' || form.tipo === 'conferencia' ? (
              <CampoNumero
                rotulo={`Custo de aquisição por ${escolhido?.unidade ?? 'unidade'}`}
                valor={form.custoUnitario}
                aoMudar={(v) => setForm({ ...form, custoUnitario: v })}
                dica={form.tipo === 'conferencia' ? 'Usado somente se a conferência acrescentar quantidade.' : 'Este valor compõe o custo médio do estoque; o preço do catálogo permanece igual.'}
              />
            ) : null}
            {form.tipo === 'venda' ? (
              <>
                <div className="form-grid">
                  <CampoNumero rotulo={`Preço cobrado por ${escolhido?.unidade ?? 'unidade'}`} valor={form.precoUnitario} aoMudar={(v) => setForm({ ...form, precoUnitario: v })} />
                  <CampoNumero rotulo="Desconto em cada unidade" valor={form.desconto} aoMudar={(v) => setForm({ ...form, desconto: v })} />
                </div>
                <div className="form-grid">
                  <Selecao
                    rotulo="Perfil de canal da venda"
                    valor={form.canalId ?? ''}
                    aoMudar={(v) => setForm({ ...form, canalId: v || null })}
                    opcoes={[{ valor: '', rotulo: 'Usar custos do produto' }, ...estado.canais.map((c) => ({ valor: c.id, rotulo: c.nome }))]}
                  />
                  <Selecao rotulo="Como o cliente pagou?" valor={form.formaDePagamento} aoMudar={(v) => setForm({ ...form, formaDePagamento: v })} opcoes={FORMAS_DE_PAGAMENTO_DA_VENDA} />
                </div>
                <div className="stock-sale-total"><span>Total desta venda após desconto</span><strong>{totalDaVenda}</strong></div>
                <Aviso>A venda baixa o estoque. As taxas usadas para estimar o resultado são as do perfil informado; o pagamento selecionado não altera taxas automaticamente.</Aviso>
              </>
            ) : null}
            <CampoDeTexto
              rotulo={form.tipo === 'perda' || form.tipo === 'uso_proprio' || form.tipo === 'conferencia' ? 'Motivo da movimentação' : 'Observação — opcional'}
              value={form.motivo}
              maxLength={250}
              onChange={(e) => setForm({ ...form, motivo: e.target.value })}
            />
            <Botao ocupado={ocupado} onClick={() => void salvar()}>Confirmar {form.tipo === 'venda' ? 'venda' : 'movimentação'}</Botao>
          </div>
        ) : null}
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
