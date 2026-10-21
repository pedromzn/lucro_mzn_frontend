/**
 * A faixa que diz em que pé está a assinatura — a do painel do MKT
 * (`mzn_mkt/frontend/src/loja/AvisoDeAssinatura.tsx`), com as mesmas regras,
 * desenhada no `.notice` do mock.
 *
 * Fica no topo da página e AVISA. Quem resolve é a loja, que é outro
 * aplicativo — por isso o botão é um link de verdade para fora, e não uma
 * rota interna.
 *
 * Silêncio é proposital em quase todo caso: uma faixa permanente vira parte do
 * cenário e deixa de ser lida justamente quando passa a importar.
 */

import { ArrowUpRight } from 'lucide-react'
import { URL_DA_LOJA, type SituacaoDaAssinatura } from '@/lib/api'
import { Aviso } from '@/components/ui'

type Tom = 'neutro' | 'atencao' | 'grave'

interface Recado {
  tom: Tom
  titulo: string
  detalhe: string
  acao?: string
}

/**
 * O que dizer, e quando calar.
 *
 * A régua do trial: só fala nos últimos 7 dias. Avisar no dia 1 de 15 é ruído,
 * e ruído ensina a ignorar a faixa.
 */
export function recadoDaAssinatura(s: SituacaoDaAssinatura): Recado | null {
  const dias = s.diasRestantes

  if (s.status === 'expirada' || s.status === 'cancelada') {
    return {
      tom: 'grave',
      titulo: 'Sua assinatura terminou.',
      detalhe: 'Escolha um plano para voltar a usar o Lucro Certo. Seus dados continuam aqui.',
      acao: 'Ver planos',
    }
  }

  if (s.status === 'pausada') {
    return {
      tom: 'grave',
      titulo: 'Sua assinatura está pausada.',
      detalhe: 'Você ainda consegue ver e exportar seus dados. Regularize o pagamento para voltar a usar tudo.',
      acao: 'Regularizar',
    }
  }

  if (s.status === 'trial') {
    if (dias !== null && dias <= 0) {
      return {
        tom: 'grave',
        titulo: 'Seu período de avaliação terminou.',
        detalhe: 'Escolha um plano para continuar. Nada do que você montou foi apagado.',
        acao: 'Ver planos',
      }
    }
    if (dias !== null && dias <= 7) {
      return {
        tom: 'atencao',
        /* "Falta 1 dia" / "Faltam 5 dias": o verbo concorda, não só o substantivo */
        titulo: dias === 1 ? 'Falta 1 dia de avaliação.' : `Faltam ${dias} dias de avaliação.`,
        detalhe: 'Assine antes do fim para não perder o acesso.',
        acao: 'Ver planos',
      }
    }
    return null
  }

  /*
   * Fatura em aberto (cartão recusado ou Pix não pago). Desde 08/10/2026 há
   * 5 dias de carência depois do vencimento: o painel segue funcionando e a
   * faixa diz até quando.
   */
  if (s.inadimplenteDesde || s.emCarencia) {
    const ate = s.acessoAte
      ? new Date(s.acessoAte).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
      : null
    return {
      tom: 'atencao',
      titulo: 'Há uma fatura da assinatura em aberto.',
      detalhe: s.emCarencia && ate
        ? `O acesso continua até ${ate}. Pague por Pix, cartão ou boleto para não perder o acesso.`
        : 'Pague por Pix, cartão ou boleto para não perder o acesso.',
      acao: 'Pagar fatura',
    }
  }

  if (s.cancelarNoFim && dias !== null) {
    return {
      tom: 'atencao',
      titulo: `Sua assinatura termina em ${dias === 1 ? '1 dia' : `${dias} dias`}.`,
      detalhe: 'Você pediu o cancelamento. Até lá, tudo continua funcionando.',
      acao: 'Assinar de novo',
    }
  }

  return null
}

const TIPO_DO_AVISO = { neutro: 'info', atencao: 'atencao', grave: 'erro' } as const

/** No topo da página, no `.notice` do mock; o botão é um link de verdade para a loja, que é outro aplicativo. */
export function AvisoDeAssinatura({ situacao }: { situacao: SituacaoDaAssinatura }) {
  const recado = recadoDaAssinatura(situacao)
  if (!recado) return null
  return (
    <Aviso tipo={TIPO_DO_AVISO[recado.tom]}>
      <strong>{recado.titulo}</strong> {recado.detalhe}{' '}
      {recado.acao ? (
        <a className="text-link" href={`${URL_DA_LOJA}/app/lucro`}>
          {recado.acao}<ArrowUpRight size={14} />
        </a>
      ) : null}
    </Aviso>
  )
}
