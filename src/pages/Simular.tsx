/**
 * Cenários, Descontos e Comparar canais — o `scenarios.tsx` do mock, com a
 * mesma marcação.
 *
 * Simular não grava nada: a conta é do motor, aqui na tela. O catálogo só muda
 * por "Aplicar ao produto", que o servidor recalcula e registra no histórico.
 */

import { useState } from 'react'
import { ArrowRight, Copy, Save, Store } from 'lucide-react'
import { PREMISSAS_PADRAO, calcular, precoComDesconto, type Premissas } from '@shared/preco'
import { lucroApi, type Canal, type Cenario } from '@/lib/api'
import { agir, usePainel } from '@/lib/painel'
import { toast } from '@/lib/avisos'
import { Aviso, Botao, CampoDeTexto, CampoNumero, Combo, Janela, Selecao, Selo, Vazio, brl, data, pct } from '@/components/ui'
import { PainelDoResultado, usarCalculo } from '@/precos/Resultado'

type Promocao = 'desconto' | 'cupom' | 'frete' | 'kit' | 'progressivo'

/** As taxas do perfil do canal sobre as premissas de um produto. */
const comCanal = (x: Premissas, c: Canal): Premissas => ({
  ...x, comissao: c.dados.comissao, tarifaFixa: c.dados.tarifaFixa, cobrancas: c.dados.cobrancas, fonte: `${c.nome} · ${c.dados.fonte} · ${c.dados.data}`,
})

const dataDoCanal = (d: string) => data(`${d}T12:00:00Z`)

export default function Simular({ modo }: { modo: 'cenarios' | 'descontos' }) {
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

  const produto = estado.produtos.find((p) => p.id === id)
  const base = produto?.calculo?.atual ?? produto?.calculo?.resultado
  let simulado: Premissas = { ...x }
  let erroDoDesconto = ''
  try {
    if (modo === 'descontos') {
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

  if (!estado.produtos.length) {
    return <section className="panel"><Vazio titulo="Comece com um produto salvo.">Os cenários preservam o preço original e permitem comparar cada mudança.</Vazio></section>
  }

  return (
    <>
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
            <h2>{modo === 'descontos' ? 'Até onde o desconto vai?' : 'E se você mudasse o preço?'}</h2>
            <Selo tom="roxo">Simulação</Selo>
          </div>
          <p className="muted">Simule à vontade. O preço do catálogo só muda com sua confirmação.</p>
          <div className="form-stack">
            {modo === 'descontos' ? (
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
            <Selecao
              rotulo="Trocar perfil do canal"
              valor=""
              aoMudar={(v) => { const c = estado.canais.find((a) => a.id === v); if (c) setX(comCanal(x, c)) }}
              opcoes={[{ valor: '', rotulo: 'Manter configuração do produto' }, ...estado.canais.map((c) => ({ valor: c.id, rotulo: c.nome }))]}
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
                {modo === 'descontos' ? 'O efeito no resultado total depende do volume de vendas, que não foi projetado.' : ''}
              </Aviso>
            ) : null}
            {estado.podeEscrever ? (
              <Botao disabled={!calculo || !!erroDoDesconto} onClick={() => setSalvando(true)}><Save size={16} />Salvar cenário</Botao>
            ) : null}
          </div>
        </section>
        <div>
          <PainelDoResultado calculo={calculo} erro={erro} mostrarAtual />
          {modo === 'descontos' && produto?.calculo && Number(produto.premissas.preco) <= 0 ? (
            <div className="panel discount-limits">
              <h3>Dois limites diferentes</h3>
              <p className="small muted">Os limites partem do preço que você cobra hoje, e este produto ainda não tem um. Defina-o no Precificar, passo “Sua meta”.</p>
            </div>
          ) : modo === 'descontos' && produto?.calculo ? (
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

      <section className="panel section-gap">
        <div className="between"><h2>Cenários salvos</h2><span className="muted small">Histórico de decisões, sem alterar o catálogo</span></div>
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
                  <Botao variante="fantasma" onClick={() => { setId(c.produtoId ?? id); setX(c.premissas); setDesconto('0'); toast('Cenário carregado. Você pode ajustar e salvar uma cópia.') }}>
                    <Copy size={15} />Reutilizar
                  </Botao>
                  {estado.podeEscrever && c.produtoId ? <Botao variante="secundario" onClick={() => setAplicando(c)}>Aplicar ao produto</Botao> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Vazio titulo="Sua próxima decisão pode ficar registrada.">Salve um cenário para voltar a ele depois.</Vazio>
        )}
      </section>

      <Janela aberta={salvando} aoFechar={() => setSalvando(false)} titulo="Dê um nome ao cenário">
        <div className="form-stack">
          <CampoDeTexto rotulo="Nome do cenário" placeholder="Ex.: Promoção de novembro" value={nome} maxLength={100} onChange={(e) => setNome(e.target.value)} />
          <Botao
            disabled={!nome.trim()}
            onClick={async () => {
              const r = await agir(() => lucroApi.salvarCenario({ nome, produtoId: id || null, premissas: simulado }), 'Cenário salvo. O preço do produto foi preservado.')
              if (r) { setSalvando(false); setNome('') }
            }}
          >
            Salvar cenário
          </Botao>
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

export function CompararCanais() {
  const estado = usePainel((s) => s.estado)!
  const primeiro = estado.produtos.find((p) => p.status === 'ativo')
  const [id, setId] = useState(primeiro?.id ?? '')
  const [modo, setModo] = useState<'mesma-margem' | 'mesmo-preco' | 'independentes'>('mesma-margem')
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

  return (
    <>
      <div className="compare-controls">
        <Combo
          rotulo="Produto"
          valor={id}
          aoMudar={(v) => { setId(v); setPreco(estado.produtos.find((p) => p.id === v)?.premissas.preco ?? '0') }}
          opcoes={estado.produtos.map((p) => ({ valor: p.id, rotulo: p.nome }))}
        />
        <Selecao
          rotulo="Como comparar"
          valor={modo}
          aoMudar={setModo}
          opcoes={[
            { valor: 'mesma-margem', rotulo: 'Mesma margem-alvo' },
            { valor: 'mesmo-preco', rotulo: 'Mesmo preço em todos os canais' },
            { valor: 'independentes', rotulo: 'Preços independentes' },
          ]}
        />
        {modo === 'mesmo-preco' ? <CampoNumero rotulo="Preço para todos os canais" valor={preco} aoMudar={setPreco} /> : null}
      </div>
      <div className="channel-comparisons">
        {estado.canais.map((c) => {
          const precoAqui = modo === 'mesmo-preco' ? preco : modo === 'independentes' ? (precos[c.id] ?? produto.premissas.preco) : '0'
          const { calculo, erro } = usarCalculo({ ...comCanal(produto.premissas, c), preco: precoAqui })
          const v = calculo?.atual ?? calculo?.resultado
          return (
            <section className="panel channel-compare-card" key={c.id}>
              <div className="between">
                <div className="channel-logo">{c.nome.slice(0, 2).toUpperCase()}</div>
                <Selo tom={c.dados.conferido ? 'verde' : 'ambar'}>{c.dados.conferido ? 'Manual confirmado' : 'Não confirmado'}</Selo>
              </div>
              <h2>{c.nome}</h2>
              <p className="small muted">{c.dados.fonte} · {dataDoCanal(c.dados.data)}</p>
              {modo === 'independentes' ? (
                <CampoNumero rotulo="Preço neste canal" valor={precos[c.id] ?? produto.premissas.preco} aoMudar={(p) => setPrecos({ ...precos, [c.id]: p })} />
              ) : null}
              <span className="muted small">{modo === 'mesma-margem' ? 'Preço de venda sugerido' : 'Preço analisado'}</span>
              <div className="channel-price">{brl(modo === 'mesma-margem' ? calculo?.sugerido : v?.preco)}</div>
              {erro || !v ? (
                <Aviso tipo="erro">{erro}</Aviso>
              ) : (
                <>
                  <dl className="review-list">
                    <div><dt>Taxas proporcionais + fixas</dt><dd>{brl(v.taxas)}</dd></div>
                    <div><dt>Lucro estimado / un.</dt><dd className={Number(v.lucro) < 0 ? 'negative' : 'positive'}>{brl(v.lucro)}</dd></div>
                    <div><dt>Margem estimada</dt><dd>{pct(v.margem)}</dd></div>
                    <div><dt>Meta do produto</dt><dd>{pct(produto.premissas.meta)}</dd></div>
                  </dl>
                  {!v.atingeMeta ? <Aviso tipo="atencao">Abaixo da margem desejada.</Aviso> : null}
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
