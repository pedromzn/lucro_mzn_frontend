/**
 * Primeiro acesso — o link do convite vira senha.
 *
 * A força da senha é conferida enquanto se digita, e não só no envio: descobrir
 * que faltava um número depois de digitar a confirmação inteira é o tipo de
 * atrito que faz a pessoa desistir do convite.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { autenticacao, useSessao } from '@/lib/sessao'
import { Aviso, BotaoPrincipal, CampoDeTexto, MolduraDeAcesso } from '@/acesso/Moldura'
import { CaixaDosTermos } from '@/acesso/CaixaDosTermos'

const REGRAS = [
  { texto: 'Pelo menos 8 caracteres', ok: (s: string) => s.length >= 8 },
  { texto: 'Pelo menos uma letra', ok: (s: string) => /[a-zA-Z]/.test(s) },
  { texto: 'Pelo menos um número', ok: (s: string) => /[0-9]/.test(s) },
]

export function ForcaDaSenha({ senha }: { senha: string }) {
  return (
    <ul className="forca-da-senha">
      {REGRAS.map((regra) => {
        const atendida = regra.ok(senha)
        return (
          <li key={regra.texto} className={atendida ? 'positive' : 'muted'}>
            {atendida ? <Check size={12} /> : <X size={12} />}
            {regra.texto}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Tira o segredo da barra de endereço assim que a página o leu.
 *
 * O token chega por query string porque um link de e-mail não tem outro lugar
 * para carregá-lo. Mas a query string vaza em três frentes: fica no histórico
 * do navegador, entra no log de acesso do servidor e, se a página carregar
 * qualquer coisa de fora, vai junto no cabeçalho `Referer`.
 *
 * `replaceState` reescreve a URL sem recarregar e sem criar entrada nova no
 * histórico — o valor já está na memória do componente, então nada se perde.
 * Não conserta o log do servidor (o pedido já chegou lá); conserta o que fica
 * depois, que é a parte que dura.
 */
function esquecerTokenDaUrl(): void {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('token')) return
    url.searchParams.delete('token')
    window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash)
  } catch {
    /* sem `history` não há o que limpar, e a tela continua funcionando */
  }
}

export default function DefinirSenha() {
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const entrar = useSessao((s) => s.entrar)

  const email = params.get('email') ?? ''
  /* lido uma vez, no primeiro render: depois a URL é limpa e `params` não o tem mais */
  const [token] = useState(() => params.get('token') ?? '')

  useEffect(() => {
    if (token) esquecerTokenDaUrl()
  }, [token])

  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [aceite, setAceite] = useState(false)

  const valida = useMemo(() => REGRAS.every((r) => r.ok(senha)), [senha])
  const confere = senha.length > 0 && senha === confirmacao

  if (!email || !token) {
    return (
      <MolduraDeAcesso titulo="Este link está incompleto.">
        <Aviso tipo="erro">
          Este endereço não traz o convite completo. Abra o link exatamente como veio no e-mail, ou peça um novo ao
          responsável pela sua empresa.
        </Aviso>
        <Link to="/entrar" className="text-link">
          Ir para a entrada
        </Link>
      </MolduraDeAcesso>
    )
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)
    setCarregando(true)
    try {
      const retrato = await autenticacao.definirSenha({ email, token, senha, aceite })
      entrar(retrato)
      navegar('/', { replace: true })
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível definir a senha.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <MolduraDeAcesso
      titulo="Escolha sua senha."
      subtitulo={<>Você vai entrar como <strong>{email}</strong>.</>}
    >
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}

      <form onSubmit={enviar} className="form-stack">
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
        <CampoDeTexto
          rotulo="Repita a senha"
          type="password"
          autoComplete="new-password"
          required
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          placeholder="••••••••"
          dica={confirmacao && !confere ? 'As duas senhas estão diferentes.' : undefined}
        />
        <CaixaDosTermos marcado={aceite} aoMudar={setAceite} />
        <BotaoPrincipal carregando={carregando} disabled={!valida || !confere || !aceite}>
          Definir senha e entrar
        </BotaoPrincipal>
      </form>
    </MolduraDeAcesso>
  )
}
