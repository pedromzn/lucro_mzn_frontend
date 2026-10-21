/**
 * Central de ajuda — o `help.tsx` do mock, com a mesma marcação. Os artigos
 * moram em `@shared/ajuda` e a busca é local, sem ida ao servidor.
 *
 * O suporte do mock era um sistema de chamados dentro do app; aqui ele é o
 * e-mail da MZN (`EMAIL_DO_SUPORTE`), que atende todos os aplicativos.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, LifeBuoy, Search, X } from 'lucide-react'
import { ARTIGOS_DE_AJUDA, buscarNaAjuda } from '@shared/ajuda'
import { Botao, Vazio } from '@/components/ui'

const CATEGORIAS = [...new Set(ARTIGOS_DE_AJUDA.map((a) => a.categoria))]

export default function Ajuda() {
  const navegar = useNavigate()
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const resultados = buscarNaAjuda(busca, categoria)
  return (
    <div className="help-content">
      <div className="report-hero">
        <div>
          <div className="eyebrow">RESPOSTAS PARA O SEU DIA A DIA</div>
          <h2>O que você precisa fazer agora?</h2>
          <p>Encontre orientações sobre preços, produtos, estoque e etiquetas.</p>
        </div>
        <LifeBuoy size={44} />
      </div>
      <section className="panel help-search-panel">
        <label htmlFor="busca-na-ajuda">Buscar na central de ajuda</label>
        <div className="search">
          <Search size={20} />
          <input id="busca-na-ajuda" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex.: comissão, imprimir etiqueta, entrada de estoque" />
          {busca ? <button className="icon-button" aria-label="Limpar busca" onClick={() => setBusca('')}><X size={17} /></button> : null}
        </div>
        <div className="help-categories" aria-label="Filtrar por assunto">
          {['', ...CATEGORIAS].map((c) => (
            <button key={c} aria-pressed={categoria === c} className={categoria === c ? 'active' : ''} onClick={() => setCategoria(c)}>{c || 'Todos os assuntos'}</button>
          ))}
        </div>
      </section>
      <p className="muted small" aria-live="polite">
        {resultados.length} {resultados.length === 1 ? 'resposta encontrada' : 'respostas encontradas'}{categoria ? ` em ${categoria}` : ''}
      </p>
      <div className="help-faq">
        {resultados.map((a) => (
          <details className="panel" key={a.id}>
            <summary><span><small className="article-category">{a.categoria}</small>{a.pergunta}</span></summary>
            <p>{a.resposta}</p>
          </details>
        ))}
      </div>
      {!resultados.length ? (
        <Vazio
          icone={<BookOpen size={26} />}
          titulo="Não encontramos uma resposta com esses termos."
          acao={<Botao variante="secundario" onClick={() => { setBusca(''); setCategoria('') }}>Ver todos os assuntos</Botao>}
        >
          Use uma palavra mais curta, como “estoque” ou “etiqueta”, ou escolha outra categoria.
        </Vazio>
      ) : null}
      <section className="panel between help-support">
        <div><h3>Ainda precisa de ajuda?</h3><p className="muted small">Fale com o suporte da MZN e responderemos pelo seu e-mail.</p></div>
        <Botao variante="secundario" onClick={() => navegar('/conta?secao=suporte')}>Abrir suporte</Botao>
      </section>
    </div>
  )
}
