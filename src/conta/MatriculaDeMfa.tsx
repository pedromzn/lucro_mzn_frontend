/**
 * A matrícula do MFA — em tela inteira.
 *
 * Nasceu dentro do cartão de *Minha conta*, num espaço de 340px, e foi tirada
 * de lá: ler um QR com o celular, digitar um código de seis dígitos e depois
 * guardar dez códigos de recuperação são três coisas seguidas, e o cartão
 * espremia as três num canto. Quem está guardando código de recuperação precisa
 * de espaço para copiar, conferir e respirar.
 *
 * Os três passos, e a ordem vem da pesquisa (OWASP e GitHub):
 *
 * 1. **a senha**, antes de qualquer coisa — reautenticar para trocar de fator,
 *    senão um laptop aberto liga ou desliga MFA em dois cliques;
 * 2. **o QR e o código**, porque ativar sem provar um código produz uma tranca
 *    sem chave: o relógio do telefone pode estar errado e ninguém descobre;
 * 3. **os dez códigos de recuperação**, mostrados UMA vez, com o caminho de
 *    saída bloqueado até a pessoa confirmar que guardou.
 */

import { useState } from 'react'
import { ArrowLeft, Check, Copy, ShieldCheck, Smartphone } from 'lucide-react'
import { toast } from '@/lib/avisos'
import { mfa, useSessao, type MatriculaDeMfa as Dados } from '@/lib/sessao'
import { Botao, CampoDeTexto } from '@/components/ui'

type Passo = 'senha' | 'codigo' | 'codigos'

/**
 * `modo` serve aos dois caminhos que terminam mostrando os dez códigos:
 * ligar o MFA e gerar códigos novos. O segundo pula o QR — a semente não muda.
 */
export function MatriculaDeMfa({ modo = 'ativar', aoFechar }: { modo?: 'ativar' | 'refazer'; aoFechar(): void }) {
  const recarregar = useSessao((s) => s.recarregar)
  const email = useSessao((s) => s.retrato?.usuario.email)

  const [passo, setPasso] = useState<Passo>('senha')
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [dados, setDados] = useState<Dados | null>(null)
  const [recuperacao, setRecuperacao] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [copiou, setCopiou] = useState(false)

  const errar = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Não consegui completar.')

  async function comecar(evento: React.FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    try {
      if (modo === 'refazer') {
        const { codigosDeRecuperacao } = await mfa.refazerCodigos(senha)
        setRecuperacao(codigosDeRecuperacao)
        setPasso('codigos')
        await recarregar()
      } else {
        setDados(await mfa.iniciar(senha))
        setPasso('codigo')
      }
      setSenha('')
    } catch (e) {
      errar(e)
    } finally {
      setEnviando(false)
    }
  }

  async function ativar(evento: React.FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    try {
      const { codigosDeRecuperacao } = await mfa.ativar(codigo.trim())
      setRecuperacao(codigosDeRecuperacao)
      setDados(null)
      setPasso('codigos')
      await recarregar()
    } catch (e) {
      errar(e)
      setCodigo('')
    } finally {
      setEnviando(false)
    }
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(recuperacao.join('\n'))
      setCopiou(true)
      setTimeout(() => setCopiou(false), 2000)
    } catch {
      toast.error('Não consegui copiar. Selecione e copie à mão.')
    }
  }

  const titulo =
    passo === 'codigos'
      ? modo === 'refazer' ? 'Códigos novos' : 'Verificação ativada'
      : modo === 'refazer' ? 'Gerar códigos de recuperação' : 'Ativar verificação em duas etapas'

  /* no lugar do cartão, dentro de Minha conta → Segurança: o passo a passo tem espaço de painel */
  return (
    <section className="panel section-gap">
      <div className="between">
        <div>
          <span className="section-kicker">PASSO {['senha', 'codigo', 'codigos'].indexOf(passo) + 1} DE 3 · {email}</span>
          <h2>{titulo}</h2>
        </div>
        {/* no último passo não há volta: os códigos não aparecem de novo */}
        {passo === 'codigos' ? <ShieldCheck size={26} className="positive" /> : (
          <button className="icon-button" onClick={aoFechar} aria-label="Voltar"><ArrowLeft size={18} /></button>
        )}
      </div>

      {passo === 'senha' ? (
        <form onSubmit={comecar} className="form-stack section-gap">
          <p className="muted">
            {modo === 'refazer'
              ? 'Gerar códigos novos invalida os dez anteriores na hora. Pedimos a senha para garantir que é você.'
              : 'Ligar a verificação muda o jeito de entrar na sua conta. Pedimos a senha de novo para garantir que é você — e não alguém que encontrou este computador aberto.'}
          </p>
          <CampoDeTexto rotulo="Senha" type="password" autoComplete="current-password" autoFocus required value={senha} onChange={(e) => setSenha(e.target.value)} />
          <Botao type="submit" ocupado={enviando}>Continuar</Botao>
        </form>
      ) : null}

      {passo === 'codigo' && dados ? (
        <div className="form-grid section-gap">
          {/*
           * <img>, e não SVG embutido: SVG dentro do DOM executa script,
           * dentro de <img> não. O conteúdo é nosso, mas o contexto
           * restrito custa a mesma linha.
           */}
          <img src={`data:image/svg+xml;utf8,${encodeURIComponent(dados.qrSvg)}`} alt="QR para ler no aplicativo autenticador" width={220} height={220} className="qr-do-mfa" />
          <form onSubmit={ativar} className="form-stack">
            <div>
              <h3><Smartphone size={15} /> Leia o código com seu aplicativo</h3>
              <p className="muted small">Serve qualquer um: Google Authenticator, Microsoft Authenticator, 1Password, Authy. Abra o aplicativo, escolha adicionar conta e aponte a câmera.</p>
            </div>
            <div className="field">
              <div className="field-title">Se a câmera não ajudar, digite esta chave</div>
              <code className="chave-do-mfa">{dados.segredo}</code>
            </div>
            <CampoDeTexto
              rotulo="Agora digite o código que ele mostra"
              className="codigo-de-seis"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
            />
            <Botao type="submit" ocupado={enviando}>Ativar verificação</Botao>
          </form>
        </div>
      ) : null}

      {passo === 'codigos' ? (
        <div className="form-stack section-gap">
          <p className="muted">
            São a sua saída se você perder o telefone. Cada um serve <strong>uma vez</strong>, e eles <strong>não aparecem de novo</strong> — salve num
            gerenciador de senhas ou imprima.{modo === 'refazer' ? ' Os dez códigos anteriores deixaram de valer agora.' : ''}
          </p>
          <div className="codigos-de-recuperacao">{recuperacao.map((c) => <span key={c}>{c}</span>)}</div>
          <div className="actions">
            <Botao variante="secundario" onClick={() => void copiar()}>{copiou ? <Check size={14} /> : <Copy size={14} />}{copiou ? 'Copiados' : 'Copiar os dez'}</Botao>
            <Botao onClick={aoFechar}>Já guardei, concluir</Botao>
          </div>
        </div>
      ) : null}
    </section>
  )
}
