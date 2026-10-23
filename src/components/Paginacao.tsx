/**
 * A paginação das tabelas do painel — a do Marketing Flow
 * (`mzn_mkt/frontend/src/components/Paginacao.tsx`, 22/10/2026, pedido do
 * Pedro: "a paginação do app deve funcionar igual"), com as classes daqui.
 * Uma peça só, com o "por página" que a pessoa escolhe na própria tela (10,
 * 50, 100, 200 ou 500).
 *
 * 500 é o teto porque é o teto do servidor (`OPCOES_POR_PAGINA` em
 * `modules/estoque/service.ts`): oferecer mais seria prometer linhas que não
 * vêm. A escolha fica no navegador, por tela (`chave`) — é conforto de quem
 * vê, não dado — por isso `localStorage`, e com `try`: ele LANÇA em janela
 * anônima.
 */

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

export const OPCOES_POR_PAGINA = [10, 50, 100, 200, 500] as const

/** Só aceita um valor da lista; o resto (lixo antigo no navegador) vira o padrão. */
export function porPaginaValido(valor: unknown, padrao: number): number {
  const n = Number(valor)
  return (OPCOES_POR_PAGINA as readonly number[]).includes(n) ? n : padrao
}

const prefixo = 'lucro:porPagina:'

function lerEscolha(chave: string, padrao: number): number {
  try { return porPaginaValido(localStorage.getItem(prefixo + chave), padrao) } catch { return padrao }
}

/**
 * Página e tamanho da página de uma tabela. Trocar o tamanho volta para a
 * página 1: ficar na página 37 de 50 por página e passar a 500 cairia além
 * do fim.
 */
export function usePaginacao(chave: string, padrao = 50) {
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPaginaBruto] = useState(() => lerEscolha(chave, padrao))

  const setPorPagina = useCallback((n: number) => {
    const valido = porPaginaValido(n, padrao)
    setPorPaginaBruto(valido)
    setPagina(1)
    try { localStorage.setItem(prefixo + chave, String(valido)) } catch { /* fica só nesta visita */ }
  }, [chave, padrao])

  return { pagina, setPagina, porPagina, setPorPagina }
}

type Props = {
  pagina: number
  porPagina: number
  total: number
  aoMudarPagina: (pagina: number) => void
  aoMudarPorPagina: (porPagina: number) => void
  /** "produtos", "movimentações"… — vai no texto do intervalo */
  rotulo?: string
}

export function Paginacao({ pagina, porPagina, total: bruto, aoMudarPagina, aoMudarPorPagina, rotulo }: Props) {
  /*
   * Um total que não veio (API anterior à paginação, no meio de um deploy) é
   * "nada a paginar", não uma tela quebrada: `undefined.toLocaleString`
   * derrubava a aba inteira (22/10/2026).
   */
  const total = Number.isFinite(bruto) ? bruto : 0
  const paginas = Math.max(Math.ceil(total / porPagina), 1)
  const [digitada, setDigitada] = useState(String(pagina))
  useEffect(() => setDigitada(String(pagina)), [pagina])

  /* com milhares de movimentações a 10 por página, setas não bastam: a pessoa precisa poder digitar o número */
  const irPara = (n: number) => {
    const alvo = Math.min(Math.max(Math.trunc(n) || 1, 1), paginas)
    setDigitada(String(alvo))
    if (alvo !== pagina) aoMudarPagina(alvo)
  }

  if (total === 0) return null
  const de = (pagina - 1) * porPagina + 1
  const ate = Math.min(pagina * porPagina, total)

  return (
    <div className="pager">
      <div className="pager-info">
        <p>{de.toLocaleString('pt-BR')}–{ate.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')}{rotulo ? ` ${rotulo}` : ''}</p>
        <label>
          Por página
          <select value={porPagina} onChange={(e) => aoMudarPorPagina(Number(e.target.value))}>
            {OPCOES_POR_PAGINA.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      {paginas > 1 ? (
        <div className="pager-nav">
          <button type="button" onClick={() => irPara(1)} disabled={pagina <= 1} aria-label="Primeira página" title="Primeira página"><ChevronsLeft size={14} /></button>
          <button type="button" onClick={() => irPara(pagina - 1)} disabled={pagina <= 1} aria-label="Página anterior" title="Página anterior"><ChevronLeft size={14} /></button>
          <form onSubmit={(e) => { e.preventDefault(); irPara(Number(digitada)) }}>
            <input
              value={digitada}
              onChange={(e) => setDigitada(e.target.value.replace(/\D/g, ''))}
              onBlur={() => irPara(Number(digitada))}
              inputMode="numeric"
              aria-label="Página"
              style={{ width: `${Math.max(String(paginas).length, 2) + 3}ch` }}
            />
            <span>de {paginas.toLocaleString('pt-BR')}</span>
          </form>
          <button type="button" onClick={() => irPara(pagina + 1)} disabled={pagina >= paginas} aria-label="Próxima página" title="Próxima página"><ChevronRight size={14} /></button>
          <button type="button" onClick={() => irPara(paginas)} disabled={pagina >= paginas} aria-label="Última página" title="Última página"><ChevronsRight size={14} /></button>
        </div>
      ) : null}
    </div>
  )
}
