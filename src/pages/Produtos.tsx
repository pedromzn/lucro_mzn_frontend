/**
 * Produtos — o catálogo do mock (`catalog.tsx`), com a mesma marcação: busca,
 * filtros salvos, tabela ou cartões, seleção, lote, exportação e histórico.
 * Editar abre a janela de edição rápida (`EditarProduto`), e o arquivado sem
 * movimento nem venda pode ser apagado de vez. Importar é página própria
 * (`ImportarProdutos`, a do MKT) desde 22/10/2026.
 *
 * O lote é em DOIS tempos, como no mock: a prévia é calculada e guardada no
 * servidor, e confirmar aplica exatamente aquela prévia (pelo id dela) — não
 * um novo cálculo que poderia ter mudado entre um clique e outro.
 */

import { BaixarArquivo, ImagemDoEspaco } from '@/components/ArquivosDoEspaco'
import { Paginacao, usePaginacao } from '@/components/Paginacao'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Archive, ArrowRight, Check, Copy, Download, History, LayoutGrid, List, Package, Pencil, Plus, RotateCcw, Search, SlidersHorizontal, Star, Tag, Trash2, Upload,
} from 'lucide-react'
import { enderecos, lucroApi, type Previa, type Produto, type RegraDoLote, type Revisao } from '@/lib/api'
import { agir, usePainel } from '@/lib/painel'
import { toast } from '@/lib/avisos'
import { Aviso, Botao, CampoDeTexto, CampoNumero, Janela, Selecao, Selo, Vazio, brl, data, erroDe, pct, Combo } from '@/components/ui'
import { EditarProduto } from '@/components/EditarProduto'
import { avaliacaoDe, useEditarProduto } from './Inicio'
import { ROTULO_DA_SITUACAO, SITUACOES, TOM_DA_SITUACAO, situacaoDoPreco, type SituacaoDoPreco } from '@/precos/situacao'

type TipoDeRegra = 'meta' | 'aumentoDoCusto' | 'embalagem' | 'arredondamento' | 'canalId'
type Janelas = 'lote' | 'exportar' | 'historico' | 'filtro' | null

export default function Produtos() {
  const estado = usePainel((s) => s.estado)!
  const navegar = useNavigate()
  const editar = useEditarProduto()
  const chegada = useLocation().state as { destaque?: string; situacao?: SituacaoDoPreco } | null
  const destaque = chegada?.destaque
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState<'ativo' | 'arquivado' | 'todos'>('ativo')
  /* a pergunta do app: onde estou perdendo? (PLANO-USABILIDADE-LUCRO.md, U2) */
  /* vindo de um cartão da Visão geral, a lista já abre no recorte dele */
  const [situacao, setSituacao] = useState<SituacaoDoPreco | ''>(chegada?.situacao ?? '')
  const [categoria, setCategoria] = useState('')
  const [ordem, setOrdem] = useState<'recentes' | 'nome' | 'margem' | 'sobra'>('recentes')
  const [vista, setVista] = useState<'tabela' | 'cartoes'>('tabela')
  const [selecao, setSelecao] = useState<string[]>([])
  const [janela, setJanela] = useState<Janelas>(null)
  const [historico, setHistorico] = useState<Revisao[]>([])
  const [nomeDoHistorico, setNomeDoHistorico] = useState('')
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [regra, setRegra] = useState({ meta: '25', aumentoDoCusto: '0', embalagem: '0', arredondamento: 'nenhum', canalId: '' })
  const [tipoDeRegra, setTipoDeRegra] = useState<TipoDeRegra>('meta')
  const [ultimoLote, setUltimoLote] = useState<string | null>(null)
  const [arquivando, setArquivando] = useState<Produto | null>(null)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [apagando, setApagando] = useState<Produto | null>(null)
  /* a paginação do MKT; o catálogo vem inteiro em `/api/estado` (até 2.000), então a página é cortada aqui */
  const { pagina, setPagina, porPagina, setPorPagina } = usePaginacao('produtos')
  const escreve = estado.podeEscrever

  const termo = busca.toLowerCase()
  const produtos = estado.produtos
    .filter((p) => (status === 'todos' || p.status === status) && (!categoria || p.categoria === categoria) && (!situacao || situacaoDoPreco(p) === situacao))
    .filter((p) => `${p.nome} ${p.sku ?? ''} ${p.tags.join(' ')}`.toLowerCase().includes(termo))
    .sort((a, b) =>
      ordem === 'nome'
        ? a.nome.localeCompare(b.nome, 'pt-BR')
        : ordem === 'margem'
          ? Number(avaliacaoDe(a)?.margem ?? 0) - Number(avaliacaoDe(b)?.margem ?? 0)
          : ordem === 'sobra'
            ? Number(a.calculo?.atual?.lucro ?? Infinity) - Number(b.calculo?.atual?.lucro ?? Infinity)
          : Date.parse(b.atualizadoEm) - Date.parse(a.atualizadoEm),
    )
  const paginas = Math.max(1, Math.ceil(produtos.length / porPagina))
  const atual = Math.min(pagina, paginas)
  const visiveis = produtos.slice((atual - 1) * porPagina, atual * porPagina)
  const etiquetar = (ids: string[]) => navegar('/etiquetas', { state: { ids } })
  const acao = (p: Produto, qual: 'duplicar' | 'arquivar' | 'restaurar' | 'favorito', sucesso?: string) =>
    agir(() => lucroApi.acaoNoProduto(p.id, qual), sucesso)

  async function abrirHistorico(p: Produto) {
    try {
      setHistorico(await lucroApi.historico(p.id))
      setNomeDoHistorico(p.nome)
      setJanela('historico')
    } catch (e) {
      toast(erroDe(e))
    }
  }

  async function calcularLote() {
    setOcupado(true)
    try {
      const pedido: RegraDoLote = { ids: selecao, [tipoDeRegra]: regra[tipoDeRegra] }
      setPrevia(await lucroApi.previaDoLote(pedido))
    } catch (e) {
      toast(erroDe(e))
    } finally {
      setOcupado(false)
    }
  }

  async function confirmar() {
    if (!previa) return
    setOcupado(true)
    try {
      const r = await agir(() => lucroApi.aplicarPrevia(previa.id), undefined)
      if (!r) return
      setUltimoLote(r.loteId)
      toast(`${r.quantidade} produtos salvos. O histórico foi registrado.`)
      setJanela(null)
      setPrevia(null)
      setSelecao([])
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <div className="toolbar">
        <div className="search">
          <Search size={17} />
          <input aria-label="Buscar produtos" placeholder="Buscar nome, SKU ou tag" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1) }} />
        </div>
        <div className="toolbar-actions">
          <Botao variante="secundario" disabled={!selecao.length} onClick={() => etiquetar(selecao)}>Imprimir etiquetas ({selecao.length})</Botao>
          {escreve ? <Botao variante="secundario" onClick={() => navegar('/produtos/importar')}><Upload size={16} />Importar</Botao> : null}
          <Botao variante="fantasma" onClick={() => setJanela('exportar')}><Download size={16} />Exportar</Botao>
          <div className="view-switch">
            <button aria-label="Visualização em tabela" aria-pressed={vista === 'tabela'} className={vista === 'tabela' ? 'active' : ''} onClick={() => setVista('tabela')}><List size={18} /></button>
            <button aria-label="Visualização em cartões" aria-pressed={vista === 'cartoes'} className={vista === 'cartoes' ? 'active' : ''} onClick={() => setVista('cartoes')}><LayoutGrid size={17} /></button>
          </div>
        </div>
      </div>

      <div className="filter-row">
        <Selecao rotulo="Status" valor={status} aoMudar={setStatus} opcoes={[{ valor: 'ativo', rotulo: 'Ativos' }, { valor: 'arquivado', rotulo: 'Arquivados' }, { valor: 'todos', rotulo: 'Todos' }]} />
        <Selecao
          rotulo="Situação do preço"
          valor={situacao}
          aoMudar={(v) => { setSituacao(v); setPagina(1) }}
          opcoes={[{ valor: '' as const, rotulo: 'Todas' }, ...SITUACOES.map((v) => ({ valor: v, rotulo: ROTULO_DA_SITUACAO[v] }))]}
        />
        <Combo
          rotulo="Categoria"
          valor={categoria}
          aoMudar={setCategoria}
          opcoes={[{ valor: '', rotulo: 'Todas as categorias' }, ...[...new Set(estado.produtos.map((p) => p.categoria))].map((c) => ({ valor: c, rotulo: c }))]}
        />
        <Selecao
          rotulo="Ordenar"
          valor={ordem}
          aoMudar={setOrdem}
          opcoes={[{ valor: 'recentes', rotulo: 'Alterados recentemente' }, { valor: 'nome', rotulo: 'Nome: A–Z' }, { valor: 'margem', rotulo: 'Menor margem primeiro' }, { valor: 'sobra', rotulo: 'Menor sobra por venda primeiro' }]}
        />
        <Combo
          rotulo="Filtros salvos"
          valor=""
          aoMudar={(v) => {
            const f = estado.preferencias.filtrosSalvos?.[Number(v)]
            if (f) { setBusca(f.busca); setStatus(f.status as typeof status); setCategoria(f.categoria) }
          }}
          marcador="Escolher filtro"
          opcoes={(estado.preferencias.filtrosSalvos ?? []).map((f, i) => ({ valor: String(i), rotulo: f.nome }))}
        />
        <Botao variante="fantasma" onClick={() => setJanela('filtro')}>Salvar filtro</Botao>
      </div>

      {ultimoLote ? (
        <Aviso tipo="ok">
          Alteração em lote aplicada.{' '}
          <button className="text-link" onClick={async () => { if (await agir(() => lucroApi.reverterLote(ultimoLote), 'Alterações revertidas.')) setUltimoLote(null) }}>
            Reverter este lote
          </button>
        </Aviso>
      ) : null}
      {selecao.length > 0 ? (
        <div className="selection-bar">
          <span>{selecao.length} selecionado(s)</span>
          {escreve ? <Botao variante="secundario" onClick={() => { setPrevia(null); setJanela('lote') }}><SlidersHorizontal size={16} />Precificar em lote</Botao> : null}
          <Botao variante="fantasma" onClick={() => setSelecao([])}>Limpar seleção</Botao>
        </div>
      ) : null}

      {produtos.length === 0 ? (
        <section className="panel">
          <Vazio
            icone={<Package size={30} />}
            titulo={estado.produtos.length ? 'Nenhum produto com esses filtros.' : 'Seu catálogo começa com um produto.'}
            acao={escreve ? <Botao onClick={() => navegar('/precificar')}><Plus size={16} />Precificar produto</Botao> : undefined}
          >
            Cadastre nome e custo. Depois, complete taxas, embalagem e a margem que faz sentido para você.
          </Vazio>
          {escreve && !estado.produtos.length ? (
            <p className="small muted section-gap">
              Prefere ver como fica?{' '}
              <button className="text-link" onClick={() => void agir(() => lucroApi.adicionarExemplos(), 'Produtos de exemplo adicionados. Você pode arquivá-los depois.')}>
                Adicionar produtos de exemplo
              </button>
            </p>
          ) : null}
        </section>
      ) : (
        <>
          <div className={`catalog ${vista === 'cartoes' ? 'card-view' : ''}`}>
            <div className="catalog-head">
              <label>
                <input
                  type="checkbox"
                  aria-label="Selecionar produtos desta página"
                  checked={visiveis.length > 0 && visiveis.every((p) => selecao.includes(p.id))}
                  onChange={(e) =>
                    setSelecao(e.target.checked ? [...new Set([...selecao, ...visiveis.map((p) => p.id)])] : selecao.filter((id) => !visiveis.some((p) => p.id === id)))
                  }
                />
              </label>
              <span>Produto</span><span>Você cobra</span><span>Sobra por venda</span><span>Margem</span><span>Desconto possível</span><span>Ações</span>
            </div>
            {visiveis.map((p) => {
              const situacaoDele = situacaoDoPreco(p)
              const c = p.calculo
              const venda = c?.atual ?? null
              return (
                <article className={`catalog-row ${destaque === p.id ? 'saved-product' : ''}`} key={p.id}>
                  <label className="product-checkbox">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${p.nome}`}
                      checked={selecao.includes(p.id)}
                      onChange={(e) => setSelecao(e.target.checked ? [...selecao, p.id] : selecao.filter((id) => id !== p.id))}
                    />
                  </label>
                  <div className="product-name-cell">
                    {p.imagemId ? <ImagemDoEspaco className="product-thumb"  caminho={enderecos.imagem(p.imagemId)} alt="" /> : <div className="product-icon"><Package size={20} /></div>}
                    <div>
                      <button className="product-title" onClick={() => (escreve ? setEditando(p) : editar(p, '/produtos'))}>{p.nome}</button>
                      <small>{p.categoria}{p.exemplo ? ' · Exemplo' : ''}</small>
                      {p.sku ? <small>SKU {p.sku}</small> : null}
                    </div>
                  </div>
                  {/*
                    * O que sobra é o do preço que a pessoa COBRA. O sugerido não é um segundo preço solto ao
                    * lado: ele vira a dica "mínimo para a meta" só quando ajuda — sem preço ou abaixo da meta.
                    */}
                  <div data-label="Você cobra">
                    {venda ? brl(venda.preco) : <span className="muted">Não definido</span>}
                    {c && situacaoDele !== 'na_meta' ? <small className="price-hint">mínimo para a meta: {brl(c.minimo)}</small> : null}
                  </div>
                  <div data-label="Sobra por venda">
                    {venda ? <strong className={Number(venda.lucro) < 0 ? 'negative' : 'positive'}>{brl(venda.lucro)}</strong> : <span className="muted">—</span>}
                  </div>
                  <div data-label="Margem">
                    <Selo tom={TOM_DA_SITUACAO[situacaoDele]}>{venda ? pct(venda.margem) : ROTULO_DA_SITUACAO[situacaoDele]}</Selo>
                    {venda ? <small className="price-hint">{ROTULO_DA_SITUACAO[situacaoDele]} · meta {pct(p.premissas.meta)}</small> : null}
                  </div>
                  <div data-label="Desconto possível">
                    {!venda ? <span className="muted">—</span>
                      : c?.descontoMaximo && Number(c.descontoMaximo.valor) > 0 ? (
                        <><strong>até {brl(c.descontoMaximo.valor)}</strong><small className="price-hint">{pct(c.descontoMaximo.percentual)} · mantendo a meta</small></>
                      ) : c?.descontoAteEquilibrio && Number(c.descontoAteEquilibrio.valor) > 0 ? (
                        <><strong className="warning-text">até {brl(c.descontoAteEquilibrio.valor)}</strong><small className="price-hint">só cobre os custos, abaixo da meta</small></>
                      ) : <span className="negative">Nenhum</span>}
                  </div>
                  <div className="product-actions">
                    <button className="icon-button" onClick={() => etiquetar([p.id])} aria-label={`Imprimir etiqueta de ${p.nome}`} title="Imprimir etiqueta"><Tag size={16} /></button>
                    {escreve ? (
                      <>
                        <button className="icon-button" aria-label={`Editar ${p.nome}`} title="Editar" onClick={() => setEditando(p)}><Pencil size={16} /></button>
                        <button className={`icon-button ${p.favorito ? 'favorite' : ''}`} aria-label={`${p.favorito ? 'Desafixar' : 'Fixar'} ${p.nome}`} onClick={() => void acao(p, 'favorito')}><Star size={16} /></button>
                        <button className="icon-button" aria-label={`Duplicar ${p.nome}`} onClick={() => void acao(p, 'duplicar', 'Cópia criada no catálogo.')}><Copy size={16} /></button>
                      </>
                    ) : null}
                    <button className="icon-button" aria-label={`Histórico de ${p.nome}`} onClick={() => void abrirHistorico(p)}><History size={16} /></button>
                    {escreve ? (
                      <button
                        className="icon-button"
                        aria-label={p.status === 'arquivado' ? 'Restaurar produto' : 'Arquivar produto'}
                        onClick={() => (p.status === 'arquivado' ? void acao(p, 'restaurar', 'Produto restaurado.') : setArquivando(p))}
                      >
                        {p.status === 'arquivado' ? <RotateCcw size={16} /> : <Archive size={16} />}
                      </button>
                    ) : null}
                    {escreve && p.status === 'arquivado' ? (
                      <button className="icon-button danger" aria-label={`Apagar ${p.nome}`} title="Apagar de vez" onClick={() => setApagando(p)}><Trash2 size={16} /></button>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
          <Paginacao pagina={atual} porPagina={porPagina} total={produtos.length} aoMudarPagina={setPagina} aoMudarPorPagina={setPorPagina} rotulo="produtos" />
        </>
      )}

      <Janela
        aberta={!!arquivando}
        aoFechar={() => setArquivando(null)}
        titulo="Arquivar produto?"
        descricao="O produto sairá das análises ativas. O histórico será preservado e você poderá restaurá-lo."
      >
        <p>{arquivando?.nome}</p>
        <div className="dialog-actions">
          <Botao variante="fantasma" onClick={() => setArquivando(null)}>Cancelar</Botao>
          <Botao onClick={async () => { if (arquivando) await acao(arquivando, 'arquivar', 'Produto arquivado.'); setArquivando(null) }}>Arquivar produto</Botao>
        </div>
      </Janela>

      <Janela
        aberta={!!apagando}
        aoFechar={() => setApagando(null)}
        titulo="Apagar o produto de vez?"
        descricao="O produto, o histórico de preços e os cenários dele saem do catálogo e não voltam. Produto com movimentação de estoque ou venda não pode ser apagado: ele sustenta o custo médio e os relatórios, e fica arquivado."
      >
        <p><strong>{apagando?.nome}</strong></p>
        <div className="dialog-actions">
          <Botao variante="fantasma" onClick={() => setApagando(null)}>Cancelar</Botao>
          <Botao variante="perigo" ocupado={ocupado} onClick={async () => {
            if (apagando) {
              setOcupado(true)
              try {
                await agir(() => lucroApi.excluirProduto(apagando.id), 'Produto apagado.')
                setSelecao((s) => s.filter((id) => id !== apagando.id))
              } finally {
                setOcupado(false)
              }
            }
            setApagando(null)
          }}><Trash2 size={15} />Apagar de vez</Botao>
        </div>
      </Janela>

      <EditarProduto produto={editando} aoFechar={() => setEditando(null)} aoCompleta={(p) => { setEditando(null); editar(p, '/produtos') }} />

      <Janela aberta={janela === 'exportar'} aoFechar={() => setJanela(null)} titulo="Leve seus dados com você" descricao="As exportações usam os produtos salvos e incluem premissas de cálculo.">
        <div className="export-options">
          {([
            ['csv', 'CSV', 'Para importar em outras ferramentas'],
            ['xlsx', 'Excel', 'Catálogo e premissas em abas'],
            ['pdf', 'PDF', 'Relatório de preços e composição'],
            ['json', 'Meus dados', 'Catálogo e histórico completo'],
          ] as const).map(([formato, titulo, sub]) => (
            <BaixarArquivo key={formato}  caminho={enderecos.exportar(formato)} className="export-option">
              <Download size={20} /><div><strong>{titulo}</strong><span>{sub}</span></div><ArrowRight size={16} />
            </BaixarArquivo>
          ))}
        </div>
      </Janela>

      <Janela aberta={janela === 'historico'} aoFechar={() => setJanela(null)} titulo="Histórico preservado" descricao={nomeDoHistorico} larga>
        <div className="history-list">
          {historico.map((h) => (
            <div key={h.id}>
              <span className="history-dot" />
              <div>
                <strong>Revisão {h.revisao}</strong>
                <p>{data(h.criadoEm)} · Motor {h.versaoDoMotor}{h.loteId ? ' · alteração em lote' : ''}</p>
                <p>
                  Preço que você cobra: {brl(h.retrato.premissas.preco)} · Sugerido: {brl(h.retrato.calculo.sugerido)} · Meta: {pct(h.retrato.premissas.meta)}
                </p>
                <details>
                  <summary>Premissas desta revisão</summary>
                  <pre>{JSON.stringify(h.retrato.premissas, null, 2)}</pre>
                </details>
              </div>
            </div>
          ))}
        </div>
      </Janela>

      <Janela
        aberta={janela === 'lote'}
        aoFechar={() => { setJanela(null); setPrevia(null) }}
        titulo="Precificar em lote"
        descricao={`${selecao.length} produtos selecionados. Revise as diferenças antes de aplicar.`}
        larga
      >
        {!previa ? (
          <div className="form-stack">
            <>
                <Selecao
                  rotulo="O que deseja alterar?"
                  valor={tipoDeRegra}
                  aoMudar={setTipoDeRegra}
                  opcoes={[
                    { valor: 'meta', rotulo: 'Margem-alvo' },
                    { valor: 'aumentoDoCusto', rotulo: 'Aumento percentual do custo' },
                    { valor: 'embalagem', rotulo: 'Custo da embalagem' },
                    { valor: 'arredondamento', rotulo: 'Arredondamento comercial' },
                    { valor: 'canalId', rotulo: 'Perfil de canal' },
                  ]}
                />
                {tipoDeRegra === 'arredondamento' ? (
                  <Selecao
                    rotulo="Arredondamento"
                    valor={regra.arredondamento}
                    aoMudar={(v) => setRegra({ ...regra, arredondamento: v })}
                    opcoes={[{ valor: 'nenhum', rotulo: 'Sem ajuste' }, { valor: '90', rotulo: 'Final ,90' }, { valor: '99', rotulo: 'Final ,99' }, { valor: 'inteiro', rotulo: 'Inteiro' }]}
                  />
                ) : tipoDeRegra === 'canalId' ? (
                  <Combo
                    rotulo="Canal"
                    valor={regra.canalId}
                    aoMudar={(v) => setRegra({ ...regra, canalId: v })}
                    opcoes={[{ valor: '', rotulo: 'Escolha um canal' }, ...estado.canais.map((c) => ({ valor: c.id, rotulo: c.nome }))]}
                  />
                ) : (
                  <CampoNumero
                    rotulo={tipoDeRegra === 'meta' ? 'Nova margem' : tipoDeRegra === 'aumentoDoCusto' ? 'Aumentar custo em' : 'Nova embalagem por unidade'}
                    prefixo={tipoDeRegra === 'embalagem' ? 'R$' : '%'}
                    valor={regra[tipoDeRegra]}
                    aoMudar={(v) => setRegra({ ...regra, [tipoDeRegra]: v })}
                  />
                )}
                <Aviso>Ao aplicar, o preço praticado será atualizado para o sugerido. A prévia não altera o catálogo.</Aviso>
                <Botao ocupado={ocupado} onClick={() => void calcularLote()}>Calcular prévia</Botao>
            </>
          </div>
        ) : (
          <>
            <div className="preview-rows">
              {previa.linhas.map((r, i) => (
                <div key={i}>
                  <div>
                    <strong>{r.depois?.nome ?? r.antes?.nome ?? `Linha ${r.linha}`}</strong>
                    <small>{r.acao ?? 'Atualizar'}</small>
                  </div>
                  {r.erro ? (
                    <span className="negative">{r.erro}</span>
                  ) : (
                    <div><span>{r.antes ? brl(r.antes.premissas.preco) : 'Novo'}</span><ArrowRight size={14} /><strong>{brl(r.sugerido)}</strong></div>
                  )}
                </div>
              ))}
            </div>
            <Aviso tipo="atencao">Confira os valores e as linhas afetadas. A confirmação grava os produtos e registra o histórico.</Aviso>
            <div className="dialog-actions">
              <Botao variante="fantasma" onClick={() => setPrevia(null)}>Revisar regras</Botao>
              <Botao ocupado={ocupado} disabled={previa.linhas.some((r) => r.erro)} onClick={() => void confirmar()}><Check size={16} />Confirmar alterações</Botao>
            </div>
          </>
        )}
      </Janela>

      <Janela aberta={janela === 'filtro'} aoFechar={() => setJanela(null)} titulo="Salvar este filtro">
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const nome = String(new FormData(e.currentTarget).get('nome'))
            const filtrosSalvos = [...(estado.preferencias.filtrosSalvos ?? []), { nome, busca, status, categoria }]
            if (await agir(() => lucroApi.preferencias({ filtrosSalvos }), 'Filtro salvo.')) setJanela(null)
          }}
        >
          <CampoDeTexto rotulo="Nome do filtro" name="nome" required maxLength={60} />
          <div className="dialog-actions"><Botao type="submit">Salvar filtro</Botao></div>
        </form>
      </Janela>
    </>
  )
}
