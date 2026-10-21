/**
 * O aviso que aparece no canto depois de uma ação — o `.toast` do mock, um de
 * cada vez, que some sozinho em 6,5 s (o tempo do mock). A casca o desenha
 * (`components/Casca.tsx`); a tela só chama `toast`.
 *
 * O nome e o formato (`toast`, `toast.success`, `toast.error`) são os do
 * `sonner`, que as telas da suíte trouxeram do painel do MKT: trocar a
 * biblioteca não pede mexer nelas. Sucesso e erro saem iguais, como no mock —
 * o texto já diz qual é qual.
 */

import { create } from 'zustand'

interface EstadoDoAviso {
  texto: string
  chave: number
  fechar: () => void
}

export const useAviso = create<EstadoDoAviso>((set) => ({
  texto: '',
  chave: 0,
  fechar: () => set({ texto: '' }),
}))

const mostrar = (texto: string) => useAviso.setState((s) => ({ texto, chave: s.chave + 1 }))

export const toast = Object.assign(mostrar, { success: mostrar, error: mostrar, info: mostrar })
