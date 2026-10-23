/** A situação do preço — PLANO-USABILIDADE-LUCRO.md, U1. Com o motor de verdade, sem conta de mentira. */
import { describe, expect, it } from 'vitest'
import { PREMISSAS_PADRAO, calcular } from '@shared/preco'
import { contarSituacoes, situacaoDoPreco } from '@/precos/situacao'

/* custo 40 + embalagem 5, comissão 15%, meta 25%: equilíbrio ≈ 52,94 e mínimo para a meta = 75 */
const produto = (preco: string) => ({ calculo: calcular({ ...PREMISSAS_PADRAO, custo: '40', embalagem: '5', comissao: '15', meta: '25', preco }) })

describe('situação do preço', () => {
  it('sem preço cobrado, não finge uma venda', () => expect(situacaoDoPreco(produto('0'))).toBe('sem_preco'))
  it('abaixo do equilíbrio é prejuízo', () => expect(situacaoDoPreco(produto('50'))).toBe('prejuizo'))
  it('entre o equilíbrio e o mínimo é abaixo da meta', () => expect(situacaoDoPreco(produto('60'))).toBe('abaixo'))
  it('no mínimo para a meta, está na meta', () => expect(situacaoDoPreco(produto('75'))).toBe('na_meta'))
  it('premissa impossível pede revisão', () => expect(situacaoDoPreco({ calculo: null })).toBe('revisar'))
  it('conta cada situação', () => {
    expect(contarSituacoes([produto('50'), produto('60'), produto('80'), produto('0')])).toEqual({ prejuizo: 1, abaixo: 1, sem_preco: 1, revisar: 0, na_meta: 1 })
  })
})
