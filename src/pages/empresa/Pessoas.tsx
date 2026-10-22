/**
 * Pessoas e licenças — quem entra no Lucro Certo, com que papel e em quais
 * espaços. Convidar alguém CONSOME uma licença do app na hora, e por isso o
 * contador fica na mesma tela: separar faria a pessoa descobrir o limite só no
 * erro.
 *
 * **Só o Lucro Certo aparece aqui** (PLANO-LUCRO-CERTO.md, D5: cada app é um).
 * O Núcleo altera só as licenças deste app ao receber `x-aplicativo: lucro`.
 *
 * Os espaços de uma pessoa também são por app: marcar aqui mexe só nos espaços
 * do Lucro Certo (o Núcleo filtra pelo `x-aplicativo`).
 *
 * Sem e-mail configurado na plataforma o convite não falha: o link volta aqui
 * para o administrador mandar por onde quiser.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, KeyRound, Plus, RefreshCw, Trash2, UserCheck, UserMinus } from 'lucide-react'
import { nucleoApi, type EspacoDaEmpresa, type LicencaDeApp, type UsuarioDaEmpresa } from '@/lib/api'
import { APLICATIVO, useSessao } from '@/lib/sessao'
import { toast } from '@/lib/avisos'
import { Aviso, Botao, CampoDeTexto, Janela, Selo, Vazio, erroDe } from '@/components/ui'

const PAPEIS = [
  { id: 'super_admin', nome: 'Responsável', descricao: 'Tudo, inclusive licenças e outros responsáveis' },
  { id: 'admin', nome: 'Administrador', descricao: 'Gerencia a empresa e também os outros apps MZN' },
  { id: 'membro', nome: 'Membro', descricao: 'Só os espaços de trabalho que você marcar' },
] as const
type Papel = (typeof PAPEIS)[number]['id']

interface Rascunho {
  id?: string
  nome: string
  email: string
  cargo: string
  papel: Papel
  espacos: string[]
  /** o papel no Lucro Certo; `null` = sem acesso a este app */
  papelAqui: string | null
}

interface Convite { email: string; link: string; enviado: boolean; motivo: string | null }

export function Pessoas() {
  const eu = useSessao((s) => s.retrato)
  const [usuarios, setUsuarios] = useState<UsuarioDaEmpresa[]>([])
  const [licencas, setLicencas] = useState<LicencaDeApp[]>([])
  const [espacos, setEspacos] = useState<EspacoDaEmpresa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [convite, setConvite] = useState<Convite | null>(null)
  const [removendo, setRemovendo] = useState<UsuarioDaEmpresa | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const [u, l, e] = await Promise.all([nucleoApi.usuarios(), nucleoApi.licencas(), nucleoApi.espacos()])
      setUsuarios(u)
      setLicencas(l)
      setEspacos(e.filter((x) => !x.arquivado_em))
    } catch (e) {
      toast.error(erroDe(e, 'Não foi possível carregar.'))
    } finally {
      setCarregando(false)
    }
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  const licenca = useMemo(() => licencas.find((l) => l.aplicativo === APLICATIVO), [licencas])
  const assentos = licenca?.assentos
  const podeMexerEm = (alvo: UsuarioDaEmpresa) => alvo.papel !== 'super_admin' || eu?.papel === 'super_admin'
  const papelPadrao = licenca?.papeis[0]?.id ?? 'operador'
  const nomeDoPapel = (id: string) => licenca?.papeis.find((p) => p.id === id)?.nome ?? id

  const novo = () =>
    setRascunho({
      nome: '', email: '', cargo: '', papel: 'membro', espacos: espacos.filter((e) => e.padrao).map((e) => e.id),
      papelAqui: assentos && assentos.disponiveis > 0 ? papelPadrao : null,
    })
  const editar = (u: UsuarioDaEmpresa) =>
    setRascunho({
      id: u.id, nome: u.nome, email: u.email, cargo: u.cargo ?? '', papel: u.papel, espacos: u.espacos?.map((e) => e.id) ?? [],
      papelAqui: u.aplicativos.find((a) => a.aplicativo === APLICATIVO)?.papel_no_app ?? null,
    })

  async function salvar() {
    if (!rascunho) return
    setOcupado(true)
    const aplicativos = (rascunho.papelAqui ? [{ aplicativo: APLICATIVO, papel_no_app: rascunho.papelAqui }] : [])
    const corpo = {
      nome: rascunho.nome.trim(), papel: rascunho.papel, cargo: rascunho.cargo.trim() || null,
      espacos: rascunho.papel === 'membro' ? rascunho.espacos : [], aplicativos,
    }
    try {
      if (rascunho.id) {
        await nucleoApi.atualizarUsuario(rascunho.id, corpo)
        toast.success('Acesso atualizado.')
      } else {
        const r = await nucleoApi.convidar({ ...corpo, email: rascunho.email.trim() })
        if (r.convite.link) setConvite({ email: r.email, link: r.convite.link, enviado: r.convite.enviado, motivo: r.convite.motivo })
        toast.success(r.convite.enviado ? 'Convite enviado por e-mail.' : 'Pessoa adicionada.')
      }
      setRascunho(null)
      await carregar()
    } catch (e) {
      toast.error(erroDe(e, 'Não foi possível salvar.'))
    } finally {
      setOcupado(false)
    }
  }

  async function acao(rotulo: string, executar: () => Promise<unknown>) {
    try {
      await executar()
      toast.success(rotulo)
      await carregar()
    } catch (e) {
      toast.error(erroDe(e))
    }
  }

  return (
    <>
      <section className="panel">
        <div className="between">
          <div>
            <h2>Licenças do LucroCerto</h2>
            <p className="muted small">Cada pessoa com acesso ao LucroCerto usa uma licença. Desativar alguém devolve a licença.</p>
          </div>
          <Botao onClick={novo}><Plus size={16} />Convidar pessoa</Botao>
        </div>
        {assentos ? (
          <>
            <div className="metric-grid section-gap">
              <div className="metric"><span>Licenças contratadas</span><strong>{assentos.contratados}</strong><small>{licenca?.plano ?? 'Plano da assinatura'}</small></div>
              <div className="metric"><span>Em uso</span><strong>{assentos.usados}</strong><small>Pessoas com acesso ativo</small></div>
              <div className="metric"><span>Disponíveis</span><strong>{assentos.disponiveis}</strong><small>{assentos.disponiveis ? 'Prontas para um convite' : 'Libere mais na loja'}</small></div>
            </div>
          </>
        ) : (
          <Aviso>A empresa ainda não tem licença do LucroCerto. Compre na loja para liberar acesso à sua equipe.</Aviso>
        )}
      </section>

      <section className="panel section-gap">
        <h2>Pessoas ({usuarios.length})</h2>
        {carregando ? <div className="skeleton loading-title" /> : null}
        {!carregando && !usuarios.length ? <Vazio titulo="Ninguém por aqui ainda.">Convide alguém da sua equipe.</Vazio> : null}
        <div className="session-list section-gap">
          {usuarios.map((u) => {
            const souEu = u.id === eu?.usuario.id
            const aqui = u.aplicativos.find((a) => a.aplicativo === APLICATIVO)
            return (
              <div key={u.id}>
                <span className="avatar">{u.nome.trim().slice(0, 1).toUpperCase()}</span>
                <div>
                  <strong>{u.nome}{souEu ? ' (você)' : ''}</strong>
                  <small>{u.email}{u.cargo ? ` · ${u.cargo}` : ''}</small>
                  <small>
                    {PAPEIS.find((p) => p.id === u.papel)?.nome} ·{' '}
                    {u.espacos === null ? 'todos os espaços' : u.espacos.length ? u.espacos.map((e) => e.nome).join(', ') : 'nenhum espaço'}
                  </small>
                </div>
                <div className="actions">
                  <Selo tom={u.status === 'suspenso' ? 'vermelho' : u.convite_pendente ? 'ambar' : 'verde'}>
                    {u.status === 'suspenso' ? 'Desativado' : u.convite_pendente ? 'Convidado' : 'Ativo'}
                  </Selo>
                  <Selo tom={aqui ? 'roxo' : 'neutro'}>{aqui ? nomeDoPapel(aqui.papel_no_app) : 'Sem acesso ao LucroCerto'}</Selo>
                  {podeMexerEm(u) ? (
                    <>
                      <button className="icon-button" aria-label={`Editar acesso de ${u.nome}`} onClick={() => editar(u)}><KeyRound size={16} /></button>
                      {u.convite_pendente ? (
                        <button
                          className="icon-button"
                          aria-label="Reenviar convite"
                          onClick={() =>
                            void acao('Convite reenviado.', async () => {
                              const r = await nucleoApi.reenviarConvite(u.id)
                              if (r.link) setConvite({ email: u.email, link: r.link, enviado: r.enviado, motivo: r.motivo })
                            })
                          }
                        >
                          <RefreshCw size={16} />
                        </button>
                      ) : null}
                      {souEu ? null : u.status === 'suspenso' ? (
                        <button className="icon-button" aria-label="Reativar" onClick={() => void acao('Pessoa reativada.', () => nucleoApi.reativarUsuario(u.id))}><UserCheck size={16} /></button>
                      ) : (
                        <button className="icon-button" aria-label="Desativar" onClick={() => void acao('Pessoa desativada. A licença voltou.', () => nucleoApi.desativarUsuario(u.id))}><UserMinus size={16} /></button>
                      )}
                      {souEu ? null : <button className="icon-button" aria-label="Remover da empresa" onClick={() => setRemovendo(u)}><Trash2 size={16} /></button>}
                    </>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <Janela aberta={!!removendo} aoFechar={() => setRemovendo(null)} titulo="Remover da empresa?" descricao="A pessoa perde o acesso a todos os aplicativos da MZN. O histórico do que ela fez é preservado.">
        <p>{removendo?.nome} · {removendo?.email}</p>
        <div className="dialog-actions">
          <Botao variante="fantasma" onClick={() => setRemovendo(null)}>Cancelar</Botao>
          <Botao variante="perigo" onClick={() => { const u = removendo!; setRemovendo(null); void acao('Removida da empresa.', () => nucleoApi.removerUsuario(u.id)) }}>Remover</Botao>
        </div>
      </Janela>

      <Janela
        aberta={!!convite}
        aoFechar={() => setConvite(null)}
        titulo={convite?.enviado ? 'Convite enviado' : 'Convite criado, e-mail não enviado'}
        descricao={convite?.enviado ? `O acesso de ${convite.email} foi enviado por e-mail.` : (convite?.motivo ?? undefined)}
      >
        <CampoDeTexto rotulo="Link de primeiro acesso" value={convite?.link ?? ''} readOnly />
        <div className="dialog-actions">
          <Botao variante="secundario" onClick={() => { void navigator.clipboard.writeText(convite!.link); toast.success('Link copiado.') }}><Copy size={16} />Copiar link</Botao>
          <Botao onClick={() => setConvite(null)}>Fechar</Botao>
        </div>
      </Janela>

      <Janela aberta={!!rascunho} aoFechar={() => setRascunho(null)} titulo={rascunho?.id ? 'Editar acesso' : 'Convidar pessoa'} larga>
        {rascunho ? (
          <div className="form-stack">
            <div className="form-grid">
              <CampoDeTexto rotulo="Nome" value={rascunho.nome} autoFocus onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })} />
              <CampoDeTexto rotulo="Cargo (opcional)" value={rascunho.cargo} onChange={(e) => setRascunho({ ...rascunho, cargo: e.target.value })} />
            </div>
            <CampoDeTexto
              rotulo="E-mail"
              type="email"
              disabled={Boolean(rascunho.id)}
              value={rascunho.email}
              onChange={(e) => setRascunho({ ...rascunho, email: e.target.value })}
              dica={rascunho.id ? 'O e-mail é a identidade da pessoa na MZN e não muda por aqui.' : 'É para cá que vai o convite de primeiro acesso.'}
            />
            <fieldset>
              <legend>Papel na empresa</legend>
              <div className="onboarding-choices">
                {PAPEIS.filter((p) => p.id !== 'super_admin' || eu?.papel === 'super_admin').map((p) => (
                  <button key={p.id} className={rascunho.papel === p.id ? 'active' : ''} onClick={() => setRascunho({ ...rascunho, papel: p.id })}>
                    <span><strong>{p.nome}</strong><br /><small>{p.descricao}</small></span>
                  </button>
                ))}
              </div>
            </fieldset>
            {rascunho.papel === 'membro' ? (
              <fieldset>
                <legend>Espaços de trabalho do LucroCerto</legend>
                <div className="help-categories">
                  {espacos.map((e) => {
                    const marcado = rascunho.espacos.includes(e.id)
                    return (
                      <button
                        key={e.id}
                        aria-pressed={marcado}
                        className={marcado ? 'active' : ''}
                        onClick={() => setRascunho({ ...rascunho, espacos: marcado ? rascunho.espacos.filter((id) => id !== e.id) : [...rascunho.espacos, e.id] })}
                      >
                        {e.nome}
                      </button>
                    )
                  })}
                </div>
                {!rascunho.espacos.length ? <Aviso tipo="atencao">Sem nenhum espaço marcado, esta pessoa entra e não vê nada.</Aviso> : null}
              </fieldset>
            ) : (
              <Aviso>Responsáveis e administradores enxergam todos os espaços de trabalho, inclusive os que forem criados depois.</Aviso>
            )}
            <fieldset>
              <legend>Acesso ao LucroCerto</legend>
              <label className="check">
                <input
                  type="checkbox"
                  checked={rascunho.papelAqui !== null}
                  disabled={rascunho.papelAqui === null && (!assentos || assentos.disponiveis === 0)}
                  onChange={(e) => setRascunho({ ...rascunho, papelAqui: e.target.checked ? papelPadrao : null })}
                />
                Liberar o LucroCerto para esta pessoa (usa uma licença){assentos && assentos.disponiveis === 0 && rascunho.papelAqui === null ? ' — sem licença livre' : ''}.
              </label>
              {rascunho.papelAqui !== null && licenca?.papeis.length ? (
                <div className="segmented section-gap">
                  {licenca.papeis.map((p) => (
                    <button key={p.id} title={p.descricao} className={rascunho.papelAqui === p.id ? 'active' : ''} onClick={() => setRascunho({ ...rascunho, papelAqui: p.id })}>{p.nome}</button>
                  ))}
                </div>
              ) : null}
            </fieldset>
            <div className="dialog-actions">
              <Botao variante="fantasma" onClick={() => setRascunho(null)}>Cancelar</Botao>
              <Botao ocupado={ocupado} disabled={rascunho.nome.trim().length < 2 || (!rascunho.id && !rascunho.email.trim())} onClick={() => void salvar()}>
                {rascunho.id ? 'Salvar' : 'Convidar'}
              </Botao>
            </div>
          </div>
        ) : null}
      </Janela>
    </>
  )
}
