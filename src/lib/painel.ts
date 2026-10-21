/**
 * O que o painel carrega ao abrir — catálogo, canais, biblioteca de custos,
 * cenários e preferências —, numa ida só (`/api/estado`) e dividido por todas
 * as telas. Elas se cruzam o tempo todo: o assistente de preço lê canais e
 * modelos, as simulações leem os produtos, as etiquetas leem os preços.
 *
 * Depois de gravar, a tela chama `recarregar`: o número que ela mostra é o que
 * o servidor calculou, nunca uma conta feita só aqui.
 */

import { create } from 'zustand'
import { toast } from '@/lib/avisos'
import { lucroApi, type Estado } from './api'

interface EstadoDoPainel {
  estado: Estado | null
  erro: string | null
  carregar: () => Promise<void>
  recarregar: () => Promise<void>
}

export const usePainel = create<EstadoDoPainel>((set, get) => ({
  estado: null,
  erro: null,
  carregar: async () => {
    if (get().estado) return
    await get().recarregar()
  },
  recarregar: async () => {
    try {
      set({ estado: await lucroApi.estado(), erro: null })
    } catch (e) {
      set({ erro: e instanceof Error ? e.message : 'Não foi possível carregar o seu espaço de trabalho.' })
    }
  },
}))

/**
 * Grava, avisa e recarrega — o caminho de toda ação que muda dado.
 *
 * Devolve o resultado, ou `null` quando falhou (o aviso já foi mostrado): a
 * tela decide se fecha a janela olhando só para isso, e o formulário fica
 * preenchido para a pessoa corrigir.
 */
export async function agir<T>(acao: () => Promise<T>, sucesso?: string): Promise<T | null> {
  try {
    const resultado = await acao()
    if (sucesso) toast.success(sucesso)
    await usePainel.getState().recarregar()
    return resultado
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Não foi possível concluir.')
    return null
  }
}
