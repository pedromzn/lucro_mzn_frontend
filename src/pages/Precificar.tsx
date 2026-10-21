/**
 * Precificar — o assistente de cinco passos do mock (`calculator.tsx`), com a
 * mesma marcação.
 *
 * O cartão ao lado recalcula a cada tecla com o motor do `@shared/preco`, o
 * mesmo que o servidor roda ao gravar. Salvar manda as PREMISSAS, nunca o
 * preço calculado: o servidor recalcula, grava a revisão no histórico e
 * devolve o produto como ficou.
 *
 * `/precificar` cadastra; `/precificar/:id` edita, e volta para a tela de onde
 * a pessoa veio (o catálogo, a visão geral, os relatórios).
 */

import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Package, Plus, Save, SlidersHorizontal, Trash2 } from 'lucide-react'
import { PREMISSAS_PADRAO, type CustoExtra, type Premissas } from '@shared/preco'
import { CATEGORIAS, CATEGORIAS_DE_CUSTO, UNIDADES } from '@shared/contratos'
import { lucroApi, type Produto, type ProdutoParaGravar } from '@/lib/api'
import { agir, usePainel } from '@/lib/painel'
import { toast } from '@/lib/avisos'
import { Aviso, Botao, Combo, CampoDeTexto, CampoNumero, Selecao, brl, erroDe, novaChave, pct } from '@/components/ui'
import { PainelDoResultado, usarCalculo } from '@/precos/Resultado'
import { EditorDeCobrancas } from '@/precos/EditorDeCobrancas'

type Rascunho = ProdutoParaGravar & { id?: string; revisao?: number }

const PASSOS = ['Produto', 'Custos', 'Canal', 'Sua meta', 'Revisão']
const TITULOS = ['O que você vai vender?', 'Quanto custa para você?', 'Onde será a venda?', 'O que você quer que sobre?', 'Tudo pronto para decidir.']
const SUBTITULOS = [
  'Comece com o essencial. Você pode completar os detalhes depois.',
  'Inclua os custos que existem na sua operação.',
  'Use as taxas do seu contrato ou painel de vendedor.',
  'A margem é a parte do preço que sobra após os custos informados.',
  'Confira as premissas e salve o produto no seu catálogo.',
]
const LIMITE_DA_IMAGEM = 1_000_000

const paraGravar = (p: Produto): Rascunho => ({
  id: p.id, revisao: p.revisao, nome: p.nome, sku: p.sku, categoria: p.categoria, unidade: p.unidade, status: p.status,
  favorito: p.favorito, canalId: p.canalId, imagemId: p.imagemId, tags: p.tags, notas: p.notas, premissas: p.premissas,
})

export default function Precificar() {
  const { id } = useParams()
  const estado = usePainel((s) => s.estado)!
  const existente = id ? estado.produtos.find((p) => p.id === id) : undefined
  /* a chave remonta o assistente ao trocar de produto, ou ao "salvar e cadastrar outro" */
  const [vez, setVez] = useState(0)
  if (id && !existente) return <Aviso tipo="erro">Este produto não está no espaço de trabalho atual.</Aviso>
  return <Assistente key={`${id ?? 'novo'}-${vez}`} existente={existente} aoRecomecar={() => setVez((v) => v + 1)} />
}

function Assistente({ existente, aoRecomecar }: { existente?: Produto; aoRecomecar: () => void }) {
  const estado = usePainel((s) => s.estado)!
  const navegar = useNavigate()
  const voltar = (useLocation().state as { voltar?: string } | null)?.voltar ?? '/produtos'
  const [passo, setPasso] = useState(0)
  const [p, setP] = useState<Rascunho>(() =>
    existente
      ? paraGravar(existente)
      : {
          nome: '', sku: null, categoria: estado.preferencias.categoria || 'Outros', unidade: 'unidade', status: 'ativo', favorito: false,
          canalId: null, imagemId: null, tags: [], notas: '', premissas: { ...PREMISSAS_PADRAO },
        },
  )
  const [gravando, setGravando] = useState(false)
  const [categoriasNovas, setCategoriasNovas] = useState<string[]>([])
  const [tipoDeCusto, setTipoDeCusto] = useState(CATEGORIAS_DE_CUSTO[0])

  const x = p.premissas
  const { calculo, erro } = usarCalculo(x)
  const mudar = <K extends keyof Rascunho>(chave: K, valor: Rascunho[K]) => setP((a) => ({ ...a, [chave]: valor }))
  const premissa = <K extends keyof Premissas>(chave: K, valor: Premissas[K]) => setP((a) => ({ ...a, premissas: { ...a.premissas, [chave]: valor } }))
  const canal = estado.canais.find((c) => c.id === p.canalId)
  const modelos = (tipo: string) => estado.modelosDeCusto.filter((m) => m.tipo === tipo)
  const somenteLeitura = !estado.podeEscrever

  const escolherCanal = (canalId: string) => {
    const c = estado.canais.find((a) => a.id === canalId)
    setP((a) => ({
      ...a,
      canalId: canalId || null,
      premissas: {
        ...a.premissas,
        ...(c
          ? { comissao: c.dados.comissao, tarifaFixa: c.dados.tarifaFixa, cobrancas: c.dados.cobrancas, fonte: `${c.nome} · ${c.dados.fonte} · ${c.dados.data}` }
          : { comissao: '0', tarifaFixa: '0', cobrancas: [], fonte: 'Manual' }),
      },
    }))
  }
  const mudarCusto = (i: number, parte: Partial<CustoExtra>) => premissa('custos', x.custos.map((c, j) => (i === j ? { ...c, ...parte } : c)))

  async function salvar(outro = false) {
    if (!p.nome.trim()) {
      setPasso(0)
      toast('Informe o nome do produto.')
      return
    }
    if (!calculo) return
    setGravando(true)
    try {
      const corpo = { ...p, sku: p.sku || null }
      const salvo = await agir(
        () => (p.id ? lucroApi.salvarProduto({ ...corpo, id: p.id, revisao: p.revisao! }) : lucroApi.criarProduto(corpo)),
        outro ? 'Produto salvo. Cadastre o próximo produto.' : 'Produto salvo no seu catálogo.',
      )
      if (!salvo) return
      if (outro) aoRecomecar()
      else navegar(voltar, { state: { destaque: salvo.id } })
    } finally {
      setGravando(false)
    }
  }

  async function enviarImagem(arquivo: File | undefined) {
    if (!arquivo) return
    if (arquivo.size > LIMITE_DA_IMAGEM) {
      toast('Escolha uma imagem de até 1 MB.')
      return
    }
    try {
      const r = await lucroApi.enviarImagem(arquivo)
      mudar('imagemId', r.id)
      toast('Imagem adicionada. Salve o produto para concluir.')
    } catch (e) {
      toast(erroDe(e))
    }
  }

  return (
    <div className="calculator-grid">
      <div>
        <div className="stepper" aria-label="Etapas da precificação">
          {PASSOS.map((s, i) => (
            <button key={s} className={passo === i ? 'current' : passo > i ? 'complete' : ''} onClick={() => setPasso(i)} aria-current={passo === i ? 'step' : undefined}>
              <span>{passo > i ? <Check size={13} /> : i + 1}</span><b>{s}</b>
            </button>
          ))}
        </div>
        <section className="panel calculator-form">
          <div className="section-kicker">PASSO {passo + 1} DE 5</div>
          <h2>{TITULOS[passo]}</h2>
          <p className="muted">{SUBTITULOS[passo]}</p>

          {passo === 0 ? (
            <div className="form-stack">
              <CampoDeTexto rotulo="Nome do produto" placeholder="Ex.: Garrafa térmica 500 ml" value={p.nome} maxLength={120} onChange={(e) => mudar('nome', e.target.value)} />
              <div className="form-grid">
                <Combo
                  rotulo="Categoria"
                  valor={p.categoria}
                  aoMudar={(v) => mudar('categoria', v)}
                  opcoes={[...new Set([...CATEGORIAS, ...categoriasNovas, p.categoria])].map((c) => ({ valor: c, rotulo: c }))}
                  aoCriar={(v) => { setCategoriasNovas([...categoriasNovas, v]); mudar('categoria', v) }}
                />
                <Selecao rotulo="Vendido por" valor={p.unidade} aoMudar={(v) => mudar('unidade', v)} opcoes={UNIDADES} />
              </div>
              <details>
                <summary>Imagem, SKU e outros detalhes</summary>
                <div className="form-grid section-gap">
                  <CampoDeTexto rotulo="Código do produto — opcional" value={p.sku ?? ''} maxLength={60} onChange={(e) => mudar('sku', e.target.value)} />
                  <CampoDeTexto
                    rotulo="Tags (separadas por vírgula)"
                    value={p.tags.join(',')}
                    onChange={(e) => mudar('tags', e.target.value.split(',').map((s) => s.trim()).slice(0, 12))}
                  />
                  <CampoDeTexto rotulo="Observações (opcional)" value={p.notas} maxLength={1500} onChange={(e) => mudar('notas', e.target.value)} />
                  <div className="field">
                    <label htmlFor="imagem-do-produto">Imagem (PNG, JPG ou WebP, até 1 MB)</label>
                    <input id="imagem-do-produto" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void enviarImagem(e.target.files?.[0])} />
                  </div>
                </div>
              </details>
            </div>
          ) : null}

          {passo === 1 ? (
            <div className="form-stack">
              <div className="form-grid">
                <CampoNumero rotulo="Custo de compra ou fabricação" valor={x.custo} aoMudar={(v) => premissa('custo', v)} />
                <CampoNumero
                  rotulo="Quantidade incluída nesse custo"
                  prefixo={p.unidade}
                  valor={x.quantidade}
                  aoMudar={(v) => premissa('quantidade', v)}
                  dica={`Informe a quantidade em ${p.unidade}. Ex.: custo total de R$ 100 por 5 ${p.unidade}. Este campo não altera o estoque.`}
                />
              </div>
              <div className="form-grid">
                <CampoNumero rotulo={`Embalagem por ${p.unidade}`} valor={x.embalagem} aoMudar={(v) => premissa('embalagem', v)} />
                <Selecao
                  rotulo="Reutilizar embalagem"
                  valor=""
                  aoMudar={(v) => { const m = estado.modelosDeCusto.find((a) => a.id === v); if (m) premissa('embalagem', String(m.dados.valor)) }}
                  opcoes={[{ valor: '', rotulo: 'Escolher modelo salvo' }, ...modelos('embalagem').map((m) => ({ valor: m.id, rotulo: m.nome }))]}
                />
              </div>
              <CampoNumero rotulo={`Frete pago por você, por ${p.unidade}`} valor={x.frete} aoMudar={(v) => premissa('frete', v)} />
              <details open={x.custos.length > 0}>
                <summary><SlidersHorizontal size={16} /> Outros custos e despesas mensais</summary>
                <div className="form-stack section-gap">
                  {x.custos.map((c, i) => (
                    <div className="cost-editor" key={c.id}>
                      <div className="between">
                        <strong>{c.nome}</strong>
                        <button className="icon-button" aria-label={`Remover ${c.nome}`} onClick={() => premissa('custos', x.custos.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
                      </div>
                      <div className="form-grid">
                        <CampoNumero rotulo="Valor" valor={c.valor} aoMudar={(v) => mudarCusto(i, { valor: v })} />
                        <Selecao
                          rotulo="Frequência"
                          valor={c.frequencia}
                          aoMudar={(v) => mudarCusto(i, { frequencia: v, divisor: c.divisor || '1' })}
                          opcoes={[
                            { valor: 'unidade', rotulo: 'Por unidade vendida' },
                            { valor: 'lote', rotulo: 'Por lote produzido' },
                            { valor: 'mensal', rotulo: 'Mensal — ratear pela previsão' },
                          ]}
                        />
                        {c.frequencia !== 'unidade' ? (
                          <CampoNumero
                            rotulo={c.frequencia === 'mensal' ? 'Unidades previstas no mês' : 'Unidades no lote'}
                            prefixo="un."
                            valor={c.divisor ?? '1'}
                            aoMudar={(v) => mudarCusto(i, { divisor: v })}
                          />
                        ) : null}
                      </div>
                    </div>
                  ))}
                  <div className="inline-fields">
                    <Selecao rotulo="Tipo de custo" valor={tipoDeCusto} aoMudar={setTipoDeCusto} opcoes={CATEGORIAS_DE_CUSTO} />
                    <Botao
                      variante="secundario"
                      onClick={() => premissa('custos', [...x.custos, { id: novaChave(), nome: tipoDeCusto, categoria: tipoDeCusto, valor: '0', frequencia: 'unidade', divisor: '1' }])}
                    >
                      <Plus size={16} />Adicionar
                    </Botao>
                  </div>
                  <Selecao
                    rotulo="Adicionar custo salvo"
                    valor=""
                    aoMudar={(v) => {
                      const m = estado.modelosDeCusto.find((a) => a.id === v)
                      if (m) premissa('custos', [...x.custos, { id: novaChave(), nome: m.nome, ...(m.dados as Omit<CustoExtra, 'id' | 'nome'>) }])
                    }}
                    opcoes={[{ valor: '', rotulo: 'Escolher da biblioteca' }, ...modelos('custo').map((m) => ({ valor: m.id, rotulo: m.nome }))]}
                  />
                </div>
              </details>
            </div>
          ) : null}

          {passo === 2 ? (
            <div className="form-stack">
              <Combo
                rotulo="Canal de venda"
                valor={p.canalId ?? ''}
                aoMudar={escolherCanal}
                opcoes={[{ valor: '', rotulo: 'Configuração manual' }, ...estado.canais.map((c) => ({ valor: c.id, rotulo: c.nome }))]}
              />
              {canal ? (
                <Aviso>{canal.dados.fonte} · Atualizado em {canal.dados.data.split('-').reverse().join('/')}. {canal.dados.conferido ? 'Informado e confirmado por você.' : 'Taxas ainda não confirmadas.'}</Aviso>
              ) : (
                <Aviso>Sem perfil de canal. Informe as taxas abaixo ou <button className="text-link" onClick={() => navegar('/custos')}>cadastre um perfil reutilizável</button>.</Aviso>
              )}
              <div className="form-grid">
                <CampoNumero rotulo="Comissão do canal de venda" dica="Percentual cobrado pela plataforma sobre o preço da venda." prefixo="%" valor={x.comissao} aoMudar={(v) => premissa('comissao', v)} />
                <CampoNumero rotulo={`Tarifa fixa do canal por ${p.unidade}`} valor={x.tarifaFixa} aoMudar={(v) => premissa('tarifaFixa', v)} />
              </div>
              <fieldset>
                <legend>Método de pagamento (para esta simulação)</legend>
                <div className="radio-cards">
                  {(['Pix', 'Cartão', 'Boleto', 'Outro'] as const).map((m) => (
                    <label key={m}>
                      <input
                        type="radio"
                        name="formaDePagamento"
                        checked={(x.formaDePagamento ?? 'Pix') === m}
                        value={m}
                        onChange={() => { premissa('formaDePagamento', m); toast(`${m} selecionado. Informe abaixo a taxa do seu contrato, se houver.`) }}
                      />
                      <span>{m}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <details>
                <summary>Taxa de pagamento, comissão de vendedor e tributos</summary>
                <div className="form-stack section-gap">
                  <CampoNumero rotulo="Alíquota efetiva estimada de tributos" prefixo="%" valor={x.tributo} aoMudar={(v) => premissa('tributo', v)} />
                  <label className="check">
                    <input type="checkbox" checked={x.tributoConferido} onChange={(e) => premissa('tributoConferido', e.target.checked)} />
                    Conferi esta alíquota para a minha operação.
                  </label>
                  <Aviso>MEI: o DAS mensal pode ser cadastrado como despesa mensal com rateio. Não presumimos uma alíquota por venda.</Aviso>
                  <EditorDeCobrancas cobrancas={x.cobrancas} aoMudar={(v) => premissa('cobrancas', v)} />
                </div>
              </details>
            </div>
          ) : null}

          {passo === 3 ? (
            <div className="form-stack">
              <Selecao rotulo="O que significa esta margem" valor="liquida" aoMudar={() => undefined} opcoes={[{ valor: 'liquida', rotulo: 'Lucro sobre o preço de venda, após custos informados' }]} />
              <div className="margin-choices">
                {['15', '20', '25', '30', '40'].map((v) => (
                  <button key={v} className={x.meta === v ? 'active' : ''} onClick={() => premissa('meta', v)}>{v}%</button>
                ))}
              </div>
              <div className="form-grid">
                <CampoNumero
                  dica="Percentual do preço que você quer que sobre após os custos informados."
                  rotulo="Margem de lucro desejada"
                  valor={x.meta}
                  prefixo="%"
                  negativo
                  aoMudar={(v) => premissa('meta', v)}
                />
                <CampoNumero rotulo="Preço que você pratica hoje (opcional)" valor={x.preco} aoMudar={(v) => premissa('preco', v)} />
              </div>
              <Selecao
                rotulo="Ajuste do preço sugerido"
                valor={x.arredondamento}
                aoMudar={(v) => premissa('arredondamento', v)}
                opcoes={[
                  { valor: 'nenhum', rotulo: 'Sem ajuste comercial' },
                  { valor: '90', rotulo: 'Terminar em ,90' },
                  { valor: '99', rotulo: 'Terminar em ,99' },
                  { valor: 'inteiro', rotulo: 'Próximo número inteiro' },
                  { valor: 'multiplo', rotulo: 'Arredondar para um múltiplo' },
                ]}
              />
              {x.arredondamento === 'multiplo' ? <CampoNumero rotulo="Múltiplo" valor={x.multiplo} aoMudar={(v) => premissa('multiplo', v)} /> : null}
              <Selecao
                rotulo="Reutilizar perfil de precificação"
                valor=""
                aoMudar={(v) => {
                  const m = estado.modelosDeCusto.find((a) => a.id === v)
                  /* o perfil traz tudo, menos o que é deste produto: o custo de compra e o preço praticado */
                  if (m) mudar('premissas', { ...(m.dados as unknown as Premissas), custo: x.custo, quantidade: x.quantidade, preco: x.preco })
                }}
                opcoes={[{ valor: '', rotulo: 'Escolher um perfil salvo' }, ...modelos('perfil').map((m) => ({ valor: m.id, rotulo: m.nome }))]}
              />
            </div>
          ) : null}

          {passo === 4 ? (
            <div className="form-stack">
              <div className="review-product">
                <div className="product-icon"><Package size={24} /></div>
                <div><h3>{p.nome || 'Produto sem nome'}</h3><p>{p.categoria} · {p.unidade}</p></div>
              </div>
              <dl className="review-list">
                <div><dt>Custo informado</dt><dd>{brl(x.custo)} / {x.quantidade} {p.unidade}</dd></div>
                <div><dt>Canal</dt><dd>{canal?.nome ?? 'Configuração manual'}</dd></div>
                <div><dt>Margem de lucro desejada</dt><dd>{pct(x.meta)}</dd></div>
                <div><dt>Preço de venda sugerido</dt><dd>{brl(calculo?.sugerido)}</dd></div>
                <div><dt>Preço que você cobra</dt><dd>{Number(x.preco) > 0 ? brl(x.preco) : 'Ainda não definido'}</dd></div>
              </dl>
              {calculo ? <Botao variante="secundario" onClick={() => premissa('preco', calculo.sugerido)}><Check size={16} />Escolher este preço para vender</Botao> : null}
              {calculo?.avisos.map((w) => <Aviso key={w} tipo="atencao">{w}</Aviso>)}
              <Aviso>Salvar mantém os custos e as premissas deste cálculo no histórico. Nenhum preço é publicado em marketplaces.</Aviso>
            </div>
          ) : null}

          {erro ? <p className="form-error" role="alert">{erro}</p> : null}
          <div className="form-footer">
            <Botao variante="fantasma" disabled={passo === 0} onClick={() => setPasso(passo - 1)}><ArrowLeft size={16} />Voltar</Botao>
            {passo < 4 ? (
              <Botao onClick={() => setPasso(passo + 1)}>Continuar<ArrowRight size={16} /></Botao>
            ) : (
              <Botao ocupado={gravando} disabled={!calculo || somenteLeitura} onClick={() => void salvar(false)}>
                <Save size={16} />{p.id ? 'Salvar alterações' : 'Salvar produto'}
              </Botao>
            )}
            {passo === 4 && !p.id ? (
              <Botao variante="secundario" ocupado={gravando} disabled={!calculo || somenteLeitura} onClick={() => void salvar(true)}>Salvar e cadastrar outro</Botao>
            ) : null}
          </div>
          {somenteLeitura ? <Aviso>Seu acesso é de leitura: você pode simular, mas não salvar.</Aviso> : null}
        </section>
      </div>
      <PainelDoResultado unidade={p.unidade} calculo={calculo} erro={erro} />
    </div>
  )
}
