/**
 * Entrada no painel.
 *
 * A mensagem de erro é a mesma para e-mail que não existe e senha errada —
 * distinguir transformaria esta tela num verificador de quem tem conta na MZN.
 * O servidor já responde assim; aqui é só não inventar detalhe.
 *
 * Conta desativada e convite pendente, esses sim, ganham texto próprio: quem
 * acertou a credencial precisa saber o que fazer, e são duas ações diferentes.
 *
 * **O login tem dois tempos para quem liga MFA.** A senha certa devolve um
 * DESAFIO de cinco minutos, e esta tela troca de passo para pedir o código do
 * autenticador. O desafio não abre nada sozinho: o servidor o recusa em
 * qualquer rota de sessão, então parar aqui é parar de verdade.
 */

import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { autenticacao, useSessao } from '@/lib/sessao'
import { Aviso, BotaoPrincipal, CampoDeTexto, MolduraDeAcesso } from '@/acesso/Moldura'

/**
 * Para onde voltar depois de entrar — só caminho DESTE painel.
 *
 * O portão (`RotaPrivada`) guarda o endereço que a pessoa tentou abrir, com a
 * query — é o que traz de volta a tela de consentimento da API com todos os
 * parâmetros do integrador. Qualquer coisa que não seja `/caminho` (um `//site`
 * ou `/\\site`, que o navegador leria como outro host) cai na Home.
 */
function destinoSeguro(de: unknown): string {
  if (typeof de !== 'string' || !de.startsWith('/') || de.startsWith('//') || de.startsWith('/\\')) return '/'
  return de
}

export default function Entrar() {
  const navegar = useNavigate()
  const destino = destinoSeguro((useLocation().state as { de?: unknown } | null)?.de)
  const [params] = useSearchParams()
  const entrar = useSessao((s) => s.entrar)

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  /* o desafio do segundo passo; enquanto for nulo, a tela é a da senha */
  const [desafio, setDesafio] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [carregando, setCarregando] = useState(false)

  const expirou = params.get('expirou') === '1'

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)
    setCarregando(true)
    try {
      const resultado = await autenticacao.entrar(email.trim(), senha)
      /*
       * O campo é `desafioDeMfa`, e não `mfa`. A resposta de sessão TAMBÉM traz
       * `mfa` — o estado dele —, e como objeto é truthy, `if (resultado.mfa)`
       * mandava todo login normal para o ramo do segundo fator com o desafio
       * vazio: a tela carregava e não acontecia nada. Quebrou produção.
       */
      if ('desafioDeMfa' in resultado) {
        /* a senha estava certa, mas ainda não é sessão: falta o segundo fator */
        setDesafio(resultado.desafioDeMfa)
        return
      }
      entrar(resultado)
      navegar(destino, { replace: true })
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível entrar.')
    } finally {
      setCarregando(false)
    }
  }

  async function verificar(evento: FormEvent) {
    evento.preventDefault()
    if (!desafio) return
    setErro(null)
    setCarregando(true)
    try {
      const retrato = await autenticacao.verificarMfa(desafio, codigo.trim())
      entrar(retrato)
      navegar(destino, { replace: true })
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível confirmar o código.')
      setCodigo('')
      /*
       * Desafio vencido volta para a senha: insistir num token de cinco minutos
       * que já morreu é a pessoa digitando código certo e levando erro.
       */
      if (falha instanceof Error && /expirou/i.test(falha.message)) setDesafio(null)
    } finally {
      setCarregando(false)
    }
  }

  if (desafio) {
    return (
      <MolduraDeAcesso
        titulo="Verificação em duas etapas"
        subtitulo="Abra seu aplicativo autenticador e digite o código de seis dígitos."
        rodape={<p>Perdeu o telefone? Use um dos seus <strong>códigos de recuperação</strong> no mesmo campo.</p>}
      >
        {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
        <form onSubmit={verificar} className="form-stack">
          <CampoDeTexto
            rotulo="Código"
            inputMode="text"
            autoComplete="one-time-code"
            autoFocus
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="000000"
          />
          <BotaoPrincipal carregando={carregando}>Confirmar</BotaoPrincipal>
        </form>
        <button
          type="button"
          onClick={() => {
            setDesafio(null)
            setCodigo('')
            setErro(null)
          }}
          className="text-link forgot-link"
        >
          Entrar com outra conta
        </button>
      </MolduraDeAcesso>
    )
  }

  return (
    <MolduraDeAcesso
      titulo="Bom ter você por aqui."
      subtitulo="Entre para continuar cuidando dos seus preços."
      rodape={<>Ainda não tem uma conta? <Link to="/criar-conta">Criar conta</Link></>}
    >
      {expirou && !erro ? <Aviso tipo="atencao">Sua sessão terminou. Entre novamente para continuar.</Aviso> : null}
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}

      <form onSubmit={enviar} className="form-stack">
        <CampoDeTexto
          rotulo="E-mail"
          type="email"
          autoComplete="username"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@empresa.com.br"
        />
        <CampoDeTexto
          rotulo="Senha"
          type="password"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="••••••••"
        />
        <BotaoPrincipal carregando={carregando}>Entrar na minha conta<ArrowRight size={16} /></BotaoPrincipal>
      </form>
      <Link className="text-link forgot-link" to="/esqueci-senha">Esqueci minha senha</Link>
    </MolduraDeAcesso>
  )
}
