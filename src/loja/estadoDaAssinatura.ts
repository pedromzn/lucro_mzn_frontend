/**
 * A situação da assinatura, buscada uma vez e lida por quem precisar.
 *
 * Dois lugares do painel mostram isso ao mesmo tempo — o selo permanente no
 * trilho e a faixa de aviso no topo. Cada um buscando por conta própria seria
 * duas requisições iguais a cada carga de página, e pior: dois números que
 * podem discordar por um instante, o que é exatamente o tipo de detalhe que
 * faz alguém desconfiar do sistema todo.
 */

import { create } from 'zustand'
import { lojaApi, type SituacaoDaAssinatura } from '@/lib/api'

interface Estado {
  situacao: SituacaoDaAssinatura | null
  carregando: boolean
  /** já tentamos buscar? diferente de "não tem assinatura" */
  buscado: boolean
  carregar(): Promise<void>
  /** depois de comprar ou mudar de plano, o número muda */
  recarregar(): Promise<void>
}

export const useAssinatura = create<Estado>((set, get) => ({
  situacao: null,
  carregando: false,
  buscado: false,

  carregar: async () => {
    /* uma vez por carga de página: o prazo não muda de minuto em minuto */
    if (get().buscado || get().carregando) return
    await get().recarregar()
  },

  recarregar: async () => {
    set({ carregando: true })
    try {
      set({ situacao: await lojaApi.assinatura(), buscado: true })
    } catch {
      /*
       * Falha em silêncio de propósito: isto é um aviso, não o caminho
       * crítico. Um erro aqui não pode virar mensagem vermelha por cima do
       * trabalho de quem só queria abrir a tela de contatos.
       */
      set({ buscado: true })
    } finally {
      set({ carregando: false })
    }
  },
}))
