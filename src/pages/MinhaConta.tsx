/**
 * Minha conta — o `account.tsx` do mock, com as mesmas abas e a mesma marcação.
 * O que cada aba faz mudou de dono, porque a conta é da SUÍTE:
 *
 * - **Perfil**: nome e e-mail são do Núcleo (a empresa se edita em Sua
 *   empresa); as preferências são deste app e desta pessoa;
 * - **Assinatura**: a situação vem do Núcleo, e assinar ou mudar é na loja —
 *   faturas e notas também moram lá, como no MKT;
 * - **Segurança**: a senha e o MFA são os da suíte. O mock listava as sessões;
 *   aqui sair encerra a sessão em TODOS os aparelhos (AGENTS.md §6);
 * - **Privacidade e Suporte**: o mock tinha chamados dentro do app; aqui é o
 *   e-mail da MZN, que atende todos os aplicativos.
 */

import { BaixarArquivo } from '@/components/ArquivosDoEspaco'
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, KeyRound, LifeBuoy, LogOut, ShieldCheck, Trash2 } from 'lucide-react'
import { REGIMES_TRIBUTARIOS } from '@shared/contratos'
import { EMAIL_DO_SUPORTE } from '@shared/ajuda'
import { autenticacao, useSessao } from '@/lib/sessao'
import { URL_DA_LOJA, enderecos, lucroApi } from '@/lib/api'
import { agir, usePainel } from '@/lib/painel'
import { toast } from '@/lib/avisos'
import { useAssinatura } from '@/loja/estadoDaAssinatura'
import { LINKS_LEGAIS } from '@/acesso/CaixaDosTermos'
import { MfaSecao } from '@/conta/MfaSecao'
import { Aviso, Botao, CampoDeTexto, Selecao, Selo, data } from '@/components/ui'
import { ForcaDaSenha } from './DefinirSenha'

const ABAS = [['perfil', 'Perfil e negócio'], ['assinatura', 'Assinatura'], ['seguranca', 'Segurança'], ['privacidade', 'Privacidade'], ['suporte', 'Suporte']] as const
type Aba = (typeof ABAS)[number][0]
const ASSUNTOS = ['Dúvida sobre cálculo', 'Estoque e vendas', 'Etiquetas e impressão', 'Ajuda com acesso', 'Assinatura e pagamento', 'Privacidade e dados', 'Problema técnico', 'Outro assunto']
const FORTE = (s: string) => s.length >= 8 && /[a-zA-Z]/.test(s) && /[0-9]/.test(s)

export default function MinhaConta() {
  const [params, setParams] = useSearchParams()
  const pedida = params.get('secao')
  const aba: Aba = ABAS.some(([id]) => id === pedida) ? (pedida as Aba) : 'perfil'
  const irPara = (id: Aba) => setParams(id === 'perfil' ? {} : { secao: id }, { replace: true })

  return (
    <>
      <div className="subnav">
        {ABAS.map(([id, rotulo]) => <button key={id} className={aba === id ? 'active' : ''} onClick={() => irPara(id)}>{rotulo}</button>)}
      </div>
      <div className="account-content">
        {aba === 'perfil' ? <Perfil /> : null}
        {aba === 'assinatura' ? <Assinatura /> : null}
        {aba === 'seguranca' ? <Seguranca /> : null}
        {aba === 'privacidade' ? <Privacidade aoPedir={() => irPara('suporte')} /> : null}
        {aba === 'suporte' ? <Suporte /> : null}
      </div>
    </>
  )
}

function Perfil() {
  const { retrato, ehGestor } = useSessao()
  const estado = usePainel((s) => s.estado)
  const navegar = useNavigate()
  const preferir = (parte: Parameters<typeof lucroApi.preferencias>[0]) => void agir(() => lucroApi.preferencias(parte), 'Preferência salva.')
  if (!retrato) return null
  return (
    <section className="panel">
      <h2>Seu negócio, do seu jeito.</h2>
      <div className="form-stack section-gap">
        <div className="form-grid">
          <CampoDeTexto rotulo="Seu nome" value={retrato.usuario.nome} readOnly />
          <CampoDeTexto rotulo="Nome do negócio" value={retrato.empresa.nome} readOnly />
        </div>
        <CampoDeTexto rotulo="E-mail da conta" value={retrato.usuario.email} readOnly />
        {ehGestor() ? (
          <p className="small muted">Para mudar o nome do negócio ou convidar pessoas, abra <button className="text-link" onClick={() => navegar('/empresa')}>Sua empresa</button>.</p>
        ) : null}
      </div>
      {estado ? (
        <>
          <hr />
          <h3>Preferências</h3>
          <div className="form-stack">
            <Selecao
              rotulo="Regime tributário"
              valor={estado.preferencias.regimeTributario ?? 'Não sei'}
              aoMudar={(v) => preferir({ regimeTributario: v })}
              opcoes={REGIMES_TRIBUTARIOS}
              dica="Este campo não preenche alíquotas automaticamente. Você pode simular com a alíquota efetiva informada pelo seu contador."
            />
            <Selecao
              rotulo="Canal favorito"
              valor={estado.preferencias.canalFavorito ?? ''}
              aoMudar={(v) => preferir({ canalFavorito: v })}
              opcoes={[{ valor: '', rotulo: 'Nenhum' }, ...estado.canais.map((c) => ({ valor: c.id, rotulo: c.nome }))]}
            />
            <label className="check">
              <input type="checkbox" checked={estado.preferencias.dicas !== false} onChange={(e) => preferir({ dicas: e.target.checked })} />
              Exibir dicas do modo de aprendizado.
            </label>
            {estado.podeEscrever ? <Botao variante="fantasma" onClick={() => preferir({ primeirosPassos: false })}>Refazer primeiros passos</Botao> : null}
          </div>
        </>
      ) : null}
    </section>
  )
}

/** O retrato da assinatura, lido do Núcleo; mudar plano, licenças ou forma de pagar é na loja, como no MKT. */
function Assinatura() {
  const situacao = useAssinatura((s) => s.situacao)
  const loja = `${URL_DA_LOJA}/app/lucro`
  if (!situacao) {
    return (
      <section className="panel">
        <h2>Sua assinatura</h2>
        <p className="muted">Não foi possível ler a assinatura agora. Ela também aparece na loja da MZN.</p>
        <div className="actions section-gap"><a className="btn secondary" href={loja}>Abrir a loja</a></div>
      </section>
    )
  }
  const emAvaliacao = situacao.status === 'trial'
  const ateQuando = emAvaliacao ? situacao.trialExpiraEm : situacao.periodoFim
  return (
    <section className="panel license-panel">
      <ShieldCheck size={34} />
      <h2>{emAvaliacao ? 'Você está no período de avaliação.' : situacao.ativa ? 'Assinatura ativa.' : 'Sua assinatura não está valendo.'}</h2>
      {situacao.planoNome ? <Selo tom={situacao.ativa ? 'verde' : 'ambar'}>LucroCerto · {situacao.planoNome}</Selo> : null}
      <p>
        {emAvaliacao
          ? `${ateQuando ? `Use à vontade até ${data(ateQuando)}. ` : ''}Para continuar depois, escolha um plano na loja — seus produtos e o estoque continuam onde estão.`
          : situacao.ativa
            ? `${situacao.assentos} ${situacao.assentos === 1 ? 'licença' : 'licenças'}, cobrança ${situacao.ciclo === 'anual' ? 'anual' : 'mensal'}.${ateQuando ? ` ${situacao.cancelarNoFim ? 'Termina' : 'Renova'} em ${data(ateQuando)}.` : ''}`
            : 'Escolha um plano na loja para voltar a usar o LucroCerto. Seus dados continuam aqui.'}
      </p>
      <a className="btn secondary" href={loja}>{emAvaliacao || !situacao.ativa ? 'Ver planos na loja' : 'Gerenciar na loja'}</a>
      <p className="small muted section-gap">Plano, licenças, faturas e forma de pagamento ficam na loja da MZN, junto com os dos outros aplicativos da sua empresa.</p>
    </section>
  )
}

function Seguranca() {
  const sair = useSessao((s) => s.sair)
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  /* trocar a senha derruba as outras sessões — é o que a pessoa acha que está fazendo, e a tela avisa antes */
  async function trocar(evento: FormEvent) {
    evento.preventDefault()
    setSalvando(true)
    try {
      await autenticacao.trocarSenha(atual, nova)
      toast.success('Senha trocada. Entre novamente.')
      location.href = '/entrar'
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível trocar a senha.')
      setSalvando(false)
    }
  }

  return (
    <>
      <section className="panel">
        <h2>Senha</h2>
        <p className="muted">Ao trocar, todas as outras sessões suas são encerradas — inclusive em outros aparelhos.</p>
        <form className="form-stack section-gap" onSubmit={trocar}>
          <CampoDeTexto rotulo="Senha atual" type="password" autoComplete="current-password" required value={atual} onChange={(e) => setAtual(e.target.value)} />
          <div>
            <CampoDeTexto rotulo="Nova senha" type="password" autoComplete="new-password" required value={nova} onChange={(e) => setNova(e.target.value)} />
            <ForcaDaSenha senha={nova} />
          </div>
          <CampoDeTexto rotulo="Repita a nova senha" type="password" autoComplete="new-password" required value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
          <Botao type="submit" ocupado={salvando} disabled={!FORTE(nova) || nova !== confirmacao || !atual}><KeyRound size={16} />Alterar senha</Botao>
        </form>
      </section>
      <MfaSecao />
      <section className="panel section-gap between">
        <div>
          <h2>Dispositivos e sessões</h2>
          <p className="muted small">Sair encerra a sua sessão em todos os aparelhos, neste e nos outros aplicativos da MZN.</p>
        </div>
        <Botao variante="fantasma" onClick={async () => { try { await sair(); location.href = '/entrar' } catch (erro) { toast.error(erro instanceof Error ? erro.message : 'Não foi possível encerrar as sessões. Tente novamente.') } }}><LogOut size={16} />Sair de todos os aparelhos</Botao>
      </section>
    </>
  )
}

function Privacidade({ aoPedir }: { aoPedir: () => void }) {
  const assunto = encodeURIComponent('[LucroCerto] Exclusão da minha conta')
  return (
    <section className="panel">
      <h2>Seus dados pertencem a você.</h2>
      <p className="muted">Exporte seus registros ou solicite esclarecimentos sobre o tratamento dos seus dados.</p>
      <div className="actions section-gap">
        <BaixarArquivo className="btn secondary"  caminho={enderecos.exportar('json')}><Download size={16} />Baixar meus dados</BaixarArquivo>
        <Botao variante="fantasma" onClick={aoPedir}>Solicitação de privacidade</Botao>
      </div>
      <hr />
      <h3>Excluir minha conta</h3>
      <p>
        A conta é da MZN e vale para todos os aplicativos da sua empresa. Para excluí-la, escreva para o nosso contato a partir do e-mail
        da conta: conferimos o pedido e apagamos os dados conforme o Aviso de Privacidade. Faça uma exportação antes.
      </p>
      <a className="btn danger" href={`mailto:${EMAIL_DO_SUPORTE}?subject=${assunto}`}><Trash2 size={16} />Pedir a exclusão da conta</a>
      <p className="small muted section-gap">
        Consulte o <a href={LINKS_LEGAIS.privacidade} target="_blank" rel="noopener noreferrer">Aviso de Privacidade</a> e os critérios de retenção.
      </p>
    </section>
  )
}

function Suporte() {
  const [assunto, setAssunto] = useState(ASSUNTOS[0])
  const [mensagem, setMensagem] = useState('')
  const abrirEmail = (evento: FormEvent) => {
    evento.preventDefault()
    location.href = `mailto:${EMAIL_DO_SUPORTE}?subject=${encodeURIComponent(`[LucroCerto] ${assunto}`)}&body=${encodeURIComponent(mensagem)}`
  }
  return (
    <section className="panel">
      <h2>Como podemos ajudar?</h2>
      <p className="muted">Escreva sua dúvida: ela abre no seu e-mail, endereçada a {EMAIL_DO_SUPORTE}, e a resposta chega na sua caixa.</p>
      <form className="form-stack section-gap" onSubmit={abrirEmail}>
        <Selecao rotulo="Assunto" valor={assunto} aoMudar={setAssunto} opcoes={ASSUNTOS} />
        <div className="field">
          <label htmlFor="mensagem-ao-suporte">Conte o que aconteceu</label>
          <textarea
            id="mensagem-ao-suporte"
            minLength={10}
            maxLength={2000}
            required
            rows={5}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Inclua o produto relacionado. Não envie senhas nem dados de cartão."
          />
        </div>
        <Botao type="submit"><LifeBuoy size={16} />Escrever para o suporte</Botao>
      </form>
      <Aviso>Prefere copiar? O endereço é <strong>{EMAIL_DO_SUPORTE}</strong>.</Aviso>
    </section>
  )
}
