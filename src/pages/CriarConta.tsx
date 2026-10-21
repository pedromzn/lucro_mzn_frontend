/**
 * Criar conta — a porta de entrada sem convite.
 *
 * Quatro campos e nada mais. Cada campo a mais aqui é uma pessoa a menos do
 * outro lado: CNPJ, telefone e cargo são coisas que se pergunta depois, quando
 * a pessoa já tem motivo para responder.
 *
 * O que ela recebe: empresa criada, espaço de trabalho pronto e 15 dias. Sem
 * cartão — pedir cartão no trial é o que transforma avaliação em
 * cobrança-surpresa, e é por isso que a Zoho também não pede.
 *
 * **O formulário não entra mais direto no painel (22/09/2026).** Ele manda um
 * link, e a conta nasce no clique — do contrário o trial custaria um endereço
 * digitado, e quem quisesse mais quinze dias só precisaria inventar outro. A
 * tela tem, por isso, dois estados: o formulário e o "confira seu e-mail".
 *
 * O segundo estado **não diz se o endereço já tinha conta**. A resposta do
 * servidor é a mesma nos dois casos, de propósito: diferenciar transformaria
 * esta tela num verificador de quem é cliente da MZN. Quem já tem conta recebe
 * o aviso na própria caixa, que é onde a informação serve para alguma coisa.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, MailCheck, Send } from 'lucide-react'
import { toast } from '@/lib/avisos'
import { contaApi } from '@/lib/api'
import { CaixaDosTermos } from '@/acesso/CaixaDosTermos'
import { Aviso, BotaoPrincipal, CampoDeTexto, MolduraDeAcesso } from '@/acesso/Moldura'
import { Botao } from '@/components/ui'

const DIAS_DE_TRIAL = 15

/** A mesma régua do servidor, para a pessoa saber antes de enviar. */
function forcaDaSenha(senha: string): { ok: boolean; recado: string } {
  if (senha.length === 0) return { ok: false, recado: '' }
  if (senha.length < 8) return { ok: false, recado: 'Pelo menos 8 caracteres.' }
  if (!/[a-zA-Z]/.test(senha)) return { ok: false, recado: 'Falta uma letra.' }
  if (!/[0-9]/.test(senha)) return { ok: false, recado: 'Falta um número.' }
  return { ok: true, recado: 'Senha boa.' }
}

export default function CriarConta() {
  const [nome, setNome] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [aceite, setAceite] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  /** o endereço para onde o link foi — e o que decide qual dos dois estados a tela mostra */
  const [aguardando, setAguardando] = useState<string | null>(null)

  const forca = forcaDaSenha(senha)
  const completo = nome.trim().length >= 2 && empresa.trim().length >= 2 && email.includes('@') && forca.ok && aceite

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    if (!completo || enviando) return

    setEnviando(true)
    setErro(null)
    try {
      const dados = await contaApi.criar({
        nome: nome.trim(),
        empresa: empresa.trim(),
        email: email.trim().toLowerCase(),
        senha,
        aceite,
        /* a conta nasce com o trial DESTE app (o Núcleo confere no catálogo) */
        aplicativo: 'lucro',
      })
      /* a senha some da memória da tela assim que deixa de ser necessária */
      setSenha('')
      setAguardando(dados.email)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui enviar o link.')
    } finally {
      setEnviando(false)
    }
  }

  if (aguardando) return <ConfiraSeuEmail email={aguardando} aoVoltar={() => setAguardando(null)} />

  return (
    <MolduraDeAcesso
      titulo="Seu próximo preço começa aqui."
      subtitulo={`Crie sua conta e use o LucroCerto por ${DIAS_DE_TRIAL} dias, sem cartão. Para continuar depois, é só escolher um plano.`}
      rodape={<>Já tem uma conta? <Link to="/entrar">Entrar</Link></>}
    >
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <form onSubmit={enviar} className="form-stack">
        <CampoDeTexto rotulo="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" minLength={2} maxLength={80} required />
        <CampoDeTexto rotulo="Nome do negócio" value={empresa} onChange={(e) => setEmpresa(e.target.value)} autoComplete="organization" minLength={2} required />
        <CampoDeTexto rotulo="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" maxLength={254} required />
        <CampoDeTexto
          rotulo="Senha (pelo menos 8 caracteres, com letra e número)"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          type="password"
          autoComplete="new-password"
          required
          dica={forca.recado ? <span className={forca.ok ? 'positive' : 'muted'}>{forca.recado}</span> : undefined}
        />
        <CaixaDosTermos marcado={aceite} aoMudar={setAceite} />
        <BotaoPrincipal carregando={enviando} disabled={!completo}>Criar minha conta<ArrowRight size={16} /></BotaoPrincipal>
      </form>
    </MolduraDeAcesso>
  )
}

/**
 * O segundo estado: o link saiu, a bola está com a pessoa.
 *
 * Diz o endereço exato para onde foi — é o que resolve o erro de digitação, que
 * é de longe o motivo mais comum de "não chegou" — e oferece voltar ao
 * formulário sem recarregar a página.
 */
function ConfiraSeuEmail({ email, aoVoltar }: { email: string; aoVoltar: () => void }) {
  const [enviando, setEnviando] = useState(false)

  const reenviar = async () => {
    if (enviando) return
    setEnviando(true)
    try {
      await contaApi.reenviarCadastro(email)
      toast.success('Link enviado de novo. Confira sua caixa de entrada.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui enviar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <MolduraDeAcesso
      titulo="Confira seu e-mail."
      subtitulo={<>Mandamos um link para <strong>{email}</strong>. Clique nele para a sua conta ser criada — seus {DIAS_DE_TRIAL} dias começam a contar a partir daí.</>}
      rodape={<>Já tem uma conta? <Link to="/entrar">Entrar</Link></>}
    >
      <Aviso><MailCheck size={15} /> O link vale por 48 horas. Não chegou em alguns minutos? Veja no spam.</Aviso>
      <div className="form-stack">
        <Botao variante="secundario" className="full-width" ocupado={enviando} onClick={() => void reenviar()}>
          <Send size={14} />Reenviar o link
        </Botao>
        <button className="text-link forgot-link" onClick={aoVoltar}>Digitei o e-mail errado. Voltar e corrigir.</button>
      </div>
    </MolduraDeAcesso>
  )
}
