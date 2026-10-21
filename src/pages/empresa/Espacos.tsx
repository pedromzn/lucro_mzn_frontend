/**
 * Espaços de trabalho do Lucro Certo. Um espaço separa o trabalho — uma loja,
 * uma marca, um cliente —, e cada produto, canal, estoque e etiqueta pertence
 * a um. Os espaços são POR APP desde 21/10/2026: os do Marketing Flow não
 * aparecem aqui, e o teto é o da licença deste app.
 *
 * Arquivar em vez de excluir: o que estava no espaço continua guardado e
 * apontando para ele. Apagar a linha deixaria tudo aquilo órfão e invisível.
 */

import { useCallback, useEffect, useState } from 'react'
import { Archive, Pencil, Plus, Star } from 'lucide-react'
import { nucleoApi, type EspacoDaEmpresa } from '@/lib/api'
import { useSessao } from '@/lib/sessao'
import { toast } from '@/lib/avisos'
import { Botao, CampoDeTexto, Janela, Selo, erroDe } from '@/components/ui'

interface Rascunho { id?: string; nome: string; descricao: string }

export function Espacos() {
  const ehGestor = useSessao((s) => s.ehGestor())
  const espacoAtual = useSessao((s) => s.espacoAtual)
  const recarregarSessao = useSessao((s) => s.recarregar)
  const [espacos, setEspacos] = useState<EspacoDaEmpresa[]>([])
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [arquivando, setArquivando] = useState<EspacoDaEmpresa | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const carregar = useCallback(async () => {
    try {
      setEspacos(await nucleoApi.espacos())
    } catch (e) {
      toast.error(erroDe(e, 'Não foi possível carregar.'))
    }
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  /* a lista da barra lateral (trocar de espaço) vem da sessão: recarrega junto */
  async function agir(rotulo: string, executar: () => Promise<unknown>) {
    setOcupado(true)
    try {
      await executar()
      toast.success(rotulo)
      await Promise.all([carregar(), recarregarSessao()])
      return true
    } catch (e) {
      toast.error(erroDe(e))
      return false
    } finally {
      setOcupado(false)
    }
  }

  async function salvar() {
    if (!rascunho) return
    const corpo = { nome: rascunho.nome.trim(), descricao: rascunho.descricao.trim() }
    const ok = await agir(
      rascunho.id ? 'Espaço atualizado.' : 'Espaço criado.',
      () => (rascunho.id ? nucleoApi.salvarEspaco(rascunho.id, { ...corpo, descricao: corpo.descricao || null }) : nucleoApi.criarEspaco({ ...corpo, descricao: corpo.descricao || undefined })),
    )
    if (ok) setRascunho(null)
  }

  return (
    <>
      <div className="between">
        <p className="muted">Cada espaço tem o próprio catálogo, canais, estoque e etiquetas.</p>
        {ehGestor ? <Botao onClick={() => setRascunho({ nome: '', descricao: '' })}><Plus size={16} />Novo espaço</Botao> : null}
      </div>
      <div className="template-grid section-gap">
        {espacos.map((e) => (
          <section className="panel" key={e.id}>
            <div className="between">
              <h3>{e.nome}</h3>
              <span className="actions">
                {e.arquivado_em ? <Selo>Arquivado</Selo> : null}
                {e.padrao ? <Selo tom="roxo">Padrão</Selo> : null}
                {e.id === espacoAtual?.id ? <Selo tom="verde">Você está aqui</Selo> : null}
              </span>
            </div>
            <p className="small muted">
              {e.descricao || 'Sem descrição'}
              {e.membros !== null ? ` · ${e.membros} membro${e.membros === 1 ? '' : 's'} restrito${e.membros === 1 ? '' : 's'}` : ''}
            </p>
            {ehGestor && !e.arquivado_em ? (
              <div className="actions section-gap">
                {!e.padrao ? <Botao variante="fantasma" onClick={() => void agir('Espaço padrão alterado.', () => nucleoApi.salvarEspaco(e.id, { padrao: true }))}><Star size={15} />Tornar padrão</Botao> : null}
                <button className="icon-button" aria-label={`Editar ${e.nome}`} onClick={() => setRascunho({ id: e.id, nome: e.nome, descricao: e.descricao ?? '' })}><Pencil size={16} /></button>
                {!e.padrao ? <button className="icon-button" aria-label={`Arquivar ${e.nome}`} onClick={() => setArquivando(e)}><Archive size={16} /></button> : null}
              </div>
            ) : null}
          </section>
        ))}
      </div>

      <Janela aberta={!!rascunho} aoFechar={() => setRascunho(null)} titulo={rascunho?.id ? 'Editar espaço' : 'Novo espaço de trabalho'}>
        {rascunho ? (
          <div className="form-stack">
            <CampoDeTexto rotulo="Nome" autoFocus value={rascunho.nome} placeholder="Ex.: Loja do centro, Marca própria" onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })} />
            <CampoDeTexto rotulo="Descrição (opcional)" value={rascunho.descricao} placeholder="O que fica neste espaço" onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })} />
            <div className="dialog-actions">
              <Botao variante="fantasma" onClick={() => setRascunho(null)}>Cancelar</Botao>
              <Botao ocupado={ocupado} disabled={rascunho.nome.trim().length < 2} onClick={() => void salvar()}>{rascunho.id ? 'Salvar' : 'Criar espaço'}</Botao>
            </div>
          </div>
        ) : null}
      </Janela>
      <Janela aberta={!!arquivando} aoFechar={() => setArquivando(null)} titulo="Arquivar este espaço?" descricao="Os dados continuam guardados, mas ninguém abre esse espaço.">
        <p>{arquivando?.nome}</p>
        <div className="dialog-actions">
          <Botao variante="fantasma" onClick={() => setArquivando(null)}>Cancelar</Botao>
          <Botao ocupado={ocupado} onClick={async () => { if (arquivando && (await agir('Espaço arquivado.', () => nucleoApi.arquivarEspaco(arquivando.id)))) setArquivando(null) }}>Arquivar</Botao>
        </div>
      </Janela>
    </>
  )
}
