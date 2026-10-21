/**
 * As rotas do painel do Lucro Certo.
 *
 * O `/` tem dois donos (PLANO-LUCRO-CERTO.md, D3): para quem não entrou, é a
 * página de venda com a calculadora grátis; para quem entrou, a Visão geral.
 * O resto do app passa pelo portão (`RotaPrivada`) e veste a casca do mock.
 *
 * As telas de acesso (`/entrar`, `/criar-conta`, `/definir-senha`,
 * `/esqueci-senha`, `/confirmar-email`) têm os caminhos que os e-mails do
 * Núcleo montam — mudar um aqui é quebrar o link que já está na caixa de
 * alguém.
 */

import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useSessao } from '@/lib/sessao'
import { Abertura, RotaPrivada } from '@/components/RotaPrivada'
import { Casca } from '@/components/Casca'
import Entrar from '@/pages/Entrar'
import CriarConta from '@/pages/CriarConta'
import ConfirmarEmail from '@/pages/ConfirmarEmail'
import DefinirSenha from '@/pages/DefinirSenha'
import EsqueciSenha from '@/pages/EsqueciSenha'
import Vitrine from '@/pages/Vitrine'
import Inicio, { Relatorios } from '@/pages/Inicio'
import Produtos from '@/pages/Produtos'
import Precificar from '@/pages/Precificar'
import Simular, { CompararCanais } from '@/pages/Simular'
import Custos from '@/pages/Custos'
import Estoque from '@/pages/Estoque'
import Etiquetas from '@/pages/Etiquetas'
import Ajuda from '@/pages/Ajuda'
import MinhaConta from '@/pages/MinhaConta'
import SuaEmpresa from '@/pages/empresa/SuaEmpresa'

const GESTORES = ['super_admin', 'admin'] as const

/** Uma tela do app: portão, casca e a tela. */
const doApp = (tela: ReactNode, papeis?: (typeof GESTORES)[number][]) => (
  <RotaPrivada papeis={papeis ? [...papeis] : undefined}>
    <Casca>{tela}</Casca>
  </RotaPrivada>
)

/** O `/`: a vitrine para quem não entrou, a Visão geral para quem entrou. */
function Raiz() {
  const { carregando, retrato } = useSessao()
  if (carregando) return <Abertura />
  return retrato ? <Casca><Inicio /></Casca> : <Vitrine />
}

export default function App() {
  const recarregar = useSessao((s) => s.recarregar)
  /* não há token para olhar: quem diz se há sessão é o Núcleo (`/auth/eu`) */
  useEffect(() => { void recarregar() }, [recarregar])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Raiz />} />
        <Route path="/entrar" element={<Entrar />} />
        <Route path="/criar-conta" element={<CriarConta />} />
        <Route path="/confirmar-email" element={<ConfirmarEmail />} />
        <Route path="/definir-senha" element={<DefinirSenha />} />
        <Route path="/esqueci-senha" element={<EsqueciSenha />} />

        <Route path="/produtos" element={doApp(<Produtos />)} />
        <Route path="/precificar" element={doApp(<Precificar />)} />
        <Route path="/precificar/:id" element={doApp(<Precificar />)} />
        <Route path="/cenarios" element={doApp(<Simular key="cenarios" modo="cenarios" />)} />
        <Route path="/descontos" element={doApp(<Simular key="descontos" modo="descontos" />)} />
        <Route path="/canais" element={doApp(<CompararCanais />)} />
        <Route path="/custos" element={doApp(<Custos />)} />
        <Route path="/estoque" element={doApp(<Estoque />)} />
        <Route path="/etiquetas" element={doApp(<Etiquetas />)} />
        <Route path="/relatorios" element={doApp(<Relatorios />)} />
        <Route path="/ajuda" element={doApp(<Ajuda />)} />
        <Route path="/conta" element={doApp(<MinhaConta />)} />
        <Route path="/empresa" element={doApp(<SuaEmpresa />, [...GESTORES])} />
        <Route path="/empresa/pessoas" element={doApp(<SuaEmpresa />, [...GESTORES])} />
        <Route path="/empresa/espacos" element={doApp(<SuaEmpresa />, [...GESTORES])} />

        {/* o e-mail do MFA do Núcleo aponta para a Minha conta do painel do MKT */}
        <Route path="/configuracoes/minha-conta" element={<Navigate to="/conta?secao=seguranca" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
