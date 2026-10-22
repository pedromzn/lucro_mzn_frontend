/**
 * As sessões da pessoa — onde a conta está aberta (22/10/2026, "igual temos na
 * Zoho"). Duas telas usam:
 *
 * - **Segurança, em Minha conta**: a lista, com "Encerrar" em cada sessão,
 *   "Encerrar as outras" e "Encerrar todas" (esta inclusive: a pessoa sai de
 *   todo lugar, e pede um segundo clique para confirmar).
 * - **O teto de 10, no login** (`EscolhaDeSessoes`): o Núcleo respondeu 409 com
 *   a lista e um desafio de cinco minutos; a pessoa marca o que encerrar e
 *   entra. Nada se encerra sozinho.
 *
 * As sessões são da SUÍTE: a lista mostra também as do Marketing Flow e da loja.
 */

import { useCallback, useEffect, useState } from 'react'
import { Laptop, LogOut, Smartphone } from 'lucide-react'
import { autenticacao, limiteDoErro, type LimiteDeSessoes, type RetratoDaSessao, type SessaoAberta } from '@/lib/sessao'
import { toast } from '@/lib/avisos'
import { Aviso, Botao, Selo } from '@/components/ui'

const NOMES_DOS_APPS: Record<string, string> = { mkt: 'Marketing Flow', lucro: 'LucroCerto', loja: 'Loja MZN' }

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function haQuanto(iso: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000))
  if (minutos < 5) return 'agora há pouco'
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.round(minutos / 60)
  return horas < 24 ? `há ${horas} h` : `em ${quando(iso)}`
}

function LinhaDaSessao({ s, acao }: { s: SessaoAberta; acao?: React.ReactNode }) {
  const Icone = s.sistema === 'iOS' || s.sistema === 'Android' ? Smartphone : Laptop
  return (
    <div className={`session-row${s.atual ? ' current' : ''}`}>
      <span className="session-icon"><Icone size={18} /></span>
      <div className="session-body">
        <strong>{s.navegador} no {s.sistema}{s.atual ? <Selo tom="verde">Esta sessão</Selo> : null}</strong>
        <small className="muted">
          {[s.aplicativo ? NOMES_DOS_APPS[s.aplicativo] ?? s.aplicativo : null, s.ip ? `IP ${s.ip}` : null, `entrou em ${quando(s.criadaEm)}`, `último uso ${haQuanto(s.ultimoUsoEm)}`]
            .filter(Boolean).join(' · ')}
        </small>
      </div>
      {acao}
    </div>
  )
}

/** a seção da aba Segurança */
export function SessoesAbertas() {
  const [sessoes, setSessoes] = useState<SessaoAberta[] | null>(null)
  const [limite, setLimite] = useState(10)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  /* "Encerrar todas" tira a pessoa daqui também: o primeiro clique só pede confirmação */
  const [confirmarTodas, setConfirmarTodas] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const r = await autenticacao.sessoes()
      setSessoes(r.sessoes)
      setLimite(r.limite)
      setErro('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar as sessões.')
    }
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  async function encerrar(id: string | 'outras') {
    setOcupado(id)
    try {
      const r = id === 'outras' ? await autenticacao.encerrarOutrasSessoes() : await autenticacao.encerrarSessao(id)
      toast.success(r.encerradas === 1 ? 'Sessão encerrada.' : `${r.encerradas} sessões encerradas.`)
      await carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível encerrar.')
    } finally {
      setOcupado(null)
    }
  }

  /* desarma sozinho: depender do foco não serve no Safari, onde o botão não ganha foco no clique */
  useEffect(() => {
    if (!confirmarTodas) return
    const relogio = setTimeout(() => setConfirmarTodas(false), 5000)
    return () => clearTimeout(relogio)
  }, [confirmarTodas])

  async function encerrarTodas() {
    if (!confirmarTodas) { setConfirmarTodas(true); return }
    setOcupado('todas')
    try {
      await autenticacao.encerrarTodasSessoes()
      location.href = '/entrar'
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível encerrar as sessões.')
      setOcupado(null)
      setConfirmarTodas(false)
    }
  }

  const outras = sessoes?.filter((s) => !s.atual).length ?? 0
  return (
    <section className="panel section-gap">
      <div className="between">
        <div>
          <h2>Sessões abertas</h2>
          <p className="muted small">
            Onde a sua conta está aberta agora, em todos os aplicativos da MZN. O máximo é {limite}: passou disso, o próximo login pede para
            encerrar alguma. Não reconhece uma sessão? Encerre e troque a senha.
          </p>
        </div>
        <div className="actions session-actions">
          {outras > 0 ? (
            <Botao variante="fantasma" ocupado={ocupado === 'outras'} onClick={() => void encerrar('outras')}>Encerrar as outras</Botao>
          ) : null}
          <Botao variante="perigo" ocupado={ocupado === 'todas'} onClick={() => void encerrarTodas()}>
            <LogOut size={16} />{confirmarTodas ? 'Confirmar: sair de todos os lugares' : 'Encerrar todas as sessões'}
          </Botao>
        </div>
      </div>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {sessoes === null && !erro ? <div className="skeleton section-gap" style={{ minHeight: 120 }} /> : null}
      {sessoes ? (
        <div className="session-list section-gap">
          {sessoes.map((s) => (
            <LinhaDaSessao
              key={s.id}
              s={s}
              acao={s.atual ? null : <Botao variante="fantasma" ocupado={ocupado === s.id} onClick={() => void encerrar(s.id)}>Encerrar</Botao>}
            />
          ))}
          <small className="muted">{sessoes.length} de {limite} sessões em uso.</small>
        </div>
      ) : null}
    </section>
  )
}

/**
 * O login parado no teto: a pessoa marca as sessões a encerrar e entra. Se
 * outro login ocupou a vaga no meio, o Núcleo recusa de novo com a lista nova;
 * se os cinco minutos passaram, volta para a senha.
 */
export function EscolhaDeSessoes({ limite: inicial, aoEntrar, aoVoltar }: {
  limite: LimiteDeSessoes
  aoEntrar: (r: RetratoDaSessao) => void
  aoVoltar: (motivo?: string) => void
}) {
  const [limite, setLimite] = useState(inicial)
  /* a mais antiga em uso já vem marcada: é a escolha mais comum, e a pessoa troca se quiser */
  const [marcadas, setMarcadas] = useState<string[]>(() => {
    const maisAntiga = [...inicial.sessoes].sort((a, b) => Date.parse(a.ultimoUsoEm) - Date.parse(b.ultimoUsoEm))[0]
    return maisAntiga ? [maisAntiga.id] : []
  })
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function liberar() {
    setOcupado(true)
    setErro('')
    try {
      aoEntrar(await autenticacao.liberarSessoes(limite.desafio, marcadas))
    } catch (e) {
      const denovo = limiteDoErro(e)
      if (denovo) {
        setLimite(denovo)
        setMarcadas([])
        setErro('Ainda não há vaga: outra sessão foi aberta enquanto você escolhia. Encerre mais uma.')
      } else if ((e as { codigo?: string }).codigo === 'desafio_invalido') {
        aoVoltar('Os cinco minutos para escolher passaram. Entre de novo.')
      } else {
        setErro(e instanceof Error ? e.message : 'Não foi possível encerrar as sessões.')
      }
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="form-stack">
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <div className="session-list">
        {limite.sessoes.map((s) => (
          <label key={s.id} className={`session-pick${marcadas.includes(s.id) ? ' marked' : ''}`}>
            <input
              type="checkbox"
              checked={marcadas.includes(s.id)}
              onChange={(e) => setMarcadas(e.target.checked ? [...marcadas, s.id] : marcadas.filter((id) => id !== s.id))}
            />
            <LinhaDaSessao s={s} />
          </label>
        ))}
      </div>
      <Botao type="button" className="full-width" ocupado={ocupado} disabled={!marcadas.length} onClick={() => void liberar()}>
        Encerrar {marcadas.length === 1 ? 'a sessão marcada' : `as ${marcadas.length} sessões marcadas`} e entrar
      </Botao>
      <button type="button" className="text-link forgot-link" onClick={() => aoVoltar()}>Voltar</button>
    </div>
  )
}
