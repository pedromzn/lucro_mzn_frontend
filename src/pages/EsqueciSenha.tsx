/**
 * Recuperar acesso, em três passos.
 *
 * O código de 6 dígitos existe em vez de um link porque quem esqueceu a senha
 * costuma estar num aparelho e com o e-mail em outro — digitar seis números é
 * mais fácil que transportar uma URL longa entre eles.
 *
 * O primeiro passo DIZ quando o e-mail não tem conta, e só avança para o código
 * quando ele existe — antes avançava sempre, e quem tinha digitado o endereço
 * errado ficava na tela seguinte esperando um e-mail que nunca tinha sido
 * enviado. O porquê da troca, e o que ela custa, estão em
 * `mzn_core/src/servico/auth.ts`.
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { autenticacao } from '@/lib/sessao'
import { Aviso, BotaoPrincipal, CampoDeTexto, MolduraDeAcesso } from '@/acesso/Moldura'
import { ForcaDaSenha } from './DefinirSenha'

type Passo = 'email' | 'codigo' | 'senha' | 'pronto'

const REGRA = (s: string) => s.length >= 8 && /[a-zA-Z]/.test(s) && /[0-9]/.test(s)

export default function EsqueciSenha() {
  const navegar = useNavigate()
  const [passo, setPasso] = useState<Passo>('email')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function agir(evento: FormEvent, acao: () => Promise<void>) {
    evento.preventDefault()
    setErro(null)
    setCarregando(true)
    try {
      await acao()
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível continuar.')
    } finally {
      setCarregando(false)
    }
  }

  if (passo === 'pronto') {
    return (
      <MolduraDeAcesso titulo="Tudo certo com sua senha.">
        <Aviso tipo="ok">Pronto. Sua senha foi trocada e as sessões antigas foram encerradas.</Aviso>
        <BotaoPrincipal onClick={() => navegar('/entrar')}>Entrar agora</BotaoPrincipal>
      </MolduraDeAcesso>
    )
  }

  return (
    <MolduraDeAcesso
      titulo="Vamos recuperar seu acesso."
      subtitulo={
        passo === 'email'
          ? 'Informe o e-mail da sua conta e enviaremos um código de 6 dígitos.'
          : passo === 'codigo'
            ? `Digite o código que enviamos para ${email}.`
            : 'Agora escolha a senha nova.'
      }
      rodape={<Link to="/entrar">Já tenho conta. Quero entrar.</Link>}
    >
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}

      {passo === 'email' ? (
        <form
          onSubmit={(e) =>
            agir(e, async () => {
              await autenticacao.pedirCodigo(email.trim())
              setPasso('codigo')
            })
          }
          className="form-stack"
        >
          <CampoDeTexto
            rotulo="E-mail"
            type="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com.br"
          />
          <BotaoPrincipal carregando={carregando}>Enviar código</BotaoPrincipal>
        </form>
      ) : null}

      {passo === 'codigo' ? (
        <form
          onSubmit={(e) =>
            agir(e, async () => {
              await autenticacao.validarCodigo(email.trim(), codigo.trim())
              setPasso('senha')
            })
          }
          className="form-stack"
        >
          <label className="field">
            Código de 6 dígitos
            <input
              className="codigo-de-seis"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
            />
          </label>
          <BotaoPrincipal carregando={carregando} disabled={codigo.length !== 6}>
            Conferir código
          </BotaoPrincipal>
          <button
            type="button"
            onClick={() => setPasso('email')}
            className="text-link forgot-link"
          >
            Usar outro e-mail
          </button>
        </form>
      ) : null}

      {passo === 'senha' ? (
        <form
          onSubmit={(e) =>
            agir(e, async () => {
              await autenticacao.redefinirSenha({ email: email.trim(), codigo: codigo.trim(), senha })
              setPasso('pronto')
            })
          }
          className="form-stack"
        >
          <div>
            <CampoDeTexto
              rotulo="Nova senha"
              type="password"
              autoComplete="new-password"
              autoFocus
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
            />
            <ForcaDaSenha senha={senha} />
          </div>
          <BotaoPrincipal carregando={carregando} disabled={!REGRA(senha)}>
            Trocar senha
          </BotaoPrincipal>
        </form>
      ) : null}
    </MolduraDeAcesso>
  )
}
