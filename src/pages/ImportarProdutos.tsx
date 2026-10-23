/**
 * Importar produtos — a página de importação do Marketing Flow
 * (`mzn_mkt/frontend/src/pages/ImportarContatos.tsx`) trazida para o catálogo,
 * com a mesma lógica e os mesmos limites (22/10/2026, pedido do Pedro).
 *
 * Três passos, e o do meio é o que importa: **conferir o mapeamento antes de
 * deixar entrar**. Importação de um botão só é a que enche o catálogo de preço
 * errado que ninguém consegue desfazer depois.
 *
 * O arquivo é lido no navegador e vai no corpo da requisição — CSV como texto,
 * XLSX em base64, porque JSON não carrega bytes crus. Nada é gravado até o
 * terceiro passo: analisar é só olhar. Veste o kit do Lucro (`ui.tsx`) e as
 * classes `imp-` de `lucro.css`, não as do painel do MKT (AGENTS.md do app, §6).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Download, FileSpreadsheet, LoaderCircle, Package, RefreshCw, X } from 'lucide-react'
import { enderecos, lucroApi } from '@/lib/api'
import { usePainel } from '@/lib/painel'
import { toast } from '@/lib/avisos'
import { BaixarArquivo } from '@/components/ArquivosDoEspaco'
import { Aviso, Botao, Vazio, erroDe } from '@/components/ui'
import {
  CONFLITOS, EXTENSOES_ACEITAS, LIMITE_DE_LINHAS, LIMITE_DO_CONTEUDO, ROTULO_CONFLITO,
  ehPlanilha, ehXlsAntigo, verificarVinculos,
  type Analise, type Conflito, type ResumoDaImportacao, type Vinculo,
} from '@shared/importacao'

type Passo = 'arquivo' | 'mapear' | 'andamento'
const PASSOS = [['arquivo', '1', 'Arquivo'], ['mapear', '2', 'Conferir as colunas'], ['andamento', '3', 'Importar']] as const
const ordem = (p: Passo) => PASSOS.findIndex(([chave]) => chave === p)
const numero = (n: number) => n.toLocaleString('pt-BR')

/**
 * O binário da planilha em base64.
 *
 * Em pedaços porque `String.fromCharCode(...bytes)` estoura a pilha de
 * argumentos num arquivo grande — e "estoura" aqui é a aba travar, não um erro
 * legível. 32 KB por vez é bem abaixo do limite de qualquer navegador.
 */
async function comoBase64(arquivo: File): Promise<string> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  const pedaco = 0x8000
  let texto = ''
  for (let i = 0; i < bytes.length; i += pedaco) texto += String.fromCharCode(...bytes.subarray(i, i + pedaco))
  return btoa(texto)
}

export default function ImportarProdutos() {
  const navegar = useNavigate()
  const escreve = usePainel((s) => s.estado?.podeEscrever ?? false)
  const [passo, setPasso] = useState<Passo>('arquivo')
  const [lendo, setLendo] = useState(false)
  const [conteudo, setConteudo] = useState('')
  const [analise, setAnalise] = useState<Analise | null>(null)
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [conflito, setConflito] = useState<Conflito>('atualizar')
  const [enviando, setEnviando] = useState(false)
  const [importacao, setImportacao] = useState<ResumoDaImportacao | null>(null)
  const entrada = useRef<HTMLInputElement>(null)

  /* ── passo 1 ───────────────────────────────────────────────────────────── */

  const receber = async (arquivo: File) => {
    /* o .xls morre aqui, antes da viagem: o servidor daria a mesma resposta, mas depois de subir o arquivo inteiro */
    if (ehXlsAntigo(arquivo.name)) {
      toast.error('O formato .xls é o do Excel 2003. Abra a planilha e salve como .xlsx, ou exporte em CSV.')
      return
    }
    setLendo(true)
    try {
      const texto = ehPlanilha(arquivo.name) ? await comoBase64(arquivo) : await arquivo.text()
      /* medir aqui e não pelo `arquivo.size`: o base64 infla o binário em um terço */
      if (texto.length > LIMITE_DO_CONTEUDO) {
        toast.error(`O arquivo passou de ${Math.round(LIMITE_DO_CONTEUDO / 1024 / 1024)} MB. Quebre em partes menores e importe uma de cada vez.`)
        return
      }
      const resultado = await lucroApi.analisarImportacao(arquivo.name, texto)
      setConteudo(texto)
      setAnalise(resultado)
      setVinculos(resultado.vinculos)
      setPasso('mapear')
    } catch (erro) {
      toast.error(erroDe(erro, 'Não consegui ler o arquivo.'))
    } finally {
      setLendo(false)
    }
  }

  /* ── passo 3 ───────────────────────────────────────────────────────────── */

  const comecar = async () => {
    if (!analise) return
    setEnviando(true)
    try {
      setImportacao(await lucroApi.importar({ arquivo: analise.arquivo, conteudo, vinculos, conflito }))
      setPasso('andamento')
    } catch (erro) {
      toast.error(erroDe(erro, 'Não deu para começar.'))
    } finally {
      setEnviando(false)
    }
  }

  /* acompanha enquanto o laço roda no servidor */
  const acompanhar = useCallback(async (id: string) => {
    try {
      const atual = await lucroApi.acompanharImportacao(id)
      setImportacao(atual)
      /* terminou: o catálogo da memória do painel fica velho — relê para Produtos já abrir certo */
      if (atual.estado !== 'processando') void usePainel.getState().recarregar()
      return atual.estado === 'processando'
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    if (passo !== 'andamento' || !importacao || importacao.estado !== 'processando') return
    const id = window.setInterval(async () => {
      if (!(await acompanhar(importacao.id))) window.clearInterval(id)
    }, 900)
    return () => window.clearInterval(id)
  }, [passo, importacao, acompanhar])

  const problemas = verificarVinculos(vinculos)
  const ligadas = vinculos.filter((v) => v.campo).length

  if (!escreve) {
    return (
      <section className="panel">
        <Vazio titulo="Importar é para quem edita o catálogo." icone={<FileSpreadsheet size={27} />} acao={<Botao variante="secundario" onClick={() => navegar('/produtos')}>Voltar para produtos</Botao>}>
          Seu acesso neste espaço é de leitura. Peça a um administrador para mudar o seu papel no Lucro Certo.
        </Vazio>
      </section>
    )
  }

  return (
    <div className="imp-page">
      <section className="panel imp-head">
        <div className="imp-head-row">
          {/* o título da página é o da casca (`TITULOS['/produtos/importar']`): aqui, só o caminho de volta */}
          <button type="button" className="imp-link imp-back" onClick={() => navegar('/produtos')}><ArrowLeft size={16} />Voltar para produtos</button>
          <BaixarArquivo className="btn ghost" caminho={enderecos.modeloDeImportacao('xlsx')}><Download size={16} />Baixar modelo (.xlsx)</BaixarArquivo>
        </div>
        <ol className="imp-steps">
          {PASSOS.map(([chave, n, rotulo]) => {
            const ativo = passo === chave
            const passado = ordem(passo) > ordem(chave)
            return (
              <li key={chave} className={ativo ? 'active' : passado ? 'done' : ''} aria-current={ativo ? 'step' : undefined}>
                <span className="lbl-step-number">{passado ? <Check size={14} /> : n}</span>
                {rotulo}
              </li>
            )
          })}
        </ol>
      </section>

      {/* ── 1. arquivo ──────────────────────────────────────────────── */}
      {passo === 'arquivo' ? (
        <section className="panel">
          <div
            className="imp-drop"
            role="button"
            tabIndex={0}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const arquivo = e.dataTransfer.files[0]
              if (arquivo && !lendo) void receber(arquivo)
            }}
            onClick={() => !lendo && entrada.current?.click()}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !lendo) { e.preventDefault(); entrada.current?.click() } }}
          >
            <span className="imp-drop-icon">{lendo ? <LoaderCircle className="spin" size={24} /> : <FileSpreadsheet size={24} />}</span>
            <strong>{lendo ? 'Lendo o arquivo…' : 'Arraste o arquivo aqui ou clique para escolher'}</strong>
            <p className="muted small">
              Excel (.xlsx) ou CSV — no CSV, vírgula, ponto e vírgula ou tabulação, reconhecido sozinho.
              Até {numero(LIMITE_DE_LINHAS)} linhas e {Math.round(LIMITE_DO_CONTEUDO / 1024 / 1024)} MB por arquivo.
            </p>
            <input
              ref={entrada}
              type="file"
              accept={EXTENSOES_ACEITAS}
              hidden
              onChange={(e) => {
                const arquivo = e.target.files?.[0]
                if (arquivo) void receber(arquivo)
                e.target.value = ''
              }}
            />
          </div>

          <div className="imp-cards">
            <div className="imp-card">
              <strong>Vindo de outra ferramenta?</strong>
              <p className="muted small">
                Exporte de lá em Excel ou CSV e mande aqui. Colunas como “Descrição”, “Código” ou “Preço de custo”
                — os nomes do Bling e do Tiny — são reconhecidas sozinhas, e você confere cada uma antes de importar.
              </p>
            </div>
            <div className="imp-card">
              <strong>Montando a planilha do zero?</strong>
              <p className="muted small">
                Baixe o modelo acima: ele já vem com as colunas certas e dois exemplos — um completo e outro só com o
                mínimo (nome e custo).{' '}
                <BaixarArquivo className="text-link" caminho={enderecos.modeloDeImportacao('csv')}>Prefere CSV?</BaixarArquivo>
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── 2. mapear ───────────────────────────────────────────────── */}
      {passo === 'mapear' && analise ? (
        <>
          <section className="panel">
            <div className="imp-file">
              <FileSpreadsheet size={17} />
              <strong>{analise.arquivo}</strong>
              <span className="badge neutral">{numero(analise.total)} linhas · {ligadas} de {vinculos.length} colunas ligadas</span>
              <button type="button" className="imp-link" onClick={() => { setPasso('arquivo'); setAnalise(null) }}><RefreshCw size={13} />Trocar arquivo</button>
            </div>

            {analise.avisos.map((a) => <Aviso key={a} tipo="atencao">{a}</Aviso>)}

            <div className="imp-table">
              <table>
                <thead>
                  <tr><th>Coluna do arquivo</th><th>Exemplo</th><th>Vai para o campo</th></tr>
                </thead>
                <tbody>
                  {vinculos.map((v, i) => {
                    const exemplo = analise.amostra.map((l) => l[v.coluna]).find((x) => x && x.trim())
                    return (
                      <tr key={v.coluna}>
                        <td><strong>{v.cabecalho || <span className="muted">(sem nome)</span>}</strong></td>
                        <td className="muted">{exemplo || '—'}</td>
                        <td>
                          <select
                            aria-label={`Campo da coluna ${v.cabecalho || v.coluna + 1}`}
                            className={v.campo ? '' : 'imp-unset'}
                            value={v.campo}
                            onChange={(e) => {
                              const copia = [...vinculos]
                              copia[i] = { ...v, campo: e.target.value }
                              setVinculos(copia)
                            }}
                          >
                            <option value="">Não importar</option>
                            <optgroup label="Dados do produto">
                              {analise.campos.filter((c) => c.grupo === 'produto').map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                            </optgroup>
                            <optgroup label="Custos e preço">
                              {analise.campos.filter((c) => c.grupo === 'preco').map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                            </optgroup>
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="imp-cards">
            <section className="panel">
              <strong className="imp-title">Quando o produto já existir</strong>
              <div className="imp-options" role="radiogroup" aria-label="Quando o produto já existir">
                {CONFLITOS.map((c) => (
                  <label key={c} className={conflito === c ? 'active' : ''}>
                    <input type="radio" name="conflito" checked={conflito === c} onChange={() => setConflito(c)} />
                    <span>
                      <strong>{ROTULO_CONFLITO[c]}</strong>
                      <small className="muted">
                        {c === 'atualizar'
                          ? 'Os campos da planilha sobrescrevem os atuais, e o preço é recalculado. Célula vazia não apaga o que já existe.'
                          : 'Nada muda em quem já está no catálogo. Só entram os novos.'}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
              <p className="muted small">
                O produto é reconhecido pelo SKU — e, na linha sem SKU, pelo nome, sem diferença de maiúscula ou acento.
                Vale também entre duas linhas do próprio arquivo.
              </p>
            </section>
            <section className="panel">
              <strong className="imp-title">O que a importação não faz</strong>
              <p className="muted small">
                Ela <strong>não mexe no estoque</strong>: “quantidade por lote” é conta de preço, não saldo. Registre o
                saldo inicial em Estoque e vendas.
              </p>
              <p className="muted small">
                Cada produto atualizado ganha uma revisão no histórico, como se tivesse sido salvo pela tela — dá para
                ver o antes e o depois em Produtos.
              </p>
            </section>
          </div>

          {problemas.length > 0 ? <Aviso tipo="erro">{problemas.map((p) => <div key={p}>{p}</div>)}</Aviso> : null}

          <div className="imp-actions">
            <Botao variante="fantasma" onClick={() => setPasso('arquivo')}>Voltar</Botao>
            <Botao ocupado={enviando} disabled={problemas.length > 0} onClick={() => void comecar()}>
              {enviando ? null : <ArrowRight size={16} />}Importar {numero(analise.total)} linhas
            </Botao>
          </div>
        </>
      ) : null}

      {/* ── 3. andamento ────────────────────────────────────────────── */}
      {passo === 'andamento' && importacao ? (
        <Andamento importacao={importacao} aoImportarOutro={() => { setPasso('arquivo'); setAnalise(null); setImportacao(null) }} />
      ) : null}
    </div>
  )
}

function Andamento({ importacao, aoImportarOutro }: { importacao: ResumoDaImportacao; aoImportarOutro(): void }) {
  const navegar = useNavigate()
  const rodando = importacao.estado === 'processando'
  const falhou = importacao.estado === 'falhou'
  const pct = importacao.total ? Math.round((importacao.processadas / importacao.total) * 100) : 0

  return (
    <>
      <section className="panel">
        <div className="imp-status">
          <span className={`imp-status-icon ${rodando ? '' : falhou ? 'bad' : 'good'}`}>
            {rodando ? <LoaderCircle className="spin" size={19} /> : falhou ? <X size={19} /> : <Check size={19} />}
          </span>
          <div>
            <strong>{rodando ? 'Importando…' : falhou ? 'A importação parou' : 'Importação concluída'}</strong>
            <p className="muted small">{importacao.arquivo} · {numero(importacao.processadas)} de {numero(importacao.total)} linhas</p>
          </div>
        </div>

        <div className="imp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className={falhou ? 'bad' : ''} style={{ width: `${pct}%` }} />
        </div>

        <div className="imp-counts">
          {([
            ['Criados', importacao.criados, 'positive'],
            ['Atualizados', importacao.atualizados, ''],
            ['Ignorados', importacao.ignorados, 'muted'],
            ['Recusados', importacao.recusados, importacao.recusados > 0 ? 'negative' : 'muted'],
          ] as const).map(([rotulo, valor, cor]) => (
            <div key={rotulo}>
              <strong className={cor}>{numero(valor)}</strong>
              <small className="muted">{rotulo}</small>
            </div>
          ))}
        </div>

        {importacao.erro ? <Aviso tipo="erro">{importacao.erro}</Aviso> : null}
      </section>

      {importacao.erros.length > 0 ? (
        <section className="panel">
          <div className="between">
            <strong className="imp-title"><AlertTriangle size={15} />Linhas que não entraram</strong>
            <BaixarArquivo className="btn ghost" caminho={enderecos.errosDaImportacao(importacao.id)}><Download size={15} />Baixar a lista</BaixarArquivo>
          </div>
          <div className="imp-errors">
            {importacao.erros.map((e) => (
              <div key={e.linha}><span className="muted">Linha {numero(e.linha)}</span><span>{e.motivo}</span></div>
            ))}
          </div>
          <p className="muted small">
            O número é o da linha no arquivo, contando o cabeçalho — o mesmo que aparece no Excel. Corrija e mande só
            essas de volta.{importacao.recusados > importacao.erros.length ? ` A lista mostra as primeiras ${numero(importacao.erros.length)} de ${numero(importacao.recusados)}.` : ''}
          </p>
        </section>
      ) : null}

      {!rodando ? (
        <div className="imp-actions">
          <Botao variante="fantasma" onClick={aoImportarOutro}>Importar outro arquivo</Botao>
          <Botao onClick={() => navegar('/produtos')}><Package size={16} />Ver os produtos</Botao>
        </div>
      ) : null}
    </>
  )
}
