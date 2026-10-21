/**
 * Produtos — o catálogo do mock (`catalog.tsx`), com a mesma marcação: busca,
 * filtros salvos, tabela ou cartões, seleção, lote, importação, exportação e
 * histórico.
 *
 * Lote e importação são em DOIS tempos, como no mock: a prévia é calculada e
 * guardada no servidor, e confirmar aplica exatamente aquela prévia (pelo id
 * dela) — não um novo cálculo que poderia ter mudado entre um clique e outro.
 */

import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Archive, ArrowRight, Check, Copy, Download, History, LayoutGrid, List, Package, Plus, RotateCcw, Search, SlidersHorizontal, Star, Upload,
} from 'lucide-react'
import { enderecos, lucroApi, type Previa, type Produto, type RegraDoLote, type Revisao } from '@/lib/api'
import { agir, usePainel } from '@/lib/painel'
import { toast } from '@/lib/avisos'
import { Aviso, Botao, CampoDeTexto, CampoNumero, Janela, Selecao, Selo, Vazio, brl, data, erroDe, pct } from '@/components/ui'
import { avaliacaoDe, useEditarProduto } from './Inicio'

const POR_PAGINA = 12
type TipoDeRegra = 'meta' | 'aumentoDoCusto' | 'embalagem' | 'arredondamento' | 'canalId'
type Janelas = 'importar' | 'lote' | 'exportar' | 'historico' | 'filtro' | null

/** O XLSX vai em base64 no corpo JSON; o CSV, como texto. */
const lerArquivo = (arquivo: File): Promise<string> =>
  new Promise((resolver, recusar) => {
    const leitor = new FileReader()
    leitor.onload = () => resolver(String(leitor.result).split(',')[1])
    leitor.onerror = recusar
    leitor.readAsDataURL(arquivo)
  })

export default function Produtos() {
  const estado = usePainel((s) => s.estado)!
  const navegar = useNavigate()
  const editar = useEditarProduto()
  const destaque = (useLocation().state as { destaque?: string } | null)?.destaque
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState<'ativo' | 'arquivado' | 'todos'>('ativo')
  const [categoria, setCategoria] = useState('')
  const [ordem, setOrdem] = useState<'recentes' | 'nome' | 'margem'>('recentes')
  const [vista, setVista] = useState<'tabela' | 'cartoes'>('tabela')
  const [selecao, setSelecao] = useState<string[]>([])
  const [janela, setJanela] = useState<Janelas>(null)
  const [historico, setHistorico] = useState<Revisao[]>([])
  const [nomeDoHistorico, setNomeDoHistorico] = useState('')
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [regra, setRegra] = useState({ meta: '25', aumentoDoCusto: '0', embalagem: '0', arredondamento: 'nenhum', canalId: '' })
  const [tipoDeRegra, setTipoDeRegra] = useState<TipoDeRegra>('meta')
  const [duplicados, setDuplicados] = useState<'ignorar' | 'atualizar'>('ignorar')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [ultimoLote, setUltimoLote] = useState<string | null>(null)
  const [arquivando, setArquivando] = useState<Produto | null>(null)
  const [pagina, setPagina] = useState(1)
  const escreve = estado.podeEscrever

  const termo = busca.toLowerCase()
  const produtos = estado.produtos
    .filter((p) => (status === 'todos' || p.status === status) && (!categoria || p.categoria === categoria))
    .filter((p) => `${p.nome} ${p.sku ?? ''} ${p.tags.join(' ')}`.toLowerCase().includes(termo))
    .sort((a, b) =>
      ordem === 'nome'
        ? a.nome.localeCompare(b.nome, 'pt-BR')
        : ordem === 'margem'
          ? Number(avaliacaoDe(a)?.margem ?? 0) - Number(avaliacaoDe(b)?.margem ?? 0)
          : Date.parse(b.atualizadoEm) - Date.parse(a.atualizadoEm),
    )
  const paginas = Math.max(1, Math.ceil(produtos.length / POR_PAGINA))
  const atual = Math.min(pagina, paginas)
  const visiveis = produtos.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA)
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

  async function lerImportacao() {
    if (!arquivo) {
      toast('Escolha um arquivo CSV ou XLSX.')
      return
    }
    setOcupado(true)
    try {
      const formato = arquivo.name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv'
      const conteudo = formato === 'csv' ? await arquivo.text() : await lerArquivo(arquivo)
      setPrevia(await lucroApi.previaDaImportacao({ formato, conteudo, duplicados }))
    } catch (e) {
      toast(erroDe(e))
    } finally {
      setOcupado(false)
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
      if (janela === 'lote') setUltimoLote(r.loteId)
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
          {escreve ? <Botao variante="secundario" onClick={() => { setPrevia(null); setJanela('importar') }}><Upload size={16} />Importar</Botao> : null}
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
          rotulo="Categoria"
          valor={categoria}
          aoMudar={setCategoria}
          opcoes={[{ valor: '', rotulo: 'Todas as categorias' }, ...[...new Set(estado.produtos.map((p) => p.categoria))].map((c) => ({ valor: c, rotulo: c }))]}
        />
        <Selecao
          rotulo="Ordenar"
          valor={ordem}
          aoMudar={setOrdem}
          opcoes={[{ valor: 'recentes', rotulo: 'Alterados recentemente' }, { valor: 'nome', rotulo: 'Nome: A–Z' }, { valor: 'margem', rotulo: 'Menor margem primeiro' }]}
        />
        <Selecao
          rotulo="Filtros salvos"
          valor=""
          aoMudar={(v) => {
            const f = estado.preferencias.filtrosSalvos?.[Number(v)]
            if (f) { setBusca(f.busca); setStatus(f.status as typeof status); setCategoria(f.categoria) }
          }}
          opcoes={[{ valor: '', rotulo: 'Escolher filtro' }, ...(estado.preferencias.filtrosSalvos ?? []).map((f, i) => ({ valor: String(i), rotulo: f.nome }))]}
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
              <span>Produto</span><span>Preço que você cobra</span><span>Sugerido</span><span>Margem estimada</span><span>Ações</span>
            </div>
            {visiveis.map((p) => {
              const r = avaliacaoDe(p)
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
                    {p.imagemId ? <img className="product-thumb" src={enderecos.imagem(p.imagemId)} alt="" /> : <div className="product-icon"><Package size={20} /></div>}
                    <div>
                      <button className="product-title" onClick={() => editar(p, '/produtos')}>{p.nome}</button>
                      <small>{p.categoria}{p.exemplo ? ' · Exemplo' : ''}</small>
                      {p.sku ? <small>SKU {p.sku}</small> : null}
                    </div>
                  </div>
                  <div data-label="Praticado">{Number(p.premissas.preco) > 0 ? brl(p.premissas.preco) : 'Não definido'}</div>
                  <div data-label="Sugerido"><strong>{brl(p.calculo?.sugerido)}</strong></div>
                  <div data-label="Margem">
                    <Selo tom={!r ? 'vermelho' : Number(r.margem) < 0 ? 'vermelho' : r.atingeMeta ? 'verde' : 'ambar'}>{r ? pct(r.margem) : 'Revisar'}</Selo>
                  </div>
                  <div className="product-actions">
                    <button className="text-link" onClick={() => etiquetar([p.id])} aria-label={`Imprimir etiqueta de ${p.nome}`}>Etiqueta</button>
                    {escreve ? (
                      <>
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
                  </div>
                </article>
              )
            })}
          </div>
          <div className="pagination">
            <span>{produtos.length} produto(s) · página {atual} de {paginas}</span>
            <div>
              <Botao variante="fantasma" disabled={atual <= 1} onClick={() => setPagina(atual - 1)}>Anterior</Botao>
              <Botao variante="fantasma" disabled={atual >= paginas} onClick={() => setPagina(atual + 1)}>Próxima</Botao>
            </div>
          </div>
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

      <Janela aberta={janela === 'exportar'} aoFechar={() => setJanela(null)} titulo="Leve seus dados com você" descricao="As exportações usam os produtos salvos e incluem premissas de cálculo.">
        <div className="export-options">
          {([
            ['csv', 'CSV', 'Para importar em outras ferramentas'],
            ['xlsx', 'Excel', 'Catálogo e premissas em abas'],
            ['pdf', 'PDF', 'Relatório de preços e composição'],
            ['json', 'Meus dados', 'Catálogo e histórico completo'],
          ] as const).map(([formato, titulo, sub]) => (
            <a key={formato} href={enderecos.exportar(formato)} className="export-option">
              <Download size={20} /><div><strong>{titulo}</strong><span>{sub}</span></div><ArrowRight size={16} />
            </a>
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
        aberta={janela === 'importar' || janela === 'lote'}
        aoFechar={() => { setJanela(null); setPrevia(null) }}
        titulo={janela === 'importar' ? 'Importar seu catálogo' : 'Precificar em lote'}
        descricao={janela === 'importar' ? 'Até 500 linhas por arquivo. Você verá uma prévia antes de salvar.' : `${selecao.length} produtos selecionados. Revise as diferenças antes de aplicar.`}
        larga
      >
        {!previa ? (
          <div className="form-stack">
            {janela === 'importar' ? (
              <>
                <a className="text-link" href={enderecos.modeloDeImportacao}>Baixar modelo CSV de importação</a>
                <div className="upload-zone">
                  <Upload size={28} />
                  <label htmlFor="arquivo-de-importacao">Escolha um arquivo CSV ou XLSX (até 1 MB)</label>
                  <input id="arquivo-de-importacao" type="file" accept=".csv,.xlsx" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
                </div>
                <Selecao
                  rotulo="Produtos duplicados (por SKU ou nome)"
                  valor={duplicados}
                  aoMudar={setDuplicados}
                  opcoes={[{ valor: 'ignorar', rotulo: 'Ignorar os já cadastrados' }, { valor: 'atualizar', rotulo: 'Atualizar os já cadastrados' }]}
                />
                <Botao ocupado={ocupado} onClick={() => void lerImportacao()}>Validar e mostrar prévia</Botao>
              </>
            ) : (
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
                  <Selecao
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
            )}
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
