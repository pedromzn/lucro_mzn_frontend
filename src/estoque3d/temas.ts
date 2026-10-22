/**
 * O visual de cada tema do espaço 3D — PLANO-ESTOQUE-3D.md, E4.
 *
 * O tema é roupa: as estruturas, as medidas e o que está guardado são os
 * mesmos nos três (`@shared/enderecos`); aqui mudam a cor, a luz e o material.
 *
 * **A lojinha é "fofa" pela sombra, não pela cor.** A técnica é a do
 * bruno-simon.com (MIT), adaptada para WebGL: material toon em três tons, e uma
 * luz de céu forte com o CHÃO lavanda — a face que não pega sol recebe a cor de
 * baixo, e a sombra sai colorida em vez de preta. O armazém e o shopping usam
 * material físico, com sombra de verdade.
 */

import type { Tema, Zona } from '@shared/enderecos'

export interface VisualDoTema {
  estilo: 'fofo' | 'fisico'
  fundo: string
  chao: string
  /** faixa pintada no chão (armazém) ou rodapé */
  linha: string
  parede: string
  alturaDaParede: number
  luz: { sol: string; forca: number; ceu: string; terra: string; ambiente: number }
  /** o material da estrutura: o corpo, o detalhe e a peça de apoio (prateleira, longarina, tampo) */
  estrutura: { corpo: string; detalhe: string; apoio: string }
  /** a cor da mercadoria por categoria — escolhida pelo hash do nome */
  mercadoria: string[]
  zona: Record<Zona, string>
}

export const VISUAL: Record<Tema, VisualDoTema> = {
  loja_fofa: {
    estilo: 'fofo',
    fundo: '#fbeef3',
    chao: '#f6e4d6',
    linha: '#f1c9d9',
    parede: '#fde6ee',
    alturaDaParede: 2.4,
    luz: { sol: '#fff4e8', forca: 1.6, ceu: '#fff7fb', terra: '#b9a3ec', ambiente: 0.95 },
    estrutura: { corpo: '#f5bfd5', detalhe: '#c7b4f2', apoio: '#fff8f2' },
    mercadoria: ['#f7a3c6', '#b6a3f4', '#97d9c0', '#ffd394', '#a4d4f7', '#f6ad9c', '#d4c0f4', '#c4e6a3'],
    zona: { recebimento: '#e9dcf7', deposito: '#f3e2ea', loja: '#f6e4d6', expedicao: '#fde0c7' },
  },
  armazem: {
    estilo: 'fisico',
    fundo: '#d9dde2',
    chao: '#a4a8ae',
    linha: '#f2c230',
    parede: '#c3c8cf',
    alturaDaParede: 4.2,
    luz: { sol: '#ffffff', forca: 2.1, ceu: '#eef2f7', terra: '#5d6470', ambiente: 0.55 },
    estrutura: { corpo: '#2f5aa8', detalhe: '#e8772e', apoio: '#b98d5f' },
    mercadoria: ['#c99c64', '#b98a56', '#d6ae75', '#ad8150', '#c2925c'],
    zona: { recebimento: '#9fb0c6', deposito: '#a4a8ae', loja: '#a4a8ae', expedicao: '#c8b48a' },
  },
  shopping: {
    estilo: 'fisico',
    fundo: '#f1efeb',
    chao: '#ebe7e1',
    linha: '#c8a96a',
    parede: '#fbfaf8',
    alturaDaParede: 3,
    luz: { sol: '#fffaf2', forca: 1.9, ceu: '#ffffff', terra: '#cfc7bd', ambiente: 0.7 },
    estrutura: { corpo: '#fafafa', detalhe: '#c8a96a', apoio: '#e7e2db' },
    mercadoria: ['#6847c6', '#287c62', '#b53e52', '#2c3e66', '#e0a14a', '#4aa3a0', '#d6789a'],
    zona: { recebimento: '#dcd6ce', deposito: '#dcd6ce', loja: '#ebe7e1', expedicao: '#efe3cf' },
  },
}

/** Um número estável para um texto — a categoria escolhe a mesma cor em toda visita. */
export function hashDe(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const corDaCategoria = (tema: Tema, categoria: string): string => {
  const paleta = VISUAL[tema].mercadoria
  return paleta[hashDe(categoria) % paleta.length]!
}
