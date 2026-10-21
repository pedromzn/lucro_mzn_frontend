/**
 * Os dados da empresa — os mesmos em todos os aplicativos da MZN, porque moram
 * no Núcleo. O que só servia ao MKT (logo das páginas, documentos públicos dos
 * formulários de captura) ficou de fora.
 *
 * O apelido na URL não muda por aqui: no MKT ele já está em endereços de
 * páginas publicadas, e trocá-lo quebraria links que o cliente distribuiu.
 */

import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { nucleoApi, type DadosDaEmpresa as Dados } from '@/lib/api'
import { toast } from '@/lib/avisos'
import { useSessao } from '@/lib/sessao'
import { Aviso, Botao, CampoDeTexto, Selecao, data, erroDe } from '@/components/ui'

const FUSOS = ['America/Sao_Paulo', 'America/Manaus', 'America/Belem', 'America/Fortaleza', 'America/Recife', 'America/Cuiaba', 'America/Rio_Branco', 'UTC']
const IDIOMAS = [{ valor: 'pt-BR', rotulo: 'Português (Brasil)' }, { valor: 'en-US', rotulo: 'English (US)' }, { valor: 'es-ES', rotulo: 'Español' }]
const MOEDAS = [{ valor: 'BRL', rotulo: 'Real brasileiro (R$)' }, { valor: 'USD', rotulo: 'Dólar americano (US$)' }, { valor: 'EUR', rotulo: 'Euro (€)' }]
const CAMPOS_DO_ENDERECO = [
  ['logradouro', 'Logradouro'], ['numero', 'Número'], ['complemento', 'Complemento'], ['bairro', 'Bairro'], ['cidade', 'Cidade'], ['uf', 'UF'], ['cep', 'CEP'],
] as const

export function DadosDaEmpresa() {
  const ehGestor = useSessao((s) => s.ehGestor())
  const recarregarSessao = useSessao((s) => s.recarregar)
  const [dados, setDados] = useState<Dados | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [sujo, setSujo] = useState(false)

  useEffect(() => {
    nucleoApi.empresa().then(setDados).catch((e) => toast.error(erroDe(e, 'Não foi possível carregar.')))
  }, [])

  if (!dados) return <div className="skeleton loading-title" />
  const mexer = (campos: Partial<Dados>) => { setDados({ ...dados, ...campos }); setSujo(true) }
  const endereco = dados.endereco ?? {}
  const bloqueado = !ehGestor

  async function salvar() {
    if (!dados) return
    setSalvando(true)
    try {
      const { nome_fantasia, razao_social, cnpj, email, telefone, endereco, dominio, url_termos, url_privacidade, logo_url, pais, timezone, locale, moeda } = dados
      setDados(await nucleoApi.salvarEmpresa({ nome_fantasia, razao_social, cnpj, email, telefone, endereco, dominio, url_termos, url_privacidade, logo_url, pais, timezone, locale, moeda }))
      setSujo(false)
      toast.success('Dados da empresa salvos.')
      /* o nome aparece na barra lateral, que lê da sessão */
      await recarregarSessao()
    } catch (e) {
      toast.error(erroDe(e, 'Não foi possível salvar.'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      {bloqueado ? <Aviso>Só o responsável e os administradores editam estes dados.</Aviso> : null}
      <section className="panel">
        <h2>Identificação</h2>
        <p className="muted">Os dados da empresa são os mesmos em todos os aplicativos da MZN.</p>
        <div className="form-grid section-gap">
          <CampoDeTexto rotulo="Nome da empresa" value={dados.nome_fantasia} disabled={bloqueado} onChange={(e) => mexer({ nome_fantasia: e.target.value })} />
          <CampoDeTexto rotulo="Razão social" value={dados.razao_social ?? ''} disabled={bloqueado} onChange={(e) => mexer({ razao_social: e.target.value })} />
          <CampoDeTexto rotulo="CNPJ" value={dados.cnpj ?? ''} disabled={bloqueado} placeholder="00.000.000/0001-00" onChange={(e) => mexer({ cnpj: e.target.value })} />
          <CampoDeTexto rotulo="E-mail administrativo" type="email" value={dados.email ?? ''} disabled={bloqueado} dica="Para avisos de conta e de licença." onChange={(e) => mexer({ email: e.target.value })} />
          <CampoDeTexto rotulo="Telefone" value={dados.telefone ?? ''} disabled={bloqueado} onChange={(e) => mexer({ telefone: e.target.value })} />
        </div>
      </section>
      <section className="panel section-gap">
        <h2>Endereço</h2>
        <div className="form-grid section-gap">
          {CAMPOS_DO_ENDERECO.map(([campo, rotulo]) => (
            <CampoDeTexto
              key={campo}
              rotulo={rotulo}
              value={endereco[campo] ?? ''}
              maxLength={campo === 'uf' ? 2 : undefined}
              disabled={bloqueado}
              onChange={(e) => mexer({ endereco: { ...endereco, [campo]: campo === 'uf' ? e.target.value.toUpperCase() : e.target.value } })}
            />
          ))}
        </div>
      </section>
      <section className="panel section-gap">
        <h2>Região e formato</h2>
        <div className="form-grid section-gap">
          <Selecao rotulo="Fuso horário" valor={dados.timezone} aoMudar={(timezone) => mexer({ timezone })} opcoes={FUSOS} />
          <Selecao rotulo="Idioma" valor={dados.locale} aoMudar={(locale) => mexer({ locale })} opcoes={IDIOMAS} />
          <Selecao rotulo="Moeda" valor={dados.moeda} aoMudar={(moeda) => mexer({ moeda })} opcoes={MOEDAS} />
          <CampoDeTexto rotulo="País" maxLength={2} value={dados.pais} disabled={bloqueado} onChange={(e) => mexer({ pais: e.target.value.toUpperCase() })} />
        </div>
        <dl className="review-list section-gap">
          <div><dt>Identificador da empresa</dt><dd>{dados.id}</dd></div>
          <div><dt>Apelido na URL</dt><dd>{dados.slug}</dd></div>
          <div><dt>Criada em</dt><dd>{data(dados.criada_em)}</dd></div>
        </dl>
      </section>
      {ehGestor ? (
        <div className="form-footer">
          <Botao ocupado={salvando} disabled={!sujo} onClick={() => void salvar()}><Save size={16} />Salvar dados da empresa</Botao>
        </div>
      ) : null}
    </>
  )
}
