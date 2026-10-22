/**
 * Arquivos do catálogo — PLANO-LUCRO-CERTO, D2.
 * O cookie identifica a pessoa; o cabeçalho identifica o espaço escolhido.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { arquivo } from '@/lib/api'
import { toast } from '@/lib/avisos'

export function BaixarArquivo({ caminho, className, children }: { caminho: string; className?: string; children: ReactNode }) {
  const [ocupado, setOcupado] = useState(false)
  return <button type="button" className={className} disabled={ocupado} onClick={async () => {
    setOcupado(true)
    try {
      const conteudo = await arquivo(caminho)
      const url = URL.createObjectURL(conteudo)
      const link = document.createElement('a')
      link.href = url
      const formato = new URL(caminho, location.origin).searchParams.get('formato')
      const extensao = formato ?? (caminho.endsWith('/pdf') ? 'pdf' : 'csv')
      link.download = `lucro-certo.${extensao}`
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível baixar o arquivo.')
    } finally { setOcupado(false) }
  }}>{children}</button>
}

export function ImagemDoEspaco({ caminho, className, alt }: { caminho: string; className?: string; alt: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let ativa = true
    let objeto: string | undefined
    setUrl('')
    void arquivo(caminho).then((conteudo) => {
      if (!ativa) return
      objeto = URL.createObjectURL(conteudo)
      setUrl(objeto)
    }).catch(() => undefined)
    return () => { ativa = false; if (objeto) URL.revokeObjectURL(objeto) }
  }, [caminho])
  return url ? <img className={className} src={url} alt={alt} /> : null
}
