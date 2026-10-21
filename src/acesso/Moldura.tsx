/**
 * A moldura das telas de acesso — entrar, criar conta, recuperar e definir
 * senha. É o `auth.tsx` do mock: a história à esquerda, o cartão à direita,
 * com a marcação e as classes de lá (`.auth-page`).
 *
 * O mock tinha uma tela só que trocava de modo; aqui cada fluxo é uma rota,
 * porque cada um é um passo do Núcleo (cadastro em dois tempos, código de seis
 * dígitos, convite) — e todos vestem esta mesma moldura.
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { Marca } from '@/components/Marca'
import { Botao } from '@/components/ui'
import { LINKS_LEGAIS } from './CaixaDosTermos'

export { Aviso, CampoDeTexto } from '@/components/ui'

export function MolduraDeAcesso({ titulo, subtitulo, children, rodape }: {
  titulo: string
  subtitulo?: ReactNode
  children: ReactNode
  /** os links de troca de fluxo ("Ainda não tem uma conta?"), no `.auth-switch` */
  rodape?: ReactNode
}) {
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Link to="/"><Marca /></Link>
        <div>
          <div className="eyebrow light">MENOS INCERTEZA. MAIS CLAREZA.</div>
          <h1>Todo preço conta<br />uma história.<br /><span>Entenda a sua.</span></h1>
          <p>Organize seus custos, simule possibilidades e descubra o que sobra antes de vender.</p>
        </div>
        <span className="auth-foot"><ShieldCheck size={18} />Seus produtos, na sua conta.</span>
      </aside>
      <main className="auth-main">
        <Link className="back-link" to="/"><ArrowLeft size={16} />Voltar ao site</Link>
        <div className="auth-card">
          <span className="eyebrow">LUCROCERTO</span>
          <h2>{titulo}</h2>
          {subtitulo ? <p className="muted">{subtitulo}</p> : null}
          {children}
          {rodape ? <div className="auth-switch">{rodape}</div> : null}
        </div>
        <div className="auth-legal">
          <a href={LINKS_LEGAIS.termos} target="_blank" rel="noopener noreferrer">Termos</a>
          <a href={LINKS_LEGAIS.privacidade} target="_blank" rel="noopener noreferrer">Privacidade</a>
        </div>
      </main>
    </div>
  )
}

/** O botão largo do cartão; envia o formulário. */
export function BotaoPrincipal({ carregando, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { carregando?: boolean }) {
  return (
    <Botao type="submit" className="full-width" ocupado={carregando} {...props}>
      {children}
    </Botao>
  )
}
