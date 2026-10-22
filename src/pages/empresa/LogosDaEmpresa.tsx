/**
 * Os logos da empresa — até dois, para as etiquetas (22/10/2026, pedido do
 * Pedro). Antes, cada geração de etiquetas subia o logo de novo; agora ele se
 * cadastra uma vez aqui e a tela de Etiquetas escolhe entre eles.
 *
 * Diferente do resto de Sua empresa, o logo mora no LUCRO CERTO (`/api/logos`),
 * não no Núcleo: é arquivo do app, no armazenamento e na cota dele. Vale em
 * todos os espaços de trabalho da empresa.
 */

import { useCallback, useEffect, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { enderecos, lucroApi, type LogoDaEmpresa, TAMANHO_MAXIMO_DA_IMAGEM } from '@/lib/api'
import { toast } from '@/lib/avisos'
import { ImagemDoEspaco } from '@/components/ArquivosDoEspaco'
import { Aviso, Botao, data, erroDe } from '@/components/ui'

export function LogosDaEmpresa() {
  const [logos, setLogos] = useState<LogoDaEmpresa[] | null>(null)
  const [maximo, setMaximo] = useState(2)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  /* apagar pede um segundo clique (como "Encerrar todas"), e desarma sozinho */
  const [confirmar, setConfirmar] = useState<string | null>(null)
  useEffect(() => {
    if (!confirmar) return
    const relogio = setTimeout(() => setConfirmar(null), 5000)
    return () => clearTimeout(relogio)
  }, [confirmar])

  const carregar = useCallback(async () => {
    try {
      const r = await lucroApi.logos()
      setLogos(r.logos)
      setMaximo(r.maximo)
      setErro('')
    } catch (e) {
      setErro(erroDe(e, 'Não foi possível carregar os logos.'))
    }
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  async function enviar(arquivo: File | undefined) {
    if (!arquivo) return
    if (arquivo.size > TAMANHO_MAXIMO_DA_IMAGEM) { toast('Use um logo de até 1 MB.'); return }
    setOcupado('novo')
    try {
      await lucroApi.enviarLogo(arquivo)
      toast.success('Logo cadastrado. Ele já aparece nas etiquetas.')
      await carregar()
    } catch (e) {
      toast.error(erroDe(e))
    } finally {
      setOcupado(null)
    }
  }

  async function apagar(id: string) {
    if (confirmar !== id) { setConfirmar(id); return }
    setConfirmar(null)
    setOcupado(id)
    try {
      await lucroApi.apagarLogo(id)
      toast.success('Logo apagado.')
      await carregar()
    } catch (e) {
      toast.error(erroDe(e))
    } finally {
      setOcupado(null)
    }
  }

  const vagas = Math.max(0, maximo - (logos?.length ?? 0))
  return (
    <section className="panel">
      <h2>Logos da empresa</h2>
      <p className="muted">
        Os logos que podem aparecer nas etiquetas, em todos os espaços de trabalho. Cadastre até {maximo} — por exemplo, um colorido e um em
        preto para impressora a laser — e escolha qual usar na hora de imprimir.
      </p>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {logos === null && !erro ? <div className="skeleton section-gap" style={{ minHeight: 120 }} /> : null}
      {logos ? (
        <div className="company-logos section-gap">
          {logos.map((l, i) => (
            <figure key={l.id} className="company-logo">
              <div className="company-logo-frame"><ImagemDoEspaco caminho={enderecos.imagem(l.id)} alt={`Logo ${i + 1}`} /></div>
              <figcaption>
                <span><strong>Logo {i + 1}</strong><small className="muted">{l.mime === 'image/png' ? 'PNG' : 'JPG'} · {Math.max(1, Math.round(l.tamanho / 1024))} KB · {data(l.criadoEm)}</small></span>
                <Botao variante="perigo" ocupado={ocupado === l.id} onClick={() => void apagar(l.id)}><Trash2 size={15} />{confirmar === l.id ? 'Confirmar' : 'Apagar'}</Botao>
              </figcaption>
            </figure>
          ))}
          {Array.from({ length: vagas }, (_, i) => (
            <label key={`vaga-${i}`} className={`company-logo empty${ocupado === 'novo' ? ' busy' : ''}`}>
              <div className="company-logo-frame"><ImagePlus size={26} /></div>
              <span className="btn secondary"><ImagePlus size={15} />{ocupado === 'novo' ? 'Enviando…' : 'Enviar logo'}</span>
              <small className="muted">PNG ou JPG, até 1 MB. Fundo transparente fica melhor.</small>
              <input type="file" accept="image/png,image/jpeg" hidden disabled={ocupado !== null} onChange={(e) => { void enviar(e.target.files?.[0]); e.target.value = '' }} />
            </label>
          ))}
        </div>
      ) : null}
    </section>
  )
}
