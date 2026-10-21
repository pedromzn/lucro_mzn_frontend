/**
 * O link do e-mail — onde a conta nasce.
 *
 * Sem sessão de propósito: o link chega na caixa da pessoa, e quem acabou de
 * pedir o cadastro **não tem conta ainda**, muito menos sessão.
 *
 * Empresa, usuário, espaço e os 15 dias são criados agora (`servico/cadastro.ts`
 * no Núcleo), e a resposta já vem com a sessão. A tela entra no painel: pedir
 * login logo depois seria atrito sem ganho — a senha foi escolhida por ela e
 * este link provou o endereço.
 */

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { toast } from '@/lib/avisos'
import { contaApi } from '@/lib/api'
import { useSessao } from '@/lib/sessao'
import { Aviso, MolduraDeAcesso } from '@/acesso/Moldura'

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

export default function ConfirmarEmail() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const entrar = useSessao((s) => s.entrar)
  const [estado, setEstado] = useState<'conferindo' | 'falhou'>('conferindo')
  const [recado, setRecado] = useState('')
  /*
   * O React 19 em modo estrito roda o efeito duas vezes, e este efeito CRIA a
   * conta. A segunda chamada acharia o pedido já consumido e pintaria "link
   * inválido" por cima de um cadastro que deu certo.
   */
  const jaTentou = useRef(false)

  useEffect(() => {
    if (jaTentou.current) return
    const token = params.get('token')
    if (!token) {
      setEstado('falhou')
      setRecado('O link está incompleto. Abra o e-mail e clique no botão.')
      return
    }
    jaTentou.current = true
    esquecerTokenDaUrl()

    contaApi
      .confirmarEmail(token)
      .then((dados) => {
        entrar(dados)
        toast.success('Conta criada. Bons 15 dias!')
        navigate('/', { replace: true })
      })
      .catch((erro) => {
        setEstado('falhou')
        setRecado(erro instanceof Error ? erro.message : 'Não consegui confirmar.')
      })
  }, [params, entrar, navigate])

  return estado === 'conferindo' ? (
    <MolduraDeAcesso titulo="Confirmando seu e-mail…" subtitulo="Um instante: estamos criando a sua conta.">
      <LoaderCircle className="spin" size={22} />
    </MolduraDeAcesso>
  ) : (
    <MolduraDeAcesso titulo="Não foi possível confirmar." rodape={<>Já tem uma conta? <Link to="/entrar">Entrar</Link></>}>
      <Aviso tipo="erro">{recado}</Aviso>
      <Link to="/criar-conta" className="btn primary full-width">Começar de novo</Link>
    </MolduraDeAcesso>
  )
}
