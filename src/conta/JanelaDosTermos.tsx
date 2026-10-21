/**
 * MOD-01 — a janela do reaceite dos Termos de Uso e do Aviso de Privacidade.
 *
 * Abre para quem tem sessão e ainda não aceitou a versão vigente: as contas de
 * antes de 20/10/2026, que nasceram sem aceite, e todo mundo depois de uma
 * versão nova. Quem decide é o Núcleo (`termosPendentes`, em `/auth/eu` e na
 * resposta do login); a tela só desenha.
 *
 * **Não fecha sem resposta**: sem X, sem Esc, sem clique fora. As saídas são
 * aceitar ou sair da conta — continuar usando sem concordar é justamente o que
 * o aceite existe para evitar. Por isso ela aparece também no editor, que
 * esconde as faixas do resto do painel.
 *
 * Manda as versões que MOSTROU: se o site subiu de versão com a janela aberta,
 * o Núcleo recusa (409) e a janela recarrega a sessão para mostrar a nova.
 */

import { useState } from 'react'
import { ExternalLink, LogOut } from 'lucide-react'
import { aceitarTermos, useSessao } from '@/lib/sessao'
import { Aviso, Botao } from '@/components/ui'

export function JanelaDosTermos() {
  const pendentes = useSessao((s) => s.retrato?.termosPendentes)
  const recarregar = useSessao((s) => s.recarregar)
  const sair = useSessao((s) => s.sair)
  const [marcado, setMarcado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (!pendentes || pendentes.length === 0) return null

  /* "atualizamos" só para quem já tinha aceitado alguma versão; as contas antigas nunca viram aceite */
  const atualizacao = pendentes.some((d) => d.aceitaAntes !== null)
  const versao = (documento: 'termos' | 'privacidade') =>
    pendentes.find((d) => d.documento === documento)?.versao

  const aceitar = async () => {
    if (!marcado || enviando) return
    setEnviando(true)
    setErro(null)
    try {
      await aceitarTermos({ termos: versao('termos'), privacidade: versao('privacidade') })
      await recarregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui registrar o aceite.')
      /* versão nova no meio do caminho: a sessão recarregada traz o texto certo */
      if ((e as { codigo?: string }).codigo === 'termos_desatualizados') {
        setMarcado(false)
        await recarregar()
      }
    } finally {
      setEnviando(false)
    }
  }

  /* a `.dialog` do mock desenhada à mão, sem o Radix: o Radix fecha no Esc e no clique fora, e esta não pode fechar */
  return (
    <>
      <div className="dialog-overlay" />
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="janela-dos-termos-titulo">
        <div className="dialog-head">
          <div>
            <h2 id="janela-dos-termos-titulo">{atualizacao ? 'Atualizamos nossos termos' : 'Antes de continuar'}</h2>
            <p>
              {atualizacao
                ? 'Para continuar usando o LucroCerto, leia e aceite a versão nova dos documentos abaixo.'
                : 'Para continuar usando o LucroCerto, leia e aceite os documentos que regem o uso da plataforma e o tratamento dos seus dados.'}
            </p>
          </div>
        </div>
        <div className="export-options">
          {pendentes.map((d) => (
            <a key={d.documento} href={d.url} target="_blank" rel="noopener noreferrer" className="export-option">
              <ExternalLink size={20} />
              <div><strong>{d.titulo}</strong><span>versão {d.versao}</span></div>
            </a>
          ))}
        </div>
        <label className="check section-gap">
          <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} />
          <span>Li e concordo com {pendentes.length > 1 ? 'os documentos acima' : 'o documento acima'}.</span>
        </label>
        {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
        <div className="dialog-actions">
          <Botao variante="fantasma" onClick={sair}><LogOut size={14} />Sair da conta</Botao>
          <Botao ocupado={enviando} disabled={!marcado} onClick={() => void aceitar()}>Aceitar e continuar</Botao>
        </div>
      </div>
    </>
  )
}
