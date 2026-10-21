/**
 * Os goldens do motor — portados do mock (`LucroCerto/tests/pricing.test.ts`),
 * com os MESMOS números. Se um destes mudar, o motor mudou de comportamento e
 * o histórico de quem já precificou passa a dizer outra coisa: a mudança é de
 * versão (`VERSAO_DO_MOTOR`), não de teste.
 */

import { describe, expect, it } from 'vitest'
import { avaliar, calcular, D, precoComDesconto, PREMISSAS_PADRAO, estimarResultadoDaVenda, type Premissas } from './preco.js'

const premissas = (x: Partial<Premissas> = {}): Premissas => ({ ...PREMISSAS_PADRAO, custo: '40', meta: '25', preco: '100', tributoConferido: true, ...x })

describe('o caso linear', () => {
  it('golden: 40 + embalagem 5, taxas 15%, meta 25% → 75', () => {
    const r = calcular(premissas({ embalagem: '5', comissao: '15' }))
    expect(r.sugerido).toBe('75.00')
    expect(r.resultado.lucro).toBe('18.75')
    expect(r.resultado.margem).toBe('25.0000')
    expect(r.resultado.markup).toBe('66.6667')
    expect(r.equilibrio).toBe('52.95')
    expect(r.descontoMaximo?.valor).toBe('25.00')
  })
  it('custo zero tem preço positivo e markup indefinido', () => {
    const r = calcular(premissas({ custo: '0' }))
    expect(r.sugerido).toBe('0.01')
    expect(r.resultado.markup).toBeNull()
  })
  it('preço zero não é venda válida', () => expect(() => avaliar(premissas(), '0')).toThrow())
  it('prejuízo é negativo', () => expect(calcular(premissas({ preco: '20' })).atual?.lucro).toBe('-20.00'))
  it('margem zero', () => expect(calcular(premissas({ meta: '0' })).sugerido).toBe('40.00'))
  it('margem negativa é permitida', () => expect(calcular(premissas({ meta: '-20' })).sugerido).toBe('33.34'))
  it('margem perto de 100%', () => expect(calcular(premissas({ custo: '1', meta: '99.99' })).sugerido).toBe('10000.00'))
  it('soma impossível é recusada', () => expect(() => calcular(premissas({ comissao: '80', meta: '25' }))).toThrow())
  it('taxa acima do limite é recusada', () => expect(() => calcular(premissas({ comissao: '101' }))).toThrow())
  it('tarifa fixa', () => expect(calcular(premissas({ tarifaFixa: '5' })).sugerido).toBe('60.00'))
  it('várias taxas e tributo estimado', () => {
    const r = calcular(premissas({ comissao: '10', tributo: '5', cobrancas: [{ id: 'cartao', nome: 'Cartão', tipo: 'percentual', taxa: '5' }], meta: '30' }))
    expect(r.sugerido).toBe('80.00')
  })
})

describe('rateio e lote', () => {
  it('despesa mensal rateada é projeção, e avisa', () => {
    const r = calcular(premissas({ custos: [{ id: 'aluguel', nome: 'Aluguel', valor: '1000', frequencia: 'mensal', divisor: '100', categoria: 'Despesa fixa' }] }))
    expect(r.sugerido).toBe('66.67')
    expect(r.avisos.some((a) => a.includes('rateio'))).toBe(true)
  })
  it('rateio por zero é proibido', () => {
    expect(() => calcular(premissas({ custos: [{ id: 'x', nome: 'x', valor: '1000', frequencia: 'mensal', divisor: '0', categoria: 'fixo' }] }))).toThrow()
  })
  it('preço por lote', () => expect(calcular(premissas({ custo: '400', quantidade: '10' })).sugerido).toBe('53.34'))
  it('decimal sensível: 0,1 + 0,2', () => expect(calcular(premissas({ custo: '0.1', embalagem: '0.2', meta: '0' })).sugerido).toBe('0.30'))
})

describe('descontos', () => {
  it('percentual', () => expect(precoComDesconto('100', 'percentual', '10')).toBe('90.00'))
  it('em reais', () => expect(precoComDesconto('100', 'valor', '12.50')).toBe('87.50'))
  it('em kit, sobre o kit inteiro', () => expect(precoComDesconto('100', 'valor', '20', '2')).toBe('90.00'))
  it('desconto que zera o preço é recusado', () => expect(() => precoComDesconto('10', 'valor', '10')).toThrow())
})

describe('arredondamento', () => {
  it('recalcula a margem depois do ajuste', () => {
    const r = calcular(premissas({ arredondamento: '90' }))
    expect(r.sugerido).toBe('53.90')
    expect(r.resultado.lucro).toBe('13.90')
    expect(r.resultado.margem).toBe('25.7885')
  })
  it('inteiro e múltiplo', () => {
    expect(calcular(premissas({ arredondamento: 'inteiro' })).sugerido).toBe('54.00')
    expect(calcular(premissas({ arredondamento: 'multiplo', multiplo: '5' })).sugerido).toBe('55.00')
  })
  it('arredondamento que cruza faixa é avisado', () => {
    const r = calcular(premissas({ custo: '49', meta: '0', arredondamento: '90', cobrancas: [{ id: 'a', nome: 'Faixa', tipo: 'faixa', faixas: [{ ate: '49.50', taxa: '0' }, { ate: null, taxa: '0', fixo: '10' }] }] }))
    expect(r.resultado.atingeMeta).toBe(false)
    expect(r.avisos.some((a) => a.includes('cruzou'))).toBe(true)
  })
})

describe('faixas e bases', () => {
  it('faixa com salto para cima', () => {
    const r = calcular(premissas({ custo: '45', meta: '0', cobrancas: [{ id: 't', nome: 'Faixa', tipo: 'faixa', faixas: [{ ate: '50', taxa: '0', fixo: '10' }, { ate: null, taxa: '0', fixo: '20' }] }] }))
    expect(r.sugerido).toBe('65.00')
  })
  it('faixa com salto para baixo acha o limite exato', () => {
    const r = calcular(premissas({ custo: '45', meta: '0', cobrancas: [{ id: 't', nome: 'Faixa', tipo: 'faixa', faixas: [{ ate: '50', taxa: '0', fixo: '20' }, { ate: null, taxa: '0', fixo: '2' }] }] }))
    expect(r.sugerido).toBe('50.00')
  })
  it('progressiva: 10% nos primeiros 100 e 20% no excedente', () => {
    const r = calcular(premissas({ custo: '100', meta: '0', cobrancas: [{ id: 'p', nome: 'Progressiva', tipo: 'progressiva', faixas: [{ ate: '100', taxa: '10' }, { ate: null, taxa: '20' }] }] }))
    expect(r.sugerido).toBe('112.50')
    expect(r.resultado.taxas).toBe('12.50')
  })
  it('bases diferentes: sobre o custo e sobre preço + frete', () => {
    const r = calcular(premissas({
      custo: '40', frete: '10', meta: '0',
      cobrancas: [{ id: 'a', nome: 'Custo', tipo: 'percentual', taxa: '10', base: 'custo' }, { id: 'b', nome: 'Com frete', tipo: 'percentual', taxa: '10', base: 'venda_frete' }],
    }))
    expect(r.sugerido).toBe('62.23')
  })
  it('a faixa é escolhida pelo preço mesmo quando a taxa incide sobre o custo', () => {
    const r = calcular({ ...PREMISSAS_PADRAO, custo: '60', meta: '25', cobrancas: [{ id: 'c', nome: 'Taxa sobre custo', tipo: 'faixa', base: 'custo', faixas: [{ ate: '100', taxa: '50' }, { ate: null, taxa: '10' }] }] })
    expect(r.sugerido).toBe('100.00')
    expect(r.resultado.lucro).toBe('34.00')
  })
  it('o total de taxas soma a tarifa fixa e a comissão', () => {
    const r = calcular({ ...PREMISSAS_PADRAO, custo: '40', tarifaFixa: '5', comissao: '10', meta: '0' })
    expect(r.sugerido).toBe('50.00')
    expect(r.resultado.taxas).toBe('10.00')
  })
})

describe('as premissas guardadas não mudam', () => {
  it('trocar o canal não muta o cálculo anterior', () => {
    const a = premissas({ comissao: '10' })
    const antigo = calcular(a)
    const novo = calcular({ ...a, comissao: '20' })
    expect(antigo.sugerido).not.toBe(novo.sugerido)
    expect(antigo.premissas.comissao).toBe('10')
  })
})

describe('o mínimo no centavo', () => {
  it('atinge a meta e um centavo a menos não atinge — 250 entradas determinísticas', () => {
    for (let i = 1; i <= 250; i++) {
      const r = calcular(premissas({ custo: D(i).div(7).toFixed(6), comissao: String(i % 20), meta: String(i % 50) }))
      expect(r.resultado.atingeMeta).toBe(true)
      const menos = D(r.minimo).minus('0.01')
      if (menos.gt(0)) expect(avaliar(r.premissas, menos.toFixed(2)).atingeMeta).toBe(false)
    }
  })
})

describe('a venda registrada', () => {
  it('multiplica a sobra não arredondada antes de arredondar o total', () => {
    /* 3 unidades a R$ 10 com custo 1/3: arredondar por unidade daria 9,67 × 3 = 29,01 */
    expect(estimarResultadoDaVenda(premissas({ custo: '1', quantidade: '3' }), '10', '3')).toBe('29.00')
  })
})
