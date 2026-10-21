/**
 * O portão do painel.
 *
 * Esta é a defesa da TELA — a que decide o que mostrar. A defesa de verdade
 * está no servidor, que recusa a requisição mesmo que alguém force a rota pelo
 * endereço. Esconder um botão não protege nada; o que protege é o 403.
 */

import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSessao, type PapelNaOrganizacao } from '@/lib/sessao'
import { Marca } from './Marca'

/** A abertura do mock (`.app-loading`), enquanto a sessão é conferida. */
export function Abertura() {
  return (
    <div className="app-loading">
      <Marca />
      <div className="skeleton loading-title" />
      <div className="loading-grid">{[1, 2, 3, 4].map((n) => <div className="skeleton" key={n} />)}</div>
      <p>Preparando seu espaço de trabalho…</p>
    </div>
  )
}

export function RotaPrivada({ children, papeis }: { children: ReactNode; papeis?: PapelNaOrganizacao[] }) {
  const { carregando, retrato } = useSessao()
  const { pathname, search } = useLocation()

  if (carregando) return <Abertura />
  if (!retrato) return <Navigate to="/entrar" replace state={{ de: `${pathname}${search}` }} />
  if (papeis && !papeis.includes(retrato.papel)) return <Navigate to="/" replace />
  return <>{children}</>
}
