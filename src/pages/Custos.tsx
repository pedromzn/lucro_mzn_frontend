/**
 * Custos e canais — o `costs.tsx` do mock, com a mesma marcação: os perfis de
 * canal (comissão, tarifa, cobranças, fonte e data) e a biblioteca de custos.
 *
 * A consulta ao Mercado Livre do mock saiu (PLANO-LUCRO-CERTO.md, D4): as taxas
 * são sempre informadas pela pessoa, com fonte e data, e marcadas quando ela
 * não as conferiu.
 *
 * Salvar um perfil cria uma nova versão; os produtos que já o usavam guardam
 * as taxas da época, e quem quiser a nova aplica pelo lote.
 */

import { useState } from 'react'
import { Package, Plus, Save, Settings2, Store, Trash2 } from 'lucide-react'
import type { CustoExtra, Premissas } from '@shared/preco'
import { CATEGORIAS_DE_CUSTO, TIPOS_DE_CANAL } from '@shared/contratos'
import { lucroApi, type Canal, type ModeloDeCusto, type TipoDeModelo } from '@/lib/api'
import { agir, usePainel } from '@/lib/painel'
import { Aviso, Botao, CampoDeTexto, CampoNumero, Janela, Selecao, Selo, Vazio, brl, data, pct } from '@/components/ui'
import { EditorDeCobrancas } from '@/precos/EditorDeCobrancas'

type CanalEmEdicao = Omit<Canal, 'id' | 'revisao' | 'atualizadoEm'> & { id?: string; revisao?: number }
type ModeloEmEdicao = { id?: string; nome: string; tipo: TipoDeModelo; dados: Record<string, unknown> }
type DadosDeCusto = Omit<CustoExtra, 'id' | 'nome'>

const NOMES_DOS_CANAIS: Record<(typeof TIPOS_DE_CANAL)[number], string> = {
  shopee: 'Shopee',
  mercadolivre: 'Mercado Livre',
  loja_propria: 'Loja própria',
  loja_fisica: 'Loja física',
  redes_sociais: 'Instagram / WhatsApp',
  outro: 'Meu canal',
}

/* a data de hoje no fuso do negócio, no formato do campo de data */
const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
const canalNovo = (): CanalEmEdicao => ({
  nome: 'Shopee',
  tipo: 'shopee',
  dados: { comissao: '0', tarifaFixa: '0', cobrancas: [], fonte: 'Informado pelo usuário', data: hoje(), conferido: false, notas: '' },
})
const dataDoCanal = (d: string) => data(`${d}T12:00:00Z`)

export default function Custos() {
  const estado = usePainel((s) => s.estado)!
  const [aba, setAba] = useState<'canais' | 'modelos'>('canais')
  const [canal, setCanal] = useState<CanalEmEdicao | null>(null)
  const [modelo, setModelo] = useState<ModeloEmEdicao | null>(null)
  const [gravando, setGravando] = useState(false)
  const escreve = estado.podeEscrever
  const mudarDados = <K extends keyof CanalEmEdicao['dados']>(chave: K, valor: CanalEmEdicao['dados'][K]) =>
    setCanal((c) => (c ? { ...c, dados: { ...c.dados, [chave]: valor } } : c))
  const custo = (m: ModeloEmEdicao | ModeloDeCusto) => m.dados as unknown as DadosDeCusto
  const mudarCusto = (parte: Partial<DadosDeCusto>) => setModelo((m) => (m ? { ...m, dados: { ...m.dados, ...parte } } : m))

  async function gravar(acao: () => Promise<unknown>, sucesso: string, fechar: () => void) {
    setGravando(true)
    try {
      /* `null` é falha; remover devolve `undefined`, e isso é sucesso */
      if ((await agir(acao, sucesso)) !== null) fechar()
    } finally {
      setGravando(false)
    }
  }

  return (
    <>
      <div className="subnav">
        <button className={aba === 'canais' ? 'active' : ''} onClick={() => setAba('canais')}>Canais e taxas</button>
        <button className={aba === 'modelos' ? 'active' : ''} onClick={() => setAba('modelos')}>Biblioteca de custos</button>
      </div>

      {aba === 'canais' ? (
        <>
          <div className="between section-gap">
            <p className="muted">Uma configuração, vários produtos. Taxas sempre identificadas.</p>
            {escreve ? <Botao onClick={() => setCanal(canalNovo())}><Plus size={16} />Novo canal</Botao> : null}
          </div>
          {estado.canais.length ? (
            <div className="channel-grid">
              {estado.canais.map((c) => (
                <section className="panel channel-card" key={c.id}>
                  <div className="between">
                    <div className="channel-logo">{c.nome.slice(0, 2).toUpperCase()}</div>
                    <Selo tom={c.dados.conferido ? 'verde' : 'ambar'}>{c.dados.conferido ? 'Conferido por você' : 'Requer conferência'}</Selo>
                  </div>
                  <h2>{c.nome}</h2>
                  <div className="channel-fee"><strong>{pct(c.dados.comissao)}</strong><span> + {brl(c.dados.tarifaFixa)} por unidade</span></div>
                  <p className="muted small">{c.dados.fonte}<br />Atualizado em {dataDoCanal(c.dados.data)} · Versão {c.revisao}</p>
                  {c.dados.cobrancas.length > 0 ? <Selo>{c.dados.cobrancas.length} cobrança(s) adicional(is)</Selo> : null}
                  {escreve ? (
                    <div className="section-gap">
                      <Botao variante="secundario" onClick={() => setCanal({ id: c.id, revisao: c.revisao, nome: c.nome, tipo: c.tipo, dados: c.dados })}>
                        <Settings2 size={16} />Revisar taxas
                      </Botao>
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
          ) : (
            <section className="panel">
              <Vazio
                icone={<Store size={30} />}
                titulo="Como você vende?"
                acao={escreve ? <Botao onClick={() => setCanal(canalNovo())}>Cadastrar primeiro canal</Botao> : undefined}
              >
                Cadastre as taxas da sua loja ou marketplace. Nenhuma alíquota universal é preenchida como se fosse oficial.
              </Vazio>
            </section>
          )}
        </>
      ) : (
        <>
          <div className="between section-gap">
            <p className="muted">Reutilize embalagens, custos por venda e despesas mensais.</p>
            {escreve ? (
              <Botao onClick={() => setModelo({ nome: '', tipo: 'embalagem', dados: { valor: '0', frequencia: 'unidade', divisor: '1', categoria: 'Embalagem' } })}>
                <Plus size={16} />Novo modelo
              </Botao>
            ) : null}
          </div>
          {estado.modelosDeCusto.length ? (
            <div className="template-grid">
              {estado.modelosDeCusto.map((m) => (
                <section className="panel" key={m.id}>
                  <div className="between">
                    <Package size={22} />
                    <Selo>{m.tipo === 'embalagem' ? 'Embalagem' : m.tipo === 'perfil' ? 'Perfil' : 'Custo'}</Selo>
                  </div>
                  <h3>{m.nome}</h3>
                  <p className="template-amount">{m.tipo === 'perfil' ? `${pct((m.dados as unknown as Premissas).meta)} de margem-alvo` : brl(custo(m).valor)}</p>
                  <p className="small muted">
                    {m.tipo === 'perfil'
                      ? 'Conjunto de premissas reutilizável'
                      : custo(m).frequencia === 'mensal'
                        ? `Mensal, rateado em ${custo(m).divisor} unidades previstas`
                        : custo(m).frequencia === 'lote'
                          ? `Por lote de ${custo(m).divisor} unidades`
                          : 'Por unidade vendida'}
                  </p>
                  {escreve ? <Botao variante="secundario" onClick={() => setModelo({ id: m.id, nome: m.nome, tipo: m.tipo, dados: m.dados })}>Editar modelo</Botao> : null}
                </section>
              ))}
            </div>
          ) : (
            <section className="panel">
              <Vazio titulo="O mesmo custo, digitado uma vez.">
                Crie modelos de caixa, envelope, etiqueta, mão de obra ou despesa mensal para reutilizar ao precificar.
              </Vazio>
            </section>
          )}
          {escreve ? (
            <div className="panel section-gap">
              <h3>Salvar um perfil completo</h3>
              <p className="muted">Use as premissas de um produto como ponto de partida para os próximos.</p>
              <Selecao
                rotulo="Produto de referência"
                valor=""
                aoMudar={(v) => {
                  const p = estado.produtos.find((a) => a.id === v)
                  if (p) setModelo({ nome: `Perfil — ${p.nome}`, tipo: 'perfil', dados: p.premissas as unknown as Record<string, unknown> })
                }}
                opcoes={[{ valor: '', rotulo: 'Escolher produto salvo' }, ...estado.produtos.map((p) => ({ valor: p.id, rotulo: p.nome }))]}
              />
            </div>
          ) : null}
        </>
      )}

      <Janela
        aberta={!!canal}
        aoFechar={() => setCanal(null)}
        titulo={canal?.id ? 'Revisar perfil de taxas' : 'Novo canal de venda'}
        descricao="Informe os valores aplicáveis à sua operação. Alterações criam uma nova versão do perfil."
        larga
      >
        {canal ? (
          <div className="form-stack">
            <div className="form-grid">
              <Selecao
                rotulo="Canal"
                valor={canal.tipo}
                aoMudar={(tipo) => setCanal({ ...canal, tipo, nome: NOMES_DOS_CANAIS[tipo] })}
                opcoes={TIPOS_DE_CANAL.map((t) => ({ valor: t, rotulo: t === 'outro' ? 'Canal personalizado' : NOMES_DOS_CANAIS[t] }))}
              />
              <CampoDeTexto rotulo="Nome do perfil" value={canal.nome} maxLength={80} onChange={(e) => setCanal({ ...canal, nome: e.target.value })} />
              <CampoNumero rotulo="Comissão sobre preço de venda" prefixo="%" valor={canal.dados.comissao} aoMudar={(v) => mudarDados('comissao', v)} />
              <CampoNumero rotulo="Tarifa fixa por unidade" valor={canal.dados.tarifaFixa} aoMudar={(v) => mudarDados('tarifaFixa', v)} />
              <CampoDeTexto rotulo="Fonte das taxas" value={canal.dados.fonte} maxLength={300} onChange={(e) => mudarDados('fonte', e.target.value)} />
              <CampoDeTexto rotulo="Data da conferência" type="date" value={canal.dados.data} onChange={(e) => mudarDados('data', e.target.value)} />
            </div>
            <label className="check">
              <input type="checkbox" checked={canal.dados.conferido} onChange={(e) => mudarDados('conferido', e.target.checked)} />
              Conferi estes valores no contrato ou painel do canal.
            </label>
            <CampoDeTexto rotulo="Condições aplicáveis (opcional)" value={canal.dados.notas} maxLength={1000} onChange={(e) => mudarDados('notas', e.target.value)} />
            <details open={canal.dados.cobrancas.length > 0}>
              <summary>Cobranças adicionais, por faixa ou progressivas</summary>
              <div className="section-gap"><EditorDeCobrancas cobrancas={canal.dados.cobrancas} aoMudar={(v) => mudarDados('cobrancas', v)} /></div>
            </details>
            <Aviso>Os produtos existentes mantêm suas premissas históricas. Use a precificação em lote para aplicar a nova versão a eles.</Aviso>
            <div className="dialog-actions">
              <Botao
                ocupado={gravando}
                onClick={() =>
                  void gravar(
                    () => (canal.id ? lucroApi.salvarCanal({ ...canal, id: canal.id, revisao: canal.revisao! }) : lucroApi.criarCanal(canal)),
                    'Perfil salvo com nova versão.',
                    () => setCanal(null),
                  )
                }
              >
                <Save size={16} />Salvar perfil
              </Botao>
            </div>
          </div>
        ) : null}
      </Janela>

      <Janela aberta={!!modelo} aoFechar={() => setModelo(null)} titulo="Modelo reutilizável">
        {modelo ? (
          <div className="form-stack">
            <CampoDeTexto rotulo="Nome do modelo" value={modelo.nome} maxLength={100} onChange={(e) => setModelo({ ...modelo, nome: e.target.value })} />
            {modelo.tipo !== 'perfil' ? (
              <>
                <Selecao
                  rotulo="Tipo"
                  valor={modelo.tipo}
                  aoMudar={(tipo) => setModelo({ ...modelo, tipo })}
                  opcoes={[{ valor: 'embalagem', rotulo: 'Embalagem' }, { valor: 'custo', rotulo: 'Custo ou despesa' }]}
                />
                <CampoNumero rotulo="Valor" valor={custo(modelo).valor} aoMudar={(valor) => mudarCusto({ valor })} />
                <Selecao
                  rotulo="Frequência"
                  valor={custo(modelo).frequencia}
                  aoMudar={(frequencia) => mudarCusto({ frequencia })}
                  opcoes={[{ valor: 'unidade', rotulo: 'Por venda / unidade' }, { valor: 'lote', rotulo: 'Por lote' }, { valor: 'mensal', rotulo: 'Mensal' }]}
                />
                {custo(modelo).frequencia !== 'unidade' ? (
                  <CampoNumero rotulo="Quantidade para rateio" prefixo="un." valor={custo(modelo).divisor ?? '1'} aoMudar={(divisor) => mudarCusto({ divisor })} />
                ) : null}
                <Selecao rotulo="Categoria de custo" valor={custo(modelo).categoria} aoMudar={(categoria) => mudarCusto({ categoria })} opcoes={CATEGORIAS_DE_CUSTO} />
              </>
            ) : (
              <Aviso>
                Este perfil reúne embalagem, despesas, taxas, tributos e margem do produto escolhido. Ao reutilizar, custo de aquisição e preço
                praticado do novo produto serão preservados.
              </Aviso>
            )}
            <Botao
              ocupado={gravando}
              onClick={() =>
                void gravar(
                  () => (modelo.id ? lucroApi.salvarModelo({ ...modelo, id: modelo.id }) : lucroApi.criarModelo(modelo)),
                  'Modelo salvo na sua biblioteca.',
                  () => setModelo(null),
                )
              }
            >
              Salvar modelo
            </Botao>
            {modelo.id ? (
              <Botao variante="fantasma" ocupado={gravando} onClick={() => void gravar(() => lucroApi.apagarModelo(modelo.id!), 'Modelo removido da biblioteca.', () => setModelo(null))}>
                <Trash2 size={16} />Remover da biblioteca
              </Botao>
            ) : null}
          </div>
        ) : null}
      </Janela>
    </>
  )
}
