/**
 * As cobranças além da comissão — o `FeeEditor` do mock: taxa de pagamento,
 * comissão de vendedor, tarifa por faixa de preço (como a de marketplace) e
 * progressiva. Usado no Precificar e no perfil de canal.
 *
 * As regras são do motor (`@shared/preco`) e o formulário só monta o dado:
 * faixa com limite fora de ordem, ou sem a última "sem teto", é o motor quem
 * recusa, com a frase dele, no cartão do resultado.
 */

import { Plus, Trash2 } from 'lucide-react'
import type { Cobranca, Faixa } from '@shared/preco'
import { Botao, CampoDeTexto, CampoNumero, Selecao, novaChave } from '@/components/ui'

const FAIXAS_INICIAIS: Faixa[] = [{ ate: '100', taxa: '0', fixo: '0' }, { ate: null, taxa: '0', fixo: '0' }]

export function EditorDeCobrancas({ cobrancas, aoMudar }: { cobrancas: Cobranca[]; aoMudar: (v: Cobranca[]) => void }) {
  const mudar = (i: number, parte: Partial<Cobranca>) => aoMudar(cobrancas.map((c, j) => (i === j ? { ...c, ...parte } : c)))
  const mudarFaixa = (i: number, k: number, parte: Partial<Faixa>) =>
    mudar(i, { faixas: cobrancas[i].faixas!.map((f, y) => (y === k ? { ...f, ...parte } : f)) })
  return (
    <div className="form-stack">
      {cobrancas.map((c, i) => (
        <div className="cost-editor" key={c.id}>
          <div className="between">
            <strong>{c.nome}</strong>
            <button type="button" className="icon-button" onClick={() => aoMudar(cobrancas.filter((_, j) => j !== i))} aria-label="Remover taxa">
              <Trash2 size={16} />
            </button>
          </div>
          <div className="form-grid">
            <CampoDeTexto rotulo="Nome da cobrança" value={c.nome} maxLength={100} onChange={(e) => mudar(i, { nome: e.target.value })} />
            <Selecao
              rotulo="Tipo de cobrança"
              valor={c.tipo}
              aoMudar={(tipo) => mudar(i, { tipo, faixas: FAIXAS_INICIAIS })}
              opcoes={[
                { valor: 'percentual', rotulo: 'Percentual' },
                { valor: 'fixa', rotulo: 'Valor fixo' },
                { valor: 'faixa', rotulo: 'Por faixa de preço' },
                { valor: 'progressiva', rotulo: 'Progressiva por parcela' },
              ]}
            />
            {c.tipo === 'fixa' ? (
              <CampoNumero rotulo="Valor por venda" valor={c.valor ?? '0'} aoMudar={(valor) => mudar(i, { valor })} />
            ) : (
              <Selecao
                rotulo="Base de cálculo"
                valor={c.base ?? 'venda'}
                aoMudar={(base) => mudar(i, { base })}
                opcoes={[
                  { valor: 'venda', rotulo: 'Preço da venda' },
                  { valor: 'venda_frete', rotulo: 'Preço + frete informado' },
                  { valor: 'custo', rotulo: 'Custos monetários unitários' },
                ]}
              />
            )}
            {c.tipo === 'percentual' ? <CampoNumero rotulo="Percentual" prefixo="%" valor={c.taxa ?? '0'} aoMudar={(taxa) => mudar(i, { taxa })} /> : null}
          </div>
          {c.tipo === 'faixa' || c.tipo === 'progressiva' ? (
            <div className="form-stack section-gap">
              {c.faixas?.map((f, k) => (
                <div className="band-row" key={k}>
                  {f.ate !== null ? (
                    <CampoNumero rotulo="Limite exclusivo da faixa" valor={f.ate} aoMudar={(ate) => mudarFaixa(i, k, { ate })} />
                  ) : (
                    <span className="small muted">Acima do último limite</span>
                  )}
                  <CampoNumero rotulo="Percentual" prefixo="%" valor={f.taxa} aoMudar={(taxa) => mudarFaixa(i, k, { taxa })} />
                  {c.tipo === 'faixa' ? <CampoNumero rotulo="Tarifa fixa na faixa" valor={f.fixo ?? '0'} aoMudar={(fixo) => mudarFaixa(i, k, { fixo })} /> : null}
                </div>
              ))}
              <Botao
                variante="fantasma"
                onClick={() => {
                  const faixas = [...(c.faixas ?? [])]
                  const ultima = faixas.pop()!
                  const anterior = faixas.at(-1)?.ate ?? '0'
                  mudar(i, { faixas: [...faixas, { ate: String(Number(anterior) + 100), taxa: '0', fixo: '0' }, ultima] })
                }}
              >
                Adicionar faixa
              </Botao>
              <p className="small muted">Faixas começam no limite anterior e terminam antes do próximo. A última faixa não tem teto.</p>
            </div>
          ) : null}
        </div>
      ))}
      <Botao variante="secundario" onClick={() => aoMudar([...cobrancas, { id: novaChave(), nome: 'Taxa de pagamento', tipo: 'percentual', taxa: '0', base: 'venda', valor: '0' }])}>
        <Plus size={16} />Adicionar cobrança
      </Botao>
    </div>
  )
}
