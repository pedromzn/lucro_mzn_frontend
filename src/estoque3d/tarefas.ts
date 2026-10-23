/** Etapas visuais de uma operação confirmada — PLANO-ESTOQUE-3D.md, evolução 6.
 * A fila só tem apresentação. Cancelar, pausar ou repetir nunca grava estoque.
 */
import { comprimentoDoCaminho, criarNavegacao, descansoDaAssistente, type Dimensoes } from './caminhos'
import type { Ponto, Voo } from './voos'

export type Fase = 'caminhao_chega' | 'buscar' | 'pegar' | 'levar' | 'guardar' | 'caminhao_sai' | 'voltar' | 'orientar'
export interface Etapa { fase: Fase; duracao: number; caminho?: Ponto[] }
export interface Tarefa { voo: Voo; etapas: Etapa[] }
export const VELOCIDADE = 1.65
export const GIRO_DE_REPOUSO = 0.25
export function planejarTarefa(voo: Voo, origem: Ponto, navegacao: ReturnType<typeof criarNavegacao>, ambiente: Dimensoes): Tarefa | null {
  const buscar = navegacao.caminho(origem, voo.de)
  if (!buscar) return null
  const levar = navegacao.caminho(buscar[buscar.length - 1]!, voo.para)
  if (!levar) return null
  const voltar = navegacao.caminho(levar[levar.length - 1]!, descansoDaAssistente(ambiente))
  const caminhada = (fase: Fase, caminho: Ponto[]): Etapa => ({ fase, caminho, duracao: Math.max(0.15, comprimentoDoCaminho(caminho) / VELOCIDADE) })
  const etapas: Etapa[] = []
  if (voo.operacao === 'entregar') etapas.push({ fase: 'caminhao_chega', duracao: 2.4 })
  etapas.push(caminhada('buscar', buscar), { fase: 'pegar', duracao: voo.de.y > 1.45 ? 2.6 : 1.3 }, caminhada('levar', levar), { fase: 'guardar', duracao: voo.para.y > 1.45 ? 2.6 : 1.3 })
  if (voo.operacao === 'entregar') etapas.push({ fase: 'caminhao_sai', duracao: 2.4 })
  if (voltar) etapas.push(caminhada('voltar', voltar))
  etapas.push({ fase: 'orientar', duracao: 0.5 })
  return { voo, etapas }
}
export const NOMES_DAS_FASES: Record<Fase, string> = {
  caminhao_chega: 'Caminhão chegando para a coleta', buscar: 'Assistente indo buscar', pegar: 'Recolhendo a encomenda',
  levar: 'Assistente levando a encomenda', guardar: 'Acomodando a encomenda', caminhao_sai: 'Caminhão saindo com a encomenda', voltar: 'Voltando à entrada', orientar: 'Concluindo o movimento',
}
export const suavizar = (t: number) => { const n = Math.min(1, Math.max(0, t)); return n * n * (3 - 2 * n) }
