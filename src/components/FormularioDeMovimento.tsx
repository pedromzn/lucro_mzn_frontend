/**
 * O formulário de movimentação de estoque — o da tela de Estoque, tirado de lá
 * para a lista e o espaço 3D (PLANO-ESTOQUE-3D.md) usarem o mesmo.
 *
 * A `chaveDaOperacao` nasce uma vez por abertura (`novoFormulario`): o duplo
 * clique, ou a rede que reenviou, chega ao servidor com a mesma chave e não
 * baixa o estoque duas vezes. Com `endereco`, o movimento já sabe o lugar —
 * destino da entrada, origem da saída, posição contada na conferência.
 */

import { D, calcular, type Calculo } from '@shared/preco'
import { FORMAS_DE_PAGAMENTO_DA_VENDA, NOMES_DOS_MOVIMENTOS, TIPOS_DE_MOVIMENTO, type TipoDeMovimento } from '@shared/estoque'
import type { Endereco } from '@shared/enderecos'
import type { Canal, PedidoDeMovimento, Produto } from '@/lib/api'
import { Aviso, Botao, CampoDeTexto, CampoNumero, Combo, Selecao, brl, novaChave, pct } from '@/components/ui'

export type FormularioDeMovimento = Required<Omit<PedidoDeMovimento, 'canalId' | 'endereco'>> & { canalId: string | null; endereco: Endereco | null }

/* o custo de uma unidade, a partir do custo do lote no cadastro do produto */
export const custoUnitarioDe = (p: Pick<Produto, 'premissas'>) => {
  try {
    const c = D(p.premissas.custo).div(p.premissas.quantidade)
    /* dinheiro em duas casas: R$ 10 / 3 virava "3,333333" no campo. Só o custo abaixo de um centavo (parafuso no milheiro) guarda mais, senão viraria zero */
    return c.isZero() || c.abs().gte('0.01') ? c.toFixed(2) : c.toSignificantDigits(2).toFixed()
  } catch {
    return '0'
  }
}

export function novoFormulario(p: Pick<Produto, 'id' | 'premissas' | 'canalId'>, tipo: TipoDeMovimento = 'entrada', endereco: Endereco | null = null): FormularioDeMovimento {
  return {
    chaveDaOperacao: novaChave(), produtoId: p.id, tipo: tipo as FormularioDeMovimento['tipo'], quantidade: '1', custoUnitario: custoUnitarioDe(p),
    precoUnitario: p.premissas.preco, desconto: '0', canalId: p.canalId ?? null, formaDePagamento: 'Pix', motivo: '', endereco,
  }
}

/**
 * A conta da venda enquanto a pessoa digita — PLANO-USABILIDADE-LUCRO.md,
 * "próximas": o desconto que passa do limite aparece ANTES de confirmar.
 *
 * É a mesma conta que o servidor grava como resultado estimado
 * (`registrarVenda`): uma unidade, o preço depois do desconto e as taxas do
 * canal escolhido. Uma diferença: o servidor usa o custo MÉDIO do estoque, e
 * aqui vai o custo do formulário (o do cadastro) — por isso o texto fala em
 * estimativa. Não bloqueia nada: a venda já aconteceu, e registrá-la é sempre
 * o certo.
 */
function contaDaVenda(p: Produto, form: FormularioDeMovimento, canais: Canal[]): Calculo | null {
  try {
    const liquido = D(form.precoUnitario || 0).minus(form.desconto || 0)
    if (!liquido.gt(0)) return null
    const canal = canais.find((c) => c.id === (form.canalId ?? p.canalId))
    return calcular({
      ...p.premissas, custo: form.custoUnitario || custoUnitarioDe(p), quantidade: '1', preco: liquido.toFixed(2),
      ...(canal ? { comissao: canal.dados.comissao, tarifaFixa: canal.dados.tarifaFixa, cobrancas: canal.dados.cobrancas } : {}),
    })
  } catch {
    return null /* campo ainda sendo digitado */
  }
}

function AvisoDoDesconto({ conta, form, meta, unidade }: { conta: Calculo; form: FormularioDeMovimento; meta: string; unidade: string }) {
  const atual = conta.atual
  if (!atual) return null
  const cheio = D(form.precoUnitario || 0)
  /* quanto de desconto ainda cabe, sobre o preço cheio digitado — nunca negativo */
  const ate = (piso: string) => { const resto = cheio.minus(piso); return brl((resto.gt(0) ? resto : D(0)).toFixed(2)) }
  if (Number(atual.lucro) < 0) {
    return (
      <Aviso tipo="erro">
        Com esse desconto você <strong>perde {brl(Math.abs(Number(atual.lucro)))}</strong> em cada {unidade}. Para não ter prejuízo, cobre pelo menos {brl(conta.equilibrio)} — desconto de até {ate(conta.equilibrio)}.
      </Aviso>
    )
  }
  if (!atual.atingeMeta) {
    return (
      <Aviso tipo="atencao">
        Sobra {brl(atual.lucro)} por {unidade} ({pct(atual.margem)}), abaixo da sua meta de {pct(meta)}. Para manter a meta, o desconto vai até {ate(conta.minimo)}.
      </Aviso>
    )
  }
  return <Aviso tipo="ok">Sobra {brl(atual.lucro)} por {unidade} ({pct(atual.margem)}), dentro da sua meta. Estimativa pelo custo do cadastro e pelas taxas do canal escolhido.</Aviso>
}

export function CamposDoMovimento({ form, aoMudar, produtos, canais, ocupado, aoSalvar, lugar, tipos = TIPOS_DE_MOVIMENTO }: {
  form: FormularioDeMovimento
  aoMudar: (f: FormularioDeMovimento) => void
  produtos: Produto[]
  canais: Canal[]
  ocupado: boolean
  aoSalvar: () => void
  /** o rótulo da posição, quando o movimento já tem lugar */
  lugar?: string
  tipos?: readonly FormularioDeMovimento['tipo'][]
}) {
  const escolhido = produtos.find((p) => p.id === form.produtoId)
  let totalDaVenda = '—'
  try {
    totalDaVenda = brl(D(form.precoUnitario || 0).minus(form.desconto || 0).times(form.quantidade || 0).toFixed(2))
  } catch { /* o campo ainda está sendo digitado */ }
  const conferencia = form.tipo === 'conferencia'
  const conta = form.tipo === 'venda' && escolhido ? contaDaVenda(escolhido, form, canais) : null

  return (
    <div className="form-stack">
      {lugar ? <Aviso>{form.tipo === 'venda' || form.tipo === 'perda' || form.tipo === 'uso_proprio' ? 'Sai de' : conferencia ? 'Contagem de' : 'Vai para'} <strong>{lugar}</strong>.</Aviso> : null}
      <Combo
        rotulo="Produto"
        valor={form.produtoId}
        opcoes={produtos.map((p) => ({ valor: p.id, rotulo: p.nome }))}
        aoMudar={(v) => {
          const p = produtos.find((a) => a.id === v)
          if (p) aoMudar({ ...form, produtoId: v, custoUnitario: custoUnitarioDe(p), precoUnitario: p.premissas.preco, canalId: p.canalId ?? null })
        }}
      />
      {tipos.length > 1 ? (
        <Selecao
          rotulo="O que aconteceu?"
          valor={form.tipo}
          aoMudar={(tipo) => aoMudar({ ...form, tipo })}
          opcoes={tipos.map((t) => ({ valor: t, rotulo: NOMES_DOS_MOVIMENTOS[t] }))}
        />
      ) : null}
      <CampoNumero
        rotulo={conferencia ? (lugar ? 'Quantidade contada nesta posição' : 'Quantidade contada no estoque') : 'Quantidade desta movimentação'}
        prefixo={escolhido?.unidade ?? 'un.'}
        valor={form.quantidade}
        aoMudar={(v) => aoMudar({ ...form, quantidade: v })}
        dica={conferencia ? 'Informe o saldo final contado, não a diferença.' : 'Use a mesma unidade do cadastro do produto.'}
      />
      {form.tipo === 'inicial' || form.tipo === 'entrada' || conferencia ? (
        <CampoNumero
          rotulo={`Custo de aquisição por ${escolhido?.unidade ?? 'unidade'}`}
          valor={form.custoUnitario}
          aoMudar={(v) => aoMudar({ ...form, custoUnitario: v })}
          dica={conferencia ? 'Usado somente se a conferência acrescentar quantidade.' : 'Este valor compõe o custo médio do estoque; o preço do catálogo permanece igual.'}
        />
      ) : null}
      {form.tipo === 'venda' ? (
        <>
          <div className="form-grid">
            <CampoNumero rotulo={`Preço cobrado por ${escolhido?.unidade ?? 'unidade'}`} valor={form.precoUnitario} aoMudar={(v) => aoMudar({ ...form, precoUnitario: v })} />
            <CampoNumero rotulo="Desconto em cada unidade" valor={form.desconto} aoMudar={(v) => aoMudar({ ...form, desconto: v })} />
          </div>
          <div className="form-grid">
            <Combo
              rotulo="Perfil de canal da venda"
              valor={form.canalId ?? ''}
              aoMudar={(v) => aoMudar({ ...form, canalId: v || null })}
              opcoes={[{ valor: '', rotulo: 'Usar custos do produto' }, ...canais.map((c) => ({ valor: c.id, rotulo: c.nome }))]}
            />
            <Selecao rotulo="Como o cliente pagou?" valor={form.formaDePagamento} aoMudar={(v) => aoMudar({ ...form, formaDePagamento: v })} opcoes={FORMAS_DE_PAGAMENTO_DA_VENDA} />
          </div>
          <div className="stock-sale-total"><span>Total desta venda após desconto</span><strong>{totalDaVenda}</strong></div>
          {conta ? <AvisoDoDesconto conta={conta} form={form} meta={escolhido!.premissas.meta} unidade={escolhido!.unidade} /> : null}
          <Aviso>A venda baixa o estoque. As taxas usadas para estimar o resultado são as do perfil informado; o pagamento selecionado não altera taxas automaticamente.</Aviso>
        </>
      ) : null}
      <CampoDeTexto
        rotulo={form.tipo === 'perda' || form.tipo === 'uso_proprio' || conferencia ? 'Motivo da movimentação' : 'Observação — opcional'}
        value={form.motivo}
        maxLength={250}
        onChange={(e) => aoMudar({ ...form, motivo: e.target.value })}
      />
      <Botao ocupado={ocupado} onClick={aoSalvar}>Confirmar {form.tipo === 'venda' ? 'venda' : 'movimentação'}</Botao>
    </div>
  )
}
