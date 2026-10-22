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
import { ErroDaApi, lucroApi, type Estado } from './api'
import { useSessao } from './sessao'

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
      if (e instanceof ErroDaApi && e.codigo === 'app_nao_contratado') {
        try {
          if (await comecarNoPrimeiroAcesso()) {
            await get().recarregar()
            return
          }
        } catch (falha) {
          set({ erro: falha instanceof Error ? falha.message : 'Não foi possível começar a avaliação.' })
          return
        }
      }
      set({ erro: e instanceof Error ? e.message : 'Não foi possível carregar o seu espaço de trabalho.' })
    }
  },
}))

/**
 * O primeiro acesso de quem já é cliente de outro app da MZN: a empresa ainda
 * não tem o Lucro Certo, e quem é gestor começa a avaliação de 15 dias ali
 * mesmo, sem passar pela loja (decisão do Pedro em 22/10/2026). Depois disso a
 * sessão é relida — é ela que traz o espaço "Principal" que acabou de nascer.
 *
 * Quem não é gestor não abre o app para a empresa inteira: a mensagem diz a
 * quem pedir. Devolve `true` quando a avaliação começou.
 */
let comecando: Promise<boolean> | null = null
let jaComecou = false
/* uma tentativa por vez (a casca e a página pedem o estado juntas), e só marca "já começou" quando deu certo */
async function comecarNoPrimeiroAcesso(): Promise<boolean> {
  if (jaComecou) return false
  comecando ??= tentarComecar().then(
    (ok) => { jaComecou = ok; return ok },
    (falha) => { comecando = null; throw falha },
  )
  return comecando
}

async function tentarComecar(): Promise<boolean> {
  const sessao = useSessao.getState()
  if (!sessao.ehGestor()) {
    throw new Error('Sua empresa ainda não usa o Lucro Certo. Peça a um administrador da sua empresa para entrar aqui: a avaliação de 15 dias começa no primeiro acesso dele.')
  }
  /* o Núcleo recusa abrir o app sem o aceite em dia; a janela dos termos está aberta, e a casca tenta de novo depois dele */
  if (sessao.retrato?.termosPendentes?.length) {
    throw new Error('Para começar a avaliação do Lucro Certo, leia e aceite os Termos de Uso e o Aviso de Privacidade na janela aberta.')
  }
  try {
    await lucroApi.comecarAvaliacao()
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : 'Não foi possível começar a avaliação.')
  }
  await useSessao.getState().recarregar()
  toast.success('Sua avaliação de 15 dias do Lucro Certo começou. Bom proveito!')
  return true
}

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
