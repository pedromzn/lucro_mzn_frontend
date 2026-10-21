/**
 * O resultado do preço — o `ResultPanel` do mock, o mesmo cartão em toda tela
 * que calcula (Precificar, Cenários, Descontos).
 *
 * O cálculo vem do motor do `@shared/preco`, o MESMO que o servidor roda antes
 * de gravar: o número que a pessoa vê enquanto digita é o que vai ficar.
 *
 * "Lucro" aqui é sempre ESTIMATIVA sobre os custos informados — o cartão diz
 * isso no rodapé, como o mock dizia. Não é lucro realizado nem apuração.
 */

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { calcular, type Calculo, type Premissas } from '@shared/preco'
import { Aviso, Selo, brl, pct } from '@/components/ui'

/** Calcula sem lançar: a tela mostra o erro do motor no lugar do número. */
export function usarCalculo(premissas: Premissas): { calculo: Calculo | null; erro: string | null } {
  try {
    return { calculo: calcular(premissas), erro: null }
  } catch (e) {
    return { calculo: null, erro: e instanceof Error ? e.message : 'Premissas inválidas.' }
  }
}

export function PainelDoResultado({ calculo, erro, mostrarAtual = false, compacto = false, unidade = 'unidade' }: {
  calculo: Calculo | null
  erro?: string | null
  /** nas simulações, o número grande é o preço SIMULADO (o praticado), e não o sugerido */
  mostrarAtual?: boolean
  compacto?: boolean
  unidade?: string
}) {
  const [explicar, setExplicar] = useState(false)
  if (!calculo) {
    return (
      <aside className="result-panel">
        <div className="eyebrow">SEU PREÇO, EXPLICADO</div>
        <h2>Vamos encontrar<br />o seu preço.</h2>
        {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      </aside>
    )
  }
  const r = mostrarAtual && calculo.atual ? calculo.atual : calculo.resultado
  return (
    <aside className="result-panel">
      <div className="eyebrow">{mostrarAtual ? 'VENDA SIMULADA' : 'PREÇO DE VENDA SUGERIDO'}</div>
      <div className="price-hero" aria-live="polite">{brl(mostrarAtual ? r.preco : calculo.sugerido)}</div>
      <div className="result-meta">
        <span>por {unidade}</span>
        <Selo tom={r.atingeMeta ? 'verde' : 'ambar'}>{r.atingeMeta ? 'Meta preservada' : 'Abaixo da meta'}</Selo>
      </div>
      <div className="result-profit">
        <span>Sobra estimada por {unidade}</span>
        <strong className={Number(r.lucro) < 0 ? 'negative' : ''}>{brl(r.lucro)}</strong>
        <small>Lucro estimado após os custos informados</small>
      </div>
      <div className="result-metrics">
        <div><span>Margem estimada</span><strong>{pct(r.margem)}</strong></div>
        <div><span>Custos totais</span><strong>{brl(r.total)}</strong></div>
      </div>
      {!compacto ? (
        <>
          <div className="result-line">
            <span>Preço de equilíbrio <abbr title="Preço mínimo que cobre os custos informados, sem margem de lucro.">?</abbr></span>
            <b>{brl(calculo.equilibrio)}</b>
          </div>
          <div className="result-line"><span>Preço mínimo para sua margem</span><b>{brl(calculo.minimo)}</b></div>
          <div className="result-line">
            <span>Markup <abbr title="(Preço ÷ custos monetários unitários − 1) × 100. É diferente da margem sobre a venda.">?</abbr></span>
            <b>{pct(r.markup)}</b>
          </div>
          <button type="button" className="explain-button" onClick={() => setExplicar(!explicar)} aria-expanded={explicar}>
            {explicar ? 'Fechar composição' : 'Entenda este preço'}
            <ChevronDown size={16} />
          </button>
          {explicar ? (
            <div className="composition">
              {r.componentes.filter((c) => Number(c.valor) > 0).map((c) => (
                <div key={c.id}>
                  <div><span>{c.nome}</span><b>{brl(c.valor)}</b></div>
                  <div className="track"><i style={{ width: `${Math.min(100, Math.max(0, Number(c.participacao)))}%` }} /></div>
                </div>
              ))}
              <p>Preço − custos − taxas = lucro estimado. No modelo linear, o preço é calculado por C ÷ (1 − taxas − margem). Tarifas por faixa são resolvidas separadamente.</p>
              <p>Somente os componentes informados entram no cálculo. Sem confirmação, tributos, devoluções e despesas não cadastradas ficam de fora. Regras: {calculo.versao}.</p>
            </div>
          ) : null}
        </>
      ) : null}
      {calculo.avisos.length > 0 ? <div className="result-warning">{calculo.avisos[0]}</div> : null}
      <span className="result-foot">Estimativa baseada nos valores informados.</span>
    </aside>
  )
}
