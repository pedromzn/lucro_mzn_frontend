/**
 * Etiquetas — escolher os produtos, o estilo e o papel, e baixar o PDF.
 *
 * Refeita em 22/10/2026 (pedido do Pedro: "não é intuitivo"). A tela segue a
 * ordem em que a pessoa pensa, em três passos numerados, com o resumo e a
 * prévia sempre à vista do lado:
 *
 * 1. **Produtos e quantidades** — busca, marcar, e as cópias de cada um.
 * 2. **Estilo** — quatro desenhos (`ESTILOS_DE_ETIQUETA`), cada um mostrado com
 *    o produto escolhido. O estilo é o DESENHO; o papel é outra escolha.
 * 3. **Papel e impressão** — a folha, a loja e o logo, e a folha desenhada:
 *    quem tem folha começada clica onde quer começar, em vez de contar posição.
 *
 * O PDF é desenhado no SERVIDOR com o preço que está no catálogo naquele
 * instante e baixado na hora; ele não fica guardado (não há segunda via desde
 * 22/10/2026). O logo é um dos logos da EMPRESA, cadastrados em Sua empresa —
 * esta tela só escolhe, não envia arquivo. A prévia daqui é de conteúdo e
 * proporção; quem manda nas medidas é o PDF.
 */

import { ImagemDoEspaco } from '@/components/ArquivosDoEspaco'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Check, Download, FileJson, Minus, Plus, Printer, Search, Upload, X } from 'lucide-react'
import {
  ESTILOS_DE_ETIQUETA, MAXIMO_DE_ETIQUETAS, MODELOS_DE_FABRICA, NOMES_DOS_ESTILOS, layoutDeEtiquetaSchema,
  type EstiloDeEtiqueta, type LayoutDeEtiqueta,
} from '@shared/etiquetas'
import { enderecos, lucroApi, type LogoDaEmpresa, type ModeloDeEtiqueta } from '@/lib/api'
import { useSessao } from '@/lib/sessao'
import { usePainel } from '@/lib/painel'
import { toast } from '@/lib/avisos'
import { Aviso, Botao, CampoDeTexto, CampoNumero, Combo, Janela, Selo, Vazio, brl, erroDe, novaChave } from '@/components/ui'

const DE_FABRICA: ModeloDeEtiqueta[] = MODELOS_DE_FABRICA.map((m) => ({ ...m, chave: m.id, deFabrica: true }))

function baixar(arquivo: Blob, nome: string) {
  const url = URL.createObjectURL(arquivo)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const MEDIDAS = [['largura', 'Largura da etiqueta'], ['altura', 'Altura da etiqueta'], ['colunas', 'Colunas na folha'], ['linhas', 'Linhas na folha']] as const
const MARGENS = [
  ['margemEsquerda', 'Margem esquerda'], ['margemSuperior', 'Margem superior'], ['espacoEntreColunas', 'Espaço entre colunas'],
  ['espacoEntreLinhas', 'Espaço entre linhas'], ['tamanhoDoTexto', 'Tamanho do texto'], ['tamanhoDoPreco', 'Tamanho do preço'],
] as const
const OPCOES = [['mostrarLoja', 'Mostrar nome da loja e logo'], ['mostrarCodigo', 'Mostrar código do produto'], ['mostrarUnidade', 'Mostrar unidade de venda'], ['contorno', 'Mostrar contorno das etiquetas']] as const

/** o produto da prévia quando nada foi escolhido ainda */
const AMOSTRA = { nome: 'Garrafa térmica 500 ml', preco: '79.90', unidade: 'unidade', sku: 'GAR-500', exemplo: false }

/**
 * A etiqueta em HTML, no estilo escolhido. As fontes vêm em pontos, como no
 * PDF, e viram `cqw` (porcentagem da largura da etiqueta): a mesma prévia serve
 * no cartão pequeno do estilo e no resumo grande, na proporção certa.
 */
function PreviaDaEtiqueta({ estilo, layout, produto, loja, logoId }: {
  estilo: EstiloDeEtiqueta
  layout: LayoutDeEtiqueta
  produto: typeof AMOSTRA
  loja: string
  logoId: string | null
}) {
  const pt = (pontos: number) => `${(pontos * 35.28) / layout.largura}cqw`
  const estiloDaCaixa = {
    aspectRatio: `${layout.largura} / ${layout.altura}`,
    '--texto': pt(layout.tamanhoDoTexto),
    '--preco': pt(layout.tamanhoDoPreco),
  } as CSSProperties
  const nomeDaLoja = produto.exemplo ? `EXEMPLO · ${loja}` : loja
  const mostraLoja = (layout.mostrarLoja || produto.exemplo) && nomeDaLoja.trim()
  const detalhe = [layout.mostrarUnidade ? `por ${produto.unidade}` : '', layout.mostrarCodigo && produto.sku ? `Cód. ${produto.sku}` : ''].filter(Boolean).join(' · ')
  const logo = layout.mostrarLoja && logoId ? <ImagemDoEspaco caminho={enderecos.imagem(logoId)} alt="" /> : null
  return (
    /* a caixa é o contêiner das medidas em `cqw`; o conteúdo, com o respiro, mora no filho — medida em `cqw` na própria caixa não enxerga a largura dela */
    <div className={`lbl-tag lbl-tag-${estilo}`} style={estiloDaCaixa} aria-label={`Prévia da etiqueta de ${produto.nome}`}>
      <div className="lbl-tag-in">
      {estilo === 'minimalista' ? <i className="lbl-tag-frame" /> : null}
      {estilo === 'faixa' ? (
        <div className="lbl-tag-band">{logo}<span>{mostraLoja ? nomeDaLoja : produto.nome}</span></div>
      ) : mostraLoja && estilo !== 'destaque' ? (
        <div className="lbl-tag-store">{logo}<span>{nomeDaLoja}</span></div>
      ) : null}
      {estilo === 'faixa' && !mostraLoja ? null : <div className="lbl-tag-name">{produto.nome}</div>}
      <div className="lbl-tag-price">{brl(produto.preco)}</div>
      {/* no preço em destaque o logo vai no rodapé, junto da loja — igual ao PDF */}
      <div className="lbl-tag-foot">{estilo === 'destaque' ? <>{logo}<span>{[mostraLoja ? nomeDaLoja : '', detalhe].filter(Boolean).join(' · ')}</span></> : detalhe}</div>
      </div>
    </div>
  )
}

/** O número do passo, com o "feito" quando ele já está resolvido. */
function Passo({ numero, titulo, descricao, feito }: { numero: number; titulo: string; descricao: string; feito: boolean }) {
  return (
    <div className="lbl-step-head">
      <span className={`lbl-step-number${feito ? ' done' : ''}`}>{feito ? <Check size={15} /> : numero}</span>
      <div><h2>{titulo}</h2><p className="muted small">{descricao}</p></div>
    </div>
  )
}

export default function Etiquetas() {
  const estado = usePainel((s) => s.estado)!
  const iniciais = (useLocation().state as { ids?: string[] } | null)?.ids ?? []
  const [modelos, setModelos] = useState<ModeloDeEtiqueta[]>(DE_FABRICA)
  const [modeloId, setModeloId] = useState('a4-21')
  const [estilo, setEstilo] = useState<EstiloDeEtiqueta>('classico')
  const [logos, setLogos] = useState<LogoDaEmpresa[]>([])
  const ehGestor = useSessao((s) => s.ehGestor())
  const [busca, setBusca] = useState('')
  const [selecionados, setSelecionados] = useState<Record<string, number>>(() => Object.fromEntries(iniciais.map((id) => [id, 1])))
  const [nomeDaLoja, setNomeDaLoja] = useState(estado.empresa)
  const [logoId, setLogoId] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [deslocamentoX, setDeslocamentoX] = useState('0')
  const [deslocamentoY, setDeslocamentoY] = useState('0')
  const [posicaoInicial, setPosicaoInicial] = useState(0)
  const [editando, setEditando] = useState(false)
  const [nomeDoRascunho, setNomeDoRascunho] = useState('Meu modelo A4')
  const [rascunho, setRascunho] = useState<LayoutDeEtiqueta>(MODELOS_DE_FABRICA[0].layout)

  const recarregar = async () => setModelos((await lucroApi.etiquetas()).modelos)
  useEffect(() => {
    lucroApi.etiquetas().then((r) => setModelos(r.modelos)).catch((e) => setErro(erroDe(e)))
    /* o primeiro logo já vem escolhido: quem cadastrou um logo quer ele na etiqueta */
    lucroApi.logos().then((r) => { setLogos(r.logos); setLogoId((atual) => atual ?? r.logos[0]?.id ?? null) }).catch(() => undefined)
  }, [])

  const modelo = modelos.find((m) => m.id === modeloId) ?? modelos[0]
  const layout = modelo.layout
  const capacidade = layout.colunas * layout.linhas
  const produtos = useMemo(() => estado.produtos.filter((p) => p.status === 'ativo'), [estado.produtos])
  const termo = busca.toLocaleLowerCase('pt-BR')
  const visiveis = produtos.filter((p) => `${p.nome} ${p.sku ?? ''}`.toLocaleLowerCase('pt-BR').includes(termo)).slice(0, 100)
  const temPreco = (preco: string) => Number(preco) > 0
  const itens = produtos.filter((p) => selecionados[p.id])
  const total = itens.reduce((s, p) => s + selecionados[p.id], 0)
  const folhas = total ? Math.ceil((posicaoInicial + total) / capacidade) : 0
  const primeiro = itens[0]
  const naPrevia = primeiro
    ? { nome: primeiro.nome, preco: primeiro.premissas.preco, unidade: primeiro.unidade, sku: primeiro.sku ?? '', exemplo: primeiro.exemplo }
    : AMOSTRA

  const copias = (id: string, n: number) => setSelecionados({ ...selecionados, [id]: Math.max(1, Math.min(MAXIMO_DE_ETIQUETAS, n || 1)) })
  const marcar = (id: string, sim: boolean) => {
    const proximo = { ...selecionados }
    if (sim) proximo[id] = 1
    else delete proximo[id]
    setSelecionados(proximo)
  }
  const trocarModelo = (v: string) => { setModeloId(v); setPosicaoInicial(0); setDeslocamentoX('0'); setDeslocamentoY('0') }

  async function gerar() {
    setOcupado(true)
    setErro('')
    try {
      const pdf = await lucroApi.gerarEtiquetas({
        chaveDaOperacao: novaChave(), modeloId: modelo.id, estilo, itens: itens.map((p) => ({ produtoId: p.id, copias: selecionados[p.id] })),
        posicaoInicial, deslocamentoX: Number(deslocamentoX), deslocamentoY: Number(deslocamentoY), nomeDaLoja, logoId,
      })
      baixar(pdf, 'LucroCerto-etiquetas.pdf')
      toast('PDF de etiquetas gerado. Imprima em tamanho real, 100%.')
    } catch (e) {
      setErro(erroDe(e, 'Não foi possível gerar as etiquetas.'))
    } finally {
      setOcupado(false)
    }
  }

  async function salvarModelo() {
    setOcupado(true)
    try {
      const layoutValido = layoutDeEtiquetaSchema.parse(rascunho)
      const r = await lucroApi.salvarModeloDeEtiqueta({ nome: nomeDoRascunho, layout: layoutValido })
      await recarregar()
      trocarModelo(r.id)
      setEditando(false)
      toast('Modelo salvo na sua biblioteca de etiquetas.')
    } catch (e) {
      toast(e instanceof Error && 'issues' in e ? 'Confira as medidas: o modelo não cabe na folha A4.' : erroDe(e))
    } finally {
      setOcupado(false)
    }
  }

  async function importarModelo(arquivo: File | undefined) {
    if (!arquivo) return
    try {
      if (arquivo.size > 20_000) throw new Error()
      const lido = JSON.parse(await arquivo.text()) as { nome?: unknown; layout?: unknown }
      setRascunho(layoutDeEtiquetaSchema.parse(lido.layout))
      setNomeDoRascunho(String(lido.nome ?? 'Modelo importado').slice(0, 100))
      setEditando(true)
    } catch {
      toast('Não foi possível ler o modelo. Use o JSON de referência e confira as medidas.')
    }
  }

  return (
    <div className="lbl-page">
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <div className="lbl-layout">
        <div className="lbl-steps">
          {/* ── 1. produtos ── */}
          <section className="panel lbl-step">
            <Passo numero={1} titulo="Produtos e quantidades" descricao="Marque o que vai etiquetar e quantas etiquetas de cada. A etiqueta usa o preço que você cobra hoje." feito={total > 0} />
            <div className="lbl-search-row">
              <div className="search">
                <Search size={18} />
                <input type="search" aria-label="Buscar produtos para etiquetas" placeholder="Buscar produto ou código" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
              <Botao
                variante="fantasma"
                onClick={() => setSelecionados(Object.fromEntries([...Object.entries(selecionados), ...visiveis.filter((p) => temPreco(p.premissas.preco)).map((p) => [p.id, selecionados[p.id] || 1])]))}
              >
                Marcar {busca ? 'os encontrados' : 'todos'}
              </Botao>
              {itens.length ? <Botao variante="fantasma" onClick={() => setSelecionados({})}><X size={15} />Limpar</Botao> : null}
            </div>
            <div className="lbl-products">
              {visiveis.map((p) => {
                const pode = temPreco(p.premissas.preco)
                const marcado = !!selecionados[p.id]
                return (
                  <div className={`lbl-product${marcado ? ' marked' : ''}${pode ? '' : ' off'}`} key={p.id}>
                    <label>
                      <input type="checkbox" checked={marcado} disabled={!pode} onChange={(e) => marcar(p.id, e.target.checked)} />
                      {p.imagemId ? <ImagemDoEspaco className="lbl-product-thumb" caminho={enderecos.imagem(p.imagemId)} alt="" /> : <span className="lbl-product-thumb vazia" />}
                      <span className="lbl-product-text">
                        <strong>{p.nome}{p.exemplo ? <Selo>Exemplo</Selo> : null}</strong>
                        <small>{pode ? `${brl(p.premissas.preco)} por ${p.unidade}${p.sku ? ` · Cód. ${p.sku}` : ''}` : 'Sem preço de venda: defina no cadastro para imprimir.'}</small>
                      </span>
                    </label>
                    {marcado ? (
                      <div className="lbl-stepper" role="group" aria-label={`Etiquetas de ${p.nome}`}>
                        <button type="button" aria-label="Uma a menos" disabled={selecionados[p.id] <= 1} onClick={() => copias(p.id, selecionados[p.id] - 1)}><Minus size={14} /></button>
                        <input
                          aria-label={`Número de etiquetas de ${p.nome}`}
                          inputMode="numeric"
                          value={selecionados[p.id]}
                          onChange={(e) => copias(p.id, Number(e.target.value.replace(/\D/g, '')))}
                        />
                        <button type="button" aria-label="Uma a mais" onClick={() => copias(p.id, selecionados[p.id] + 1)}><Plus size={14} /></button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
            {!visiveis.length ? <Vazio titulo="Nenhum produto encontrado.">Cadastre seus produtos e defina o preço de venda para gerar etiquetas.</Vazio> : null}
            <p className="small muted">Até 100 resultados por busca e {MAXIMO_DE_ETIQUETAS} etiquetas por arquivo. Imprimir etiqueta não mexe no estoque.</p>
          </section>

          {/* ── 2. estilo ── */}
          <section className="panel lbl-step">
            <Passo numero={2} titulo="Estilo da etiqueta" descricao="O desenho de cada etiqueta. Qualquer estilo serve em qualquer papel." feito />
            <div className="lbl-styles" role="radiogroup" aria-label="Estilo da etiqueta">
              {ESTILOS_DE_ETIQUETA.map((e) => (
                <button type="button" role="radio" aria-checked={estilo === e} key={e} className={`lbl-style${estilo === e ? ' active' : ''}`} onClick={() => setEstilo(e)}>
                  <div className="lbl-style-stage">
                    <PreviaDaEtiqueta estilo={e} layout={layout} produto={naPrevia} loja={nomeDaLoja} logoId={logoId} />
                  </div>
                  <strong>{estilo === e ? <Check size={15} /> : null}{NOMES_DOS_ESTILOS[e].nome}</strong>
                  <small>{NOMES_DOS_ESTILOS[e].descricao}</small>
                </button>
              ))}
            </div>
          </section>

          {/* ── 3. papel ── */}
          <section className="panel lbl-step">
            <Passo numero={3} titulo="Papel e impressão" descricao="A folha adesiva que você vai usar, a loja que aparece na etiqueta e onde começar a imprimir." feito />
            <div className="lbl-paper">
              <div className="form-stack">
                <Combo rotulo="Folha de etiquetas" valor={modelo.id} aoMudar={trocarModelo} opcoes={modelos.map((m) => ({ valor: m.id, rotulo: m.nome }))} />
                <CampoDeTexto rotulo="Nome da loja na etiqueta" value={nomeDaLoja} maxLength={60} onChange={(e) => setNomeDaLoja(e.target.value)} />
                <div className="field">
                  <span className="field-title">Logo na etiqueta</span>
                  <div className="lbl-logos" role="radiogroup" aria-label="Logo na etiqueta">
                    <button type="button" role="radio" aria-checked={!logoId} className={`lbl-logo-option${!logoId ? ' active' : ''}`} onClick={() => setLogoId(null)}>
                      <span className="lbl-logo-image vazia"><X size={16} /></span>Sem logo
                    </button>
                    {logos.map((l, i) => (
                      <button type="button" role="radio" aria-checked={logoId === l.id} key={l.id} className={`lbl-logo-option${logoId === l.id ? ' active' : ''}`} onClick={() => setLogoId(l.id)}>
                        <ImagemDoEspaco className="lbl-logo-image" caminho={enderecos.imagem(l.id)} alt="" />Logo {i + 1}
                      </button>
                    ))}
                  </div>
                  <small>
                    {logos.length ? 'Os logos são da empresa, cadastrados uma vez em Sua empresa.' : 'Nenhum logo cadastrado ainda.'}{' '}
                    {ehGestor ? <Link className="text-link" to="/empresa/logos">{logos.length ? 'Gerenciar logos' : 'Cadastrar um logo'}</Link> : 'Peça a um administrador para cadastrar.'}
                  </small>
                </div>
              </div>

              <div className="lbl-sheet-box">
                <div className="between">
                  <span className="field-title">Onde começar na folha</span>
                  {posicaoInicial ? <button type="button" className="text-link" onClick={() => setPosicaoInicial(0)}>Do início</button> : null}
                </div>
                <div className="lbl-sheet" style={{ gridTemplateColumns: `repeat(${layout.colunas}, 1fr)` }}>
                  {Array.from({ length: capacidade }, (_, i) => {
                    const usada = i < posicaoInicial
                    const vai = !usada && i < posicaoInicial + total
                    return (
                      <button
                        type="button"
                        key={i}
                        className={`lbl-cell${usada ? ' used' : vai ? ' print' : ''}`}
                        style={{ aspectRatio: `${layout.largura} / ${layout.altura}` }}
                        aria-label={`Começar na etiqueta ${i + 1}`}
                        title={usada ? 'Já usada' : `Começar aqui (etiqueta ${i + 1})`}
                        onClick={() => setPosicaoInicial(i)}
                      />
                    )
                  })}
                </div>
                <small className="muted">
                  Folha começada? Clique na primeira etiqueta livre. <i className="lbl-key used" /> já usada <i className="lbl-key print" /> vai imprimir nesta folha
                </small>
              </div>
            </div>

            <details className="lbl-more">
              <summary>Ajuste fino da impressora</summary>
              <p className="small muted">Se a impressão sair deslocada, mova tudo alguns milímetros. Teste em papel comum antes da folha adesiva.</p>
              <div className="form-grid">
                <CampoNumero rotulo="Para a direita (negativo: esquerda)" prefixo="mm" negativo valor={deslocamentoX} aoMudar={setDeslocamentoX} />
                <CampoNumero rotulo="Para baixo (negativo: cima)" prefixo="mm" negativo valor={deslocamentoY} aoMudar={setDeslocamentoY} />
              </div>
            </details>
            {estado.podeEscrever ? (
              <details className="lbl-more">
                <summary>Outro papel? Cadastre as medidas</summary>
                <p className="small muted">Para folhas que não estão na lista: informe as medidas em milímetros, ou importe um modelo em JSON.</p>
                <div className="actions">
                  <Botao variante="secundario" onClick={() => { setRascunho({ ...layout }); setNomeDoRascunho('Meu modelo A4'); setEditando(true) }}>Cadastrar papel</Botao>
                  <Botao variante="fantasma" onClick={() => baixar(new Blob([JSON.stringify({ nome: modelo.nome, layout }, null, 2)], { type: 'application/json' }), 'LucroCerto-modelo-etiqueta.json')}>
                    <FileJson size={16} />Baixar este em JSON
                  </Botao>
                  <label className="btn ghost">
                    <Upload size={15} />Importar JSON
                    <input type="file" accept=".json,application/json" hidden onChange={(e) => { void importarModelo(e.target.files?.[0]); e.target.value = '' }} />
                  </label>
                </div>
              </details>
            ) : null}
          </section>
        </div>

        {/* ── o resumo, sempre à vista ── */}
        <aside className="panel lbl-summary">
          <h3>Sua impressão</h3>
          <div className="lbl-summary-stage">
            <PreviaDaEtiqueta estilo={estilo} layout={layout} produto={naPrevia} loja={nomeDaLoja} logoId={logoId} />
          </div>
          <p className="small muted lbl-summary-caption">
            {primeiro ? `Prévia com ${primeiro.nome}.` : 'Prévia com um produto de amostra: marque os seus no passo 1.'} {layout.largura} × {layout.altura} mm.
          </p>
          <dl className="lbl-summary-facts">
            <div><dt>Estilo</dt><dd>{NOMES_DOS_ESTILOS[estilo].nome}</dd></div>
            <div><dt>Papel</dt><dd>{modelo.nome}</dd></div>
            <div><dt>Produtos</dt><dd>{itens.length}</dd></div>
            <div><dt>Etiquetas</dt><dd>{total}{folhas ? ` em ${folhas} folha${folhas > 1 ? 's' : ''}` : ''}</dd></div>
          </dl>
          {total > MAXIMO_DE_ETIQUETAS ? <Aviso tipo="atencao">Gere até {MAXIMO_DE_ETIQUETAS} etiquetas por arquivo.</Aviso> : null}
          <Botao className="full-width" ocupado={ocupado} disabled={!total || total > MAXIMO_DE_ETIQUETAS} onClick={() => void gerar()}>
            <Download size={17} />{total ? `Gerar PDF com ${total} etiqueta${total > 1 ? 's' : ''}` : 'Marque os produtos para gerar'}
          </Botao>
          <p className="small muted"><Printer size={13} /> Imprima em 100%, tamanho real, sem "ajustar à página".</p>
        </aside>
      </div>

      <Janela aberta={editando} aoFechar={() => { if (!ocupado) setEditando(false) }} titulo="Cadastrar papel de etiquetas" descricao="As medidas são em milímetros. O papel precisa corresponder às dimensões cadastradas.">
        <div className="form-stack">
          <CampoDeTexto rotulo="Nome do modelo" value={nomeDoRascunho} onChange={(e) => setNomeDoRascunho(e.target.value)} maxLength={100} />
          <div className="form-grid">
            {MEDIDAS.map(([chave, rotulo]) => (
              <CampoNumero
                key={chave}
                rotulo={rotulo}
                prefixo={chave === 'largura' || chave === 'altura' ? 'mm' : '#'}
                valor={String(rascunho[chave])}
                aoMudar={(v) => setRascunho({ ...rascunho, [chave]: Number(v) })}
              />
            ))}
          </div>
          <details>
            <summary>Margens, espaçamento e fonte</summary>
            <div className="form-grid section-gap">
              {MARGENS.map(([chave, rotulo]) => (
                <CampoNumero
                  key={chave}
                  rotulo={rotulo}
                  prefixo={chave.startsWith('tamanho') ? 'pt' : 'mm'}
                  valor={String(rascunho[chave])}
                  aoMudar={(v) => setRascunho({ ...rascunho, [chave]: Number(v) })}
                />
              ))}
            </div>
          </details>
          {OPCOES.map(([chave, rotulo]) => (
            <label className="check" key={chave}>
              <input type="checkbox" checked={rascunho[chave]} onChange={(e) => setRascunho({ ...rascunho, [chave]: e.target.checked })} />
              {rotulo}
            </label>
          ))}
          <Botao ocupado={ocupado} onClick={() => void salvarModelo()}>Salvar modelo</Botao>
        </div>
      </Janela>
    </div>
  )
}
