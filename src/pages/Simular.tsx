/**
 * Simulações e Comparar canais — o `scenarios.tsx` do mock, com a mesma
 * marcação.
 *
 * Simular não grava nada: a conta é do motor, aqui na tela. O catálogo só muda
 * por "Aplicar ao produto", que o servidor recalcula e registra no histórico.
 *
 * Cenários e Descontos eram duas telas e viraram UMA, Simulações (22/10/2026,
 * pedido do Pedro): eram o mesmo simulador com o topo trocado, e a lista de
 * cenários salvos já era uma só. Ela abre pela LISTA, como as outras telas;
 * "Editar" e "Nova simulação" abrem o simulador, e no topo dele a pessoa
 * escolhe o que testar — mudar preço e custos, ou uma promoção (que traz os
 * dois limites de desconto). "Salvar alterações" grava no mesmo cenário.
 */

import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Pencil, Plus, Save, Store } from 'lucide-react'
import { PREMISSAS_PADRAO, calcular, precoComDesconto, type Premissas } from '@shared/preco'
import { lucroApi, type Canal, type Cenario } from '@/lib/api'
import { agir, usePainel } from '@/lib/painel'
import { Aviso, Botao, CampoDeTexto, CampoNumero, Combo, Janela, Selecao, Selo, Vazio, brl, data, pct } from '@/components/ui'
import { PainelDoResultado, usarCalculo } from '@/precos/Resultado'
import { LogoDoCanal } from '@/components/LogoDoCanal'

type Promocao = 'desconto' | 'cupom' | 'frete' | 'kit' | 'progressivo'

/** As taxas do perfil do canal sobre as premissas de um produto. */
const comCanal = (x: Premissas, c: Canal): Premissas => ({
  ...x, comissao: c.dados.comissao, tarifaFixa: c.dados.tarifaFixa, cobrancas: c.dados.cobrancas, fonte: `${c.nome} · ${c.dados.fonte} · ${c.dados.data}`,
})

const dataDoCanal = (d: string) => data(`${d}T12:00:00Z`)

/** O que a simulação testa: mexer no preço e nos custos, ou aplicar uma promoção sobre o preço de hoje. */
type TipoDeSimulacao = 'preco' | 'promocao'

export default function Simular() {
  /* o atalho da Visão geral ("Encontre seu limite") chega pedindo a simulação já aberta, em promoção */
  const pedido = (useLocation().state as { abrir?: TipoDeSimulacao } | null)?.abrir
  const estado = usePainel((s) => s.estado)!
  const ativos = estado.produtos.filter((p) => p.status === 'ativo')
  const primeiro = ativos[0]
  const [id, setId] = useState(primeiro?.id ?? '')
  const [x, setX] = useState<Premissas>(primeiro?.premissas ?? { ...PREMISSAS_PADRAO })
  const [desconto, setDesconto] = useState('0')
  const [tipoDeDesconto, setTipoDeDesconto] = useState<'percentual' | 'valor'>('percentual')
  const [promocao, setPromocao] = useState<Promocao>('desconto')
  const [unidades, setUnidades] = useState('1')
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [aplicando, setAplicando] = useState<Cenario | null>(null)
  /* as duas telas começam na lista: `null` é a lista; aberto, o cenário em edição (ou nenhum, se for nova simulação) */
  const [aberto, setAberto] = useState<{ cenario: Cenario | null } | null>(pedido ? { cenario: null } : null)
  const [tipo, setTipo] = useState<TipoDeSimulacao>(pedido ?? 'preco')

  const produto = estado.produtos.find((p) => p.id === id)
  const base = produto?.calculo?.atual ?? produto?.calculo?.resultado
  let simulado: Premissas = { ...x }
  let erroDoDesconto = ''
  try {
    if (tipo === 'promocao') {
      const preco = Number(x.preco) > 0 ? x.preco : calcular(x).sugerido
      simulado = { ...x, preco: promocao === 'frete' ? preco : precoComDesconto(preco, tipoDeDesconto, desconto, promocao === 'kit' ? unidades : '1') }
    }
  } catch (e) {
    erroDoDesconto = e instanceof Error ? e.message : 'Desconto inválido.'
  }
  const { calculo, erro } = usarCalculo(simulado)
  const resultado = calculo?.atual ?? calculo?.resultado
  const escolher = (v: string) => {
    setId(v)
    const p = estado.produtos.find((a) => a.id === v)
    if (p) { setX(p.premissas); setDesconto('0') }
  }
  const mudar = <K extends keyof Premissas>(chave: K, valor: Premissas[K]) => setX({ ...x, [chave]: valor })

  /* carregar um cenário no simulador: o produto dele e as premissas que ele guardou */
  /* o cenário salvo não guarda o tipo: ele abre em "preço e custos", com o preço que foi salvo */
  const abrir = (c: Cenario | null, tipoNovo: TipoDeSimulacao = 'preco') => {
    setTipo(c ? 'preco' : tipoNovo)
    if (c) { setId(c.produtoId ?? id); setX(c.premissas) }
    else if (primeiro) { setId(primeiro.id); setX(primeiro.premissas) }
    setDesconto('0')
    setNome(c?.nome ?? '')
    setAberto({ cenario: c })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const emEdicao = aberto?.cenario ?? null

  async function gravar(comoNovo: boolean) {
    const corpo = { nome, produtoId: id || null, premissas: simulado }
    const r = emEdicao && !comoNovo
      ? await agir(() => lucroApi.editarCenario(emEdicao.id, corpo), 'Cenário atualizado. O preço do produto foi preservado.')
      : await agir(() => lucroApi.salvarCenario(corpo), 'Cenário salvo. O preço do produto foi preservado.')
    if (!r) return
    setSalvando(false)
    setNome('')
    /* salvar devolve à lista, onde o cenário aparece */
    setAberto(null)
  }

  if (!estado.produtos.length) {
    return <section className="panel"><Vazio titulo="Comece com um produto salvo.">Os cenários preservam o preço original e permitem comparar cada mudança.</Vazio></section>
  }

  return (
    <>
      {aberto ? (
      <>
      <div className="between scenario-back">
        <button type="button" className="imp-link imp-back" onClick={() => setAberto(null)}><ArrowLeft size={16} />Voltar aos cenários</button>
        {emEdicao ? <Selo tom="roxo">Editando: {emEdicao.nome}</Selo> : <Selo>Nova simulação</Selo>}
      </div>
      <div className="scenario-head">
        <Combo rotulo="Produto para simular" valor={id} aoMudar={escolher} opcoes={ativos.map((p) => ({ valor: p.id, rotulo: p.nome }))} />
        <div className="scenario-original">
          <span>Preço que você cobra hoje</span>
          <strong>{produto && Number(produto.premissas.preco) > 0 ? brl(produto.premissas.preco) : 'Não definido'}</strong>
        </div>
      </div>
      <div className="calculator-grid">
        <section className="panel">
          <div className="between">
            <h2>{tipo === 'promocao' ? 'Até onde o desconto vai?' : 'E se você mudasse o preço?'}</h2>
            <Selo tom="roxo">Simulação</Selo>
          </div>
          <p className="muted">Simule à vontade. O preço do catálogo só muda com sua confirmação.</p>
          <div className="segmented simulation-kind" role="group" aria-label="O que simular">
            <button className={tipo === 'preco' ? 'active' : ''} aria-pressed={tipo === 'preco'} onClick={() => { setTipo('preco'); setDesconto('0') }}>Mudar preço e custos</button>
            <button className={tipo === 'promocao' ? 'active' : ''} aria-pressed={tipo === 'promocao'} onClick={() => { setTipo('promocao'); setDesconto('0') }}>Simular promoção</button>
          </div>
          <div className="form-stack">
            {tipo === 'promocao' ? (
              <>
                <Selecao
                  rotulo="Tipo de promoção"
                  valor={promocao}
                  aoMudar={setPromocao}
                  opcoes={[
                    { valor: 'desconto', rotulo: 'Desconto no produto' },
                    { valor: 'cupom', rotulo: 'Cupom pago por mim' },
                    { valor: 'frete', rotulo: 'Frete grátis para o cliente' },
                    { valor: 'kit', rotulo: 'Promoção de kit' },
                    { valor: 'progressivo', rotulo: 'Desconto progressivo — simular uma faixa' },
                  ]}
                />
                {promocao !== 'frete' ? (
                  <>
                    <div className="segmented">
                      <button className={tipoDeDesconto === 'percentual' ? 'active' : ''} onClick={() => setTipoDeDesconto('percentual')}>Percentual %</button>
                      <button className={tipoDeDesconto === 'valor' ? 'active' : ''} onClick={() => setTipoDeDesconto('valor')}>Valor R$</button>
                    </div>
                    <CampoNumero
                      rotulo={promocao === 'kit' ? 'Desconto sobre o kit' : 'Desconto sobre o preço'}
                      prefixo={tipoDeDesconto === 'percentual' ? '%' : 'R$'}
                      valor={desconto}
                      aoMudar={setDesconto}
                    />
                  </>
                ) : null}
                {promocao === 'kit' || promocao === 'progressivo' ? <CampoNumero rotulo="Unidades nesta oferta" prefixo="un." valor={unidades} aoMudar={setUnidades} /> : null}
                <CampoNumero rotulo="Frete que você pagará por unidade" valor={x.frete} aoMudar={(v) => mudar('frete', v)} />
                {promocao === 'progressivo' ? <Aviso>Simule cada faixa de quantidade separadamente para conferir a margem da promoção.</Aviso> : null}
              </>
            ) : (
              <div className="form-grid">
                <CampoNumero rotulo="Preço de venda simulado" valor={x.preco} aoMudar={(v) => mudar('preco', v)} />
                <CampoNumero rotulo="Custo de aquisição / lote" valor={x.custo} aoMudar={(v) => mudar('custo', v)} />
                <CampoNumero rotulo="Embalagem por unidade" valor={x.embalagem} aoMudar={(v) => mudar('embalagem', v)} />
                <CampoNumero rotulo="Frete por unidade" valor={x.frete} aoMudar={(v) => mudar('frete', v)} />
              </div>
            )}
            <div className="form-grid">
              <CampoNumero rotulo="Comissão nesta simulação" prefixo="%" valor={x.comissao} aoMudar={(v) => mudar('comissao', v)} />
              <CampoNumero rotulo="Margem mínima desejada" prefixo="%" valor={x.meta} aoMudar={(v) => mudar('meta', v)} />
            </div>
            <Combo
              rotulo="Trocar perfil do canal"
              valor=""
              aoMudar={(v) => { const c = estado.canais.find((a) => a.id === v); if (c) setX(comCanal(x, c)) }}
              marcador="Manter configuração do produto"
              opcoes={estado.canais.map((c) => ({ valor: c.id, rotulo: c.nome }))}
            />
            {erroDoDesconto ? <Aviso tipo="erro">{erroDoDesconto}</Aviso> : null}
            <div className="comparison-cards">
              <div><span>Atual, por unidade</span><strong>{brl(base?.lucro)}</strong><small>{pct(base?.margem)} de margem</small></div>
              <ArrowRight size={22} />
              <div className={Number(resultado?.lucro) < 0 ? 'loss' : ''}>
                <span>Simulado, por unidade</span><strong>{brl(resultado?.lucro)}</strong><small>{pct(resultado?.margem)} de margem</small>
              </div>
            </div>
            {resultado && base ? (
              <Aviso tipo={Number(resultado.lucro) >= Number(base.lucro) ? 'ok' : 'atencao'}>
                Diferença de lucro: {brl(Number(resultado.lucro) - Number(base.lucro))} por unidade.{' '}
                {tipo === 'promocao' ? 'O efeito no resultado total depende do volume de vendas, que não foi projetado.' : ''}
              </Aviso>
            ) : null}
            {estado.podeEscrever ? (
              <Botao disabled={!calculo || !!erroDoDesconto} onClick={() => setSalvando(true)}><Save size={16} />{emEdicao ? 'Salvar alterações' : 'Salvar cenário'}</Botao>
            ) : null}
          </div>
        </section>
        <div>
          <PainelDoResultado calculo={calculo} erro={erro} mostrarAtual />
          {tipo === 'promocao' && produto?.calculo && Number(produto.premissas.preco) <= 0 ? (
            <div className="panel discount-limits">
              <h3>Dois limites diferentes</h3>
              <p className="small muted">Os limites partem do preço que você cobra hoje, e este produto ainda não tem um. Defina-o no Precificar, passo “Sua meta”.</p>
            </div>
          ) : tipo === 'promocao' && produto?.calculo ? (
            <div className="panel discount-limits">
              <h3>Dois limites diferentes</h3>
              <div>
                <span>Para preservar a meta original</span>
                <strong>{produto.calculo.descontoMaximo ? brl(produto.calculo.descontoMaximo.valor) : 'Preço atual já abaixo da meta'}</strong>
              </div>
              <div>
                <span>Para cobrir os custos originais</span>
                <strong>{produto.calculo.descontoAteEquilibrio ? brl(produto.calculo.descontoAteEquilibrio.valor) : 'Preço atual já abaixo do equilíbrio'}</strong>
              </div>
              <p className="small muted">Limites sobre o preço original e suas premissas. Mudanças de frete, taxas ou custos exigem conferir o resultado simulado ao lado.</p>
            </div>
          ) : null}
        </div>
      </div>
      </>
      ) : (
      <section className="panel">
        <div className="between">
          <div><h2>Cenários salvos</h2><span className="muted small">Histórico de decisões, sem alterar o catálogo</span></div>
          {estado.podeEscrever ? <Botao onClick={() => abrir(null)}><Plus size={16} />Nova simulação</Botao> : null}
        </div>
        {estado.cenarios.length ? (
          <div className="scenario-list">
            {estado.cenarios.map((c) => (
              <div key={c.id}>
                <div>
                  <strong>{c.nome}</strong>
                  <small>{data(c.criadoEm)} · {estado.produtos.find((p) => p.id === c.produtoId)?.nome ?? 'Simulação independente'}</small>
                </div>
                <div><b>{brl((c.resultado.atual ?? c.resultado.resultado).lucro)}</b><small>lucro estimado / un.</small></div>
                <div className="actions">
                  <Botao variante="fantasma" onClick={() => abrir(c)}><Pencil size={15} />{estado.podeEscrever ? 'Editar' : 'Abrir'}</Botao>
                  {estado.podeEscrever && c.produtoId ? <Botao variante="secundario" onClick={() => setAplicando(c)}>Aplicar ao produto</Botao> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Vazio
            titulo="Sua próxima decisão pode ficar registrada."
            acao={estado.podeEscrever ? <Botao onClick={() => abrir(null)}><Plus size={16} />Nova simulação</Botao> : undefined}
          >
            Simule uma mudança de preço, de custo ou uma promoção, e salve o cenário para voltar a ele depois.
          </Vazio>
        )}
      </section>
      )}

      <Janela aberta={salvando} aoFechar={() => setSalvando(false)} titulo={emEdicao ? 'Salvar o cenário' : 'Dê um nome ao cenário'}>
        <div className="form-stack">
          <CampoDeTexto rotulo="Nome do cenário" placeholder="Ex.: Promoção de novembro" value={nome} maxLength={100} onChange={(e) => setNome(e.target.value)} />
          <div className="dialog-actions">
            {emEdicao ? <Botao variante="fantasma" disabled={!nome.trim()} onClick={() => void gravar(true)}>Salvar como novo</Botao> : null}
            <Botao disabled={!nome.trim()} onClick={() => void gravar(false)}>{emEdicao ? 'Salvar alterações' : 'Salvar cenário'}</Botao>
          </div>
        </div>
      </Janela>
      <Janela
        aberta={!!aplicando}
        aoFechar={() => setAplicando(null)}
        titulo="Aplicar cenário ao catálogo?"
        descricao="Esta ação substitui as premissas e o preço praticado do produto pelos valores do cenário. A alteração fica no histórico."
      >
        <p>{aplicando?.nome}</p>
        <div className="dialog-actions">
          <Botao variante="fantasma" onClick={() => setAplicando(null)}>Cancelar</Botao>
          <Botao onClick={async () => { if (aplicando && (await agir(() => lucroApi.aplicarCenario(aplicando.id), 'Cenário aplicado ao produto.'))) setAplicando(null) }}>
            Confirmar aplicação
          </Botao>
        </div>
      </Janela>
    </>
  )
}

/**
 * Comparar canais — PLANO-USABILIDADE-LUCRO.md, U5. A pergunta de quem vende
 * é "com o MEU preço, onde sobra mais?", e por isso o modo padrão é o preço
 * que a pessoa cobra hoje. Os cartões vêm do canal que mais deixa dinheiro
 * para o que menos deixa (no modo "mesma margem", do menor preço para o
 * maior), o primeiro ganha o selo, e prejuízo aparece em vermelho. Com preços
 * independentes a ordem fica parada: reordenar enquanto a pessoa digita faria
 * o campo fugir do cursor.
 */
export function CompararCanais() {
  const estado = usePainel((s) => s.estado)!
  const primeiro = estado.produtos.find((p) => p.status === 'ativo')
  const [id, setId] = useState(primeiro?.id ?? '')
  const temPreco = (p?: { premissas: Premissas }) => Number(p?.premissas.preco ?? 0) > 0
  const [modo, setModo] = useState<'meu-preco' | 'mesma-margem' | 'mesmo-preco' | 'independentes'>(temPreco(primeiro) ? 'meu-preco' : 'mesma-margem')
  /* enquanto a pessoa não escolher o modo, ele segue o produto: com preço, "pelo preço que você cobra" */
  const [modoEscolhido, setModoEscolhido] = useState(false)
  const [preco, setPreco] = useState(primeiro?.premissas.preco ?? '0')
  const [precos, setPrecos] = useState<Record<string, string>>({})
  const produto = estado.produtos.find((p) => p.id === id)

  if (!produto || estado.canais.length === 0) {
    return (
      <section className="panel">
        <Vazio icone={<Store size={28} />} titulo="Um produto, mais possibilidades.">
          Cadastre um produto e pelo menos um perfil de canal em Custos e canais. As taxas precisam ser informadas por você.
        </Vazio>
      </section>
    )
  }

  const precoDo = (c: Canal) =>
    modo === 'meu-preco' ? produto.premissas.preco : modo === 'mesmo-preco' ? preco : modo === 'independentes' ? (precos[c.id] ?? produto.premissas.preco) : '0'
  const linhas = estado.canais.map((c) => {
    const { calculo, erro } = usarCalculo({ ...comCanal(produto.premissas, c), preco: precoDo(c) })
    return { c, calculo, erro, v: calculo?.atual ?? calculo?.resultado ?? null }
  })
  const porPreco = modo === 'mesma-margem'
  const valor = (l: (typeof linhas)[number]) => (porPreco ? -Number(l.calculo?.sugerido ?? Infinity) : Number(l.v?.lucro ?? -Infinity))
  const ordenadas = modo === 'independentes' ? linhas : [...linhas].sort((a, b) => valor(b) - valor(a))
  const validas = ordenadas.filter((l) => l.v)
  const melhor = modo === 'independentes' ? null : validas[0] ?? null
  const pior = validas.length > 1 ? validas[validas.length - 1]! : null
  /* canais com as mesmas taxas dão o mesmo número: aí não há melhor nem pior a apontar */
  const diferem = !!melhor && !!pior && valor(melhor) !== valor(pior)
  /* empate no topo: todos os empatados levam o selo, e o resumo diz quantos */
  const ehMelhor = (l: (typeof linhas)[number]) => diferem && !!melhor && valor(l) === valor(melhor)
  const empatados = validas.filter(ehMelhor).length
  const eOutros = empatados > 1 ? ` (empatado com mais ${empatados - 1})` : ''

  return (
    <>
      <div className="compare-controls">
        <Combo
          rotulo="Produto"
          valor={id}
          aoMudar={(v) => {
            const p = estado.produtos.find((x) => x.id === v)
            setId(v)
            setPreco(p?.premissas.preco ?? '0')
            /* produto sem preço não tem "meu preço" para comparar */
            if (!temPreco(p) && modo === 'meu-preco') setModo('mesma-margem')
            else if (temPreco(p) && !modoEscolhido) setModo('meu-preco')
          }}
          opcoes={estado.produtos.map((p) => ({ valor: p.id, rotulo: p.nome }))}
        />
        <Selecao
          rotulo="Como comparar"
          valor={modo}
          aoMudar={(v) => { setModo(v); setModoEscolhido(true) }}
          opcoes={[
            ...(temPreco(produto) ? [{ valor: 'meu-preco' as const, rotulo: `Pelo preço que você cobra (${brl(produto.premissas.preco)})` }] : []),
            { valor: 'mesma-margem', rotulo: 'Preço para bater a meta em cada canal' },
            { valor: 'mesmo-preco', rotulo: 'Outro preço, igual em todos os canais' },
            { valor: 'independentes', rotulo: 'Um preço diferente em cada canal' },
          ]}
        />
        {modo === 'mesmo-preco' ? <CampoNumero rotulo="Preço para todos os canais" valor={preco} aoMudar={setPreco} /> : null}
      </div>
      {diferem && melhor?.v && pior?.v ? (
        <Aviso tipo={Number(pior.v.lucro) < 0 ? 'atencao' : 'ok'}>
          {porPreco
            ? <>Para bater a meta, <strong>{melhor.c.nome}</strong>{eOutros} pede o menor preço ({brl(melhor.calculo?.sugerido)}), e <strong>{pior.c.nome}</strong> o maior ({brl(pior.calculo?.sugerido)}).</>
            : <>Com este preço, <strong>{melhor.c.nome}</strong>{eOutros} é onde mais sobra ({brl(melhor.v.lucro)} por venda), e <strong>{pior.c.nome}</strong> onde menos sobra ({brl(pior.v.lucro)}).</>}
        </Aviso>
      ) : null}
      <div className="channel-comparisons">
        {ordenadas.map((linha) => {
          const { c, calculo, erro, v } = linha
          const melhorAqui = ehMelhor(linha)
          const prejuizo = v ? Number(v.lucro) < 0 : false
          return (
            <section className={`panel channel-compare-card${melhorAqui ? ' best' : ''}${prejuizo ? ' loss' : ''}`} key={c.id}>
              <div className="between">
                <LogoDoCanal tipo={c.tipo} />
                {melhorAqui
                  ? <Selo tom="verde">{porPreco ? 'Menor preço para a meta' : 'Sobra mais aqui'}</Selo>
                  : <Selo tom={c.dados.conferido ? 'neutro' : 'ambar'}>{c.dados.conferido ? 'Taxas conferidas' : 'Taxas não conferidas'}</Selo>}
              </div>
              <h2>{c.nome}</h2>
              <p className="small muted">{c.dados.fonte} · {dataDoCanal(c.dados.data)}</p>
              {modo === 'independentes' ? (
                <CampoNumero rotulo="Preço neste canal" valor={precos[c.id] ?? produto.premissas.preco} aoMudar={(p) => setPrecos({ ...precos, [c.id]: p })} />
              ) : null}
              <span className="muted small">{porPreco ? 'Preço para bater a meta' : 'Sobra por venda'}</span>
              <div className={`channel-price${!porPreco && prejuizo ? ' negative' : ''}`}>{porPreco ? brl(calculo?.sugerido) : brl(v?.lucro)}</div>
              {erro || !v ? (
                <Aviso tipo="erro">{erro}</Aviso>
              ) : (
                <>
                  <dl className="review-list">
                    <div><dt>{porPreco ? 'Sobra por venda' : 'Preço de venda'}</dt><dd className={porPreco ? 'positive' : ''}>{porPreco ? brl(v.lucro) : brl(v.preco)}</dd></div>
                    <div><dt>Taxas do canal</dt><dd>{brl(v.taxas)}</dd></div>
                    <div><dt>Margem</dt><dd>{pct(v.margem)} · meta {pct(produto.premissas.meta)}</dd></div>
                  </dl>
                  {prejuizo ? <Aviso tipo="erro">Neste canal você perde {brl(Math.abs(Number(v.lucro)))} a cada venda. Para não ter prejuízo, cobre pelo menos {brl(calculo?.equilibrio)}.</Aviso>
                    : !v.atingeMeta ? <Aviso tipo="atencao">Abaixo da meta. Para bater a meta aqui, cobre {brl(calculo?.minimo)}.</Aviso> : null}
                </>
              )}
            </section>
          )
        })}
      </div>
      <Aviso>Comparação simulada. Taxas variam por categoria, logística e contrato. Não há sincronização automática com os marketplaces.</Aviso>
    </>
  )
}
