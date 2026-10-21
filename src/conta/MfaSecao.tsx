/**
 * Verificação em duas etapas — o cartão de estado em *Minha conta*.
 *
 * Ele **não** faz a matrícula: mostra como a conta está e abre a tela inteira
 * (`MatriculaDeMfa`) para o que tem passo a passo. Ler QR, digitar código e
 * guardar dez códigos de recuperação não cabem num cartão de 340px — foi a
 * primeira versão, e era apertada de verdade.
 *
 * O que fica aqui é o que é de uma linha só: o estado, e o desligar.
 *
 * **Desligar continua pedindo a senha** (OWASP: reautenticar para trocar de
 * fator) e **não pede código do autenticador**, de propósito: quem perdeu o
 * telefone precisa conseguir desligar. Exigir os dois trancaria a conta para
 * sempre por um celular perdido.
 */

import { useState } from 'react'
import { ShieldCheck, ShieldOff } from 'lucide-react'
import { toast } from '@/lib/avisos'
import { mfa, useSessao } from '@/lib/sessao'
import { Botao, CampoDeTexto, Selo } from '@/components/ui'
import { MatriculaDeMfa } from './MatriculaDeMfa'

export function MfaSecao() {
  const retrato = useSessao((s) => s.retrato)
  const recarregar = useSessao((s) => s.recarregar)
  const estado = retrato?.mfa

  const [telaCheia, setTelaCheia] = useState<'ativar' | 'refazer' | null>(null)
  const [desligando, setDesligando] = useState(false)
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function desativar(evento: React.FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    try {
      await mfa.desativar(senha)
      toast.success('Verificação em duas etapas desativada.')
      setDesligando(false)
      setSenha('')
      await recarregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui desativar.')
    } finally {
      setEnviando(false)
    }
  }

  if (telaCheia) {
    return (
      <MatriculaDeMfa
        modo={telaCheia}
        aoFechar={() => {
          setTelaCheia(null)
          void recarregar()
        }}
      />
    )
  }

  /* sem chave de cifragem o servidor não guarda semente — e dizer isso é melhor
     que um botão que só falha depois de a pessoa digitar a senha */
  if (estado && !estado.disponivel) {
    return (
      <section className="panel section-gap">
        <h2>Verificação em duas etapas</h2>
        <p className="muted">Este servidor ainda não está configurado para guardar o segredo com segurança. Fale com quem administra.</p>
      </section>
    )
  }

  return (
    <section className="panel section-gap">
      <div className="between">
        <h2>Verificação em duas etapas</h2>
        <Selo tom={estado?.ativo ? 'verde' : 'neutro'}>{estado?.ativo ? <><ShieldCheck size={12} /> Ativa</> : <><ShieldOff size={12} /> Desligada</>}</Selo>
      </div>
      <p className="muted">
        {estado?.ativo ? (
          <>
            Entrar pede o código do seu aplicativo autenticador além da senha — no LucroCerto, nos outros aplicativos da MZN e na loja. Você tem{' '}
            <strong>{estado.codigosRestantes}</strong> código(s) de recuperação restantes.
          </>
        ) : (
          <>
            Com ela, sua senha sozinha não abre a conta: é preciso também o código de um aplicativo como Google Authenticator, Microsoft
            Authenticator ou 1Password. Ligar também dispensa o código por e-mail da loja.
          </>
        )}
      </p>

      {desligando ? (
        <form onSubmit={desativar} className="form-stack section-gap">
          <CampoDeTexto
            rotulo="Confirme sua senha para desativar"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <div className="actions">
            <Botao type="submit" variante="perigo" ocupado={enviando}>Desativar</Botao>
            <Botao variante="fantasma" onClick={() => { setDesligando(false); setSenha('') }}>Cancelar</Botao>
          </div>
        </form>
      ) : (
        <div className="actions section-gap">
          {estado?.ativo ? (
            <>
              <Botao variante="secundario" onClick={() => setTelaCheia('refazer')}>Gerar códigos novos</Botao>
              <Botao variante="fantasma" onClick={() => setDesligando(true)}>Desativar</Botao>
            </>
          ) : (
            <Botao onClick={() => setTelaCheia('ativar')}><ShieldCheck size={16} />Ativar</Botao>
          )}
        </div>
      )}
    </section>
  )
}
