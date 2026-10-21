/**
 * Etiquetas — o `labels.tsx` do mock, com a mesma marcação: escolher os
 * produtos, o papel e o alinhamento, e baixar o PDF.
 *
 * O PDF é desenhado no SERVIDOR com o preço que está no catálogo naquele
 * instante, e guardado: a "segunda via" devolve o mesmo arquivo, com o preço
 * da época, mesmo que o produto tenha mudado depois.
 *
 * Os modelos "compartilhados com todas as contas" do mock viraram os modelos
 * de fábrica (`@shared/etiquetas`); não há administrador da MZN dentro do app.
 */

import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Download, FileJson, ImagePlus, Printer, Search, Tags, Upload } from 'lucide-react'
import { MAXIMO_DE_ETIQUETAS, MODELOS_DE_FABRICA, layoutDeEtiquetaSchema, type LayoutDeEtiqueta } from '@shared/etiquetas'
import { enderecos, lucroApi, type ModeloDeEtiqueta } from '@/lib/api'
import { usePainel } from '@/lib/painel'
import { toast } from '@/lib/avisos'
import { Aviso, Botao, CampoDeTexto, CampoNumero, Janela, Selecao, Selo, Vazio, brl, data, erroDe, novaChave } from '@/components/ui'

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

export default function Etiquetas() {
  const estado = usePainel((s) => s.estado)!
  const iniciais = (useLocation().state as { ids?: string[] } | null)?.ids ?? []
  const [modelos, setModelos] = useState<ModeloDeEtiqueta[]>(DE_FABRICA)
  const [modeloId, setModeloId] = useState('a4-21')
  const [geradas, setGeradas] = useState<Array<{ id: string; quantidade: number; criadoEm: string }>>([])
  const [busca, setBusca] = useState('')
  const [selecionados, setSelecionados] = useState<Record<string, number>>(() => Object.fromEntries(iniciais.map((id) => [id, 1])))
  const [nomeDaLoja, setNomeDaLoja] = useState(estado.empresa)
  const [logoId, setLogoId] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [deslocamentoX, setDeslocamentoX] = useState('0')
  const [deslocamentoY, setDeslocamentoY] = useState('0')
  const [posicaoInicial, setPosicaoInicial] = useState('0')
  const [editando, setEditando] = useState(false)
  const [nomeDoRascunho, setNomeDoRascunho] = useState('Meu modelo A4')
  const [rascunho, setRascunho] = useState<LayoutDeEtiqueta>(MODELOS_DE_FABRICA[0].layout)

  const recarregar = async () => {
    const r = await lucroApi.etiquetas()
    setModelos(r.modelos)
    setGeradas(r.geradas)
  }
  useEffect(() => {
    lucroApi.etiquetas().then((r) => { setModelos(r.modelos); setGeradas(r.geradas) }).catch((e) => setErro(erroDe(e)))
  }, [])

  const modelo = modelos.find((m) => m.id === modeloId) ?? modelos[0]
  const layout = modelo.layout
  const produtos = estado.produtos.filter((p) => p.status === 'ativo')
  const termo = busca.toLocaleLowerCase('pt-BR')
  const visiveis = produtos.filter((p) => `${p.nome} ${p.sku ?? ''}`.toLocaleLowerCase('pt-BR').includes(termo)).slice(0, 100)
  const itens = produtos.filter((p) => selecionados[p.id])
  const total = itens.reduce((s, p) => s + selecionados[p.id], 0)
  const primeiro = itens[0]
  const temPreco = (preco: string) => Number(preco) > 0

  async function gerar() {
    setOcupado(true)
    setErro('')
    try {
      const pdf = await lucroApi.gerarEtiquetas({
        chaveDaOperacao: novaChave(), modeloId: modelo.id, itens: itens.map((p) => ({ produtoId: p.id, copias: selecionados[p.id] })),
        posicaoInicial: Number(posicaoInicial), deslocamentoX: Number(deslocamentoX), deslocamentoY: Number(deslocamentoY), nomeDaLoja, logoId,
      })
      baixar(pdf, 'LucroCerto-etiquetas.pdf')
      await recarregar()
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
      setModeloId(r.id)
      setEditando(false)
      toast('Modelo salvo na sua biblioteca de etiquetas.')
    } catch (e) {
      toast(e instanceof Error && 'issues' in e ? 'Confira as medidas: o modelo não cabe na folha A4.' : erroDe(e))
    } finally {
      setOcupado(false)
    }
  }

  async function enviarLogo(arquivo: File | undefined) {
    if (!arquivo) return
    try {
      if (arquivo.size > 1_000_000) throw new Error('Use uma logo de até 1 MB.')
      setLogoId((await lucroApi.enviarImagem(arquivo)).id)
    } catch (e) {
      toast(erroDe(e))
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
    <div className="labels-content">
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <div className="labels-layout">
        <section className="panel">
          <div className="between">
            <div><h2>Escolha os produtos</h2><p className="muted small">A etiqueta usa o preço que você cobra hoje.</p></div>
            <Tags size={23} />
          </div>
          <div className="search section-gap">
            <Search size={18} />
            <input type="search" aria-label="Buscar produtos para etiquetas" placeholder="Buscar produto ou código" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div className="between label-selection-bar">
            <Botao
              variante="fantasma"
              onClick={() =>
                setSelecionados(Object.fromEntries([...Object.entries(selecionados), ...visiveis.filter((p) => temPreco(p.premissas.preco)).map((p) => [p.id, selecionados[p.id] || 1])]))
              }
            >
              Selecionar resultados
            </Botao>
            <Botao variante="fantasma" disabled={!itens.length} onClick={() => setSelecionados({})}>Limpar seleção</Botao>
          </div>
          <div className="label-product-list">
            {visiveis.map((p) => (
              <div className={selecionados[p.id] ? 'selected' : ''} key={p.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!selecionados[p.id]}
                    disabled={!temPreco(p.premissas.preco)}
                    onChange={(e) => {
                      const proximo = { ...selecionados }
                      if (e.target.checked) proximo[p.id] = 1
                      else delete proximo[p.id]
                      setSelecionados(proximo)
                    }}
                  />
                  <span>
                    <strong>{p.nome}</strong>
                    <small>{temPreco(p.premissas.preco) ? `${brl(p.premissas.preco)} por ${p.unidade}` : 'Defina o preço de venda no cadastro para imprimir.'}{p.exemplo ? ' · Exemplo' : ''}</small>
                  </span>
                </label>
                {selecionados[p.id] ? (
                  <label className="label-copies">
                    <span>Cópias</span>
                    <input
                      aria-label={`Número de etiquetas de ${p.nome}`}
                      type="number"
                      min={1}
                      max={MAXIMO_DE_ETIQUETAS}
                      step={1}
                      value={selecionados[p.id]}
                      onChange={(e) => setSelecionados({ ...selecionados, [p.id]: Math.max(1, Math.min(MAXIMO_DE_ETIQUETAS, Number(e.target.value) || 1)) })}
                    />
                  </label>
                ) : null}
              </div>
            ))}
          </div>
          {!visiveis.length ? <Vazio titulo="Nenhum produto encontrado.">Cadastre seus produtos e defina o preço de venda para gerar etiquetas.</Vazio> : null}
          <p className="small muted">Até 100 resultados por busca e {MAXIMO_DE_ETIQUETAS} etiquetas por arquivo. A quantidade de cópias não altera seu estoque.</p>
        </section>

        <div className="label-settings">
          <section className="panel">
            <h2>Formato e personalização</h2>
            <div className="form-stack section-gap">
              <Selecao
                rotulo="Modelo da folha"
                valor={modelo.id}
                aoMudar={(v) => { setModeloId(v); setPosicaoInicial('0'); setDeslocamentoX('0'); setDeslocamentoY('0') }}
                opcoes={modelos.map((m) => ({ valor: m.id, rotulo: m.nome }))}
              />
              <CampoDeTexto rotulo="Nome da loja na etiqueta" value={nomeDaLoja} maxLength={60} onChange={(e) => setNomeDaLoja(e.target.value)} />
              <div className="field">
                <label htmlFor="logo-da-etiqueta"><ImagePlus size={15} /> Logotipo — opcional, PNG ou JPG</label>
                <input id="logo-da-etiqueta" type="file" accept="image/png,image/jpeg" onChange={(e) => void enviarLogo(e.target.files?.[0])} />
                {logoId ? <Botao variante="fantasma" onClick={() => setLogoId(null)}>Remover logo</Botao> : null}
              </div>
              <details>
                <summary>Ajustar alinhamento e aproveitar folha</summary>
                <div className="form-grid section-gap">
                  <CampoNumero rotulo="Deslocamento horizontal" prefixo="mm" negativo valor={deslocamentoX} aoMudar={setDeslocamentoX} />
                  <CampoNumero rotulo="Deslocamento vertical" prefixo="mm" negativo valor={deslocamentoY} aoMudar={setDeslocamentoY} />
                </div>
                <CampoNumero
                  rotulo="Etiquetas já usadas no início da folha"
                  prefixo="#"
                  valor={posicaoInicial}
                  aoMudar={setPosicaoInicial}
                  dica={`De 0 a ${layout.colunas * layout.linhas - 1}. A contagem segue da esquerda para a direita, linha por linha.`}
                />
              </details>
              {estado.podeEscrever ? (
                <details>
                  <summary>Biblioteca de modelos</summary>
                  <p className="small muted">Cadastre as medidas de outro papel ou importe uma configuração JSON. Artes em PDF não são modelos editáveis.</p>
                  <div className="actions">
                    <Botao variante="secundario" onClick={() => { setRascunho({ ...layout }); setNomeDoRascunho('Meu modelo A4'); setEditando(true) }}>Criar modelo</Botao>
                    <Botao variante="fantasma" onClick={() => baixar(new Blob([JSON.stringify({ nome: modelo.nome, layout }, null, 2)], { type: 'application/json' }), 'LucroCerto-modelo-etiqueta.json')}>
                      <FileJson size={16} />Baixar modelo JSON
                    </Botao>
                  </div>
                  <div className="field">
                    <label htmlFor="modelo-em-json"><Upload size={15} /> Importar modelo JSON</label>
                    <input id="modelo-em-json" type="file" accept=".json,application/json" onChange={(e) => void importarModelo(e.target.files?.[0])} />
                  </div>
                </details>
              ) : null}
            </div>
          </section>

          <section className="panel label-preview-panel">
            <div className="between"><h3>Prévia da etiqueta</h3><Selo>{layout.largura} × {layout.altura} mm</Selo></div>
            {primeiro ? (
              <div className="label-preview" style={{ aspectRatio: `${layout.largura} / ${layout.altura}` }}>
                {layout.mostrarLoja ? (
                  <div className="label-preview-brand">
                    {logoId ? <img src={enderecos.imagem(logoId)} alt="" /> : null}
                    <span>{primeiro.exemplo ? 'EXEMPLO · ' : ''}{nomeDaLoja}</span>
                  </div>
                ) : null}
                <strong>{primeiro.nome}</strong>
                <b>{brl(primeiro.premissas.preco)}</b>
                <small>{layout.mostrarUnidade ? `por ${primeiro.unidade}` : ''}{layout.mostrarCodigo && primeiro.sku ? ` · Cód. ${primeiro.sku}` : ''}</small>
              </div>
            ) : (
              <div className="label-preview-empty"><Printer size={28} /><p>Selecione um produto para ver a prévia.</p></div>
            )}
            <p className="small muted">Prévia de conteúdo. O PDF respeita as medidas do modelo e abrevia nomes que não cabem.</p>
            <div className="between section-gap"><span>{itens.length} produto(s) · <strong>{total} etiqueta(s)</strong></span></div>
            <Botao className="full-width" ocupado={ocupado} disabled={!total || total > MAXIMO_DE_ETIQUETAS} onClick={() => void gerar()}>
              <Download size={17} />Gerar PDF de etiquetas
            </Botao>
            <p className="small muted">Imprima em 100%, tamanho real. Confira o alinhamento em papel comum antes de usar a folha adesiva.</p>
          </section>
        </div>
      </div>

      {geradas.length ? (
        <section className="panel section-gap">
          <h2>Arquivos gerados</h2>
          <p className="small muted">A segunda via mantém o preço e os dados da geração original.</p>
          <div className="label-jobs">
            {geradas.map((g) => (
              <div key={g.id}>
                <span>{data(g.criadoEm)} · {g.quantidade} etiquetas</span>
                <a className="btn ghost" href={enderecos.segundaVia(g.id)}><Download size={15} />Baixar novamente</a>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Janela aberta={editando} aoFechar={() => { if (!ocupado) setEditando(false) }} titulo="Cadastrar modelo de etiquetas" descricao="As medidas são em milímetros. O papel precisa corresponder às dimensões cadastradas.">
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
