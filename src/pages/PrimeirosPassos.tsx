/**
 * Primeiros passos — o `onboarding.tsx` do mock: quatro escolhas na primeira
 * vez que a pessoa abre o app. Ficam nas preferências DELA (não da empresa) e
 * só servem para sugerir: a categoria vira o padrão do próximo produto.
 *
 * Pular também conta como feito; Minha conta → Perfil refaz.
 */

import { useState } from 'react'
import { ArrowRight, Check, Store, Target, Wallet } from 'lucide-react'
import { CATEGORIAS, type Preferencias } from '@shared/contratos'
import { Botao, Combo, Janela } from '@/components/ui'

const CANAIS = ['Shopee', 'Mercado Livre', 'Loja física', 'Instagram ou WhatsApp', 'Loja virtual própria', 'Outros canais', 'Ainda vou começar']
const TITULOS = ['Como você vende seus produtos?', 'Que tipo de produto você vende?', 'Você já conhece seus custos?', 'Qual é sua prioridade?']
const CONHECIMENTO = ['Sim, já tenho meus valores', 'Conheço alguns custos', 'Ainda preciso organizar', 'Quero apenas fazer uma simulação']
const PRIORIDADES = ['Encontrar preço de venda', 'Melhorar a margem', 'Comparar marketplaces', 'Saber se meus descontos compensam', 'Organizar meu catálogo']

/** `prioridade` vazia = pulou; a casca só leva ao Precificar quem terminou */
export function PrimeirosPassos({ aoTerminar }: { aoTerminar: (escolhas: Preferencias) => Promise<void> }) {
  const [passo, setPasso] = useState(0)
  const [canais, setCanais] = useState<string[]>([])
  const [categoria, setCategoria] = useState('Outros')
  const [conheceCustos, setConheceCustos] = useState('Conheço alguns custos')
  const [prioridade, setPrioridade] = useState('Encontrar preço de venda')
  const [ocupado, setOcupado] = useState(false)

  const terminar = async (pulou: boolean) => {
    setOcupado(true)
    try {
      await aoTerminar(pulou ? {} : { canais, categoria, conheceCustos, prioridade })
    } finally {
      setOcupado(false)
    }
  }
  const escolhida = passo === 2 ? conheceCustos : prioridade

  return (
    <Janela aberta aoFechar={() => void terminar(true)} titulo="Vamos deixar tudo com a sua cara." descricao="Quatro escolhas rápidas. Você pode mudar suas preferências depois." larga>
      <div className="onboarding-progress">{TITULOS.map((t, i) => <i className={i <= passo ? 'active' : ''} key={t} />)}</div>
      <span className="section-kicker">PASSO {passo + 1} DE 4</span>
      <h2 className="onboarding-title">{TITULOS[passo]}</h2>
      {passo === 0 ? (
        <div className="onboarding-choices">
          {CANAIS.map((c) => (
            <button key={c} className={canais.includes(c) ? 'active' : ''} onClick={() => setCanais(canais.includes(c) ? canais.filter((a) => a !== c) : [...canais, c])}>
              <Store size={19} />{c}{canais.includes(c) ? <Check size={17} /> : null}
            </button>
          ))}
        </div>
      ) : passo === 1 ? (
        <Combo rotulo="Categoria principal" valor={categoria} aoMudar={setCategoria} opcoes={CATEGORIAS.map((c) => ({ valor: c, rotulo: c }))} />
      ) : (
        <div className="onboarding-choices">
          {(passo === 2 ? CONHECIMENTO : PRIORIDADES).map((c) => (
            <button key={c} className={escolhida === c ? 'active' : ''} onClick={() => (passo === 2 ? setConheceCustos(c) : setPrioridade(c))}>
              {passo === 2 ? <Wallet size={19} /> : <Target size={19} />} {c}{escolhida === c ? <Check size={17} /> : null}
            </button>
          ))}
        </div>
      )}
      <div className="form-footer">
        <Botao variante="fantasma" onClick={() => void terminar(true)} ocupado={ocupado}>Pular por enquanto</Botao>
        {passo < 3 ? (
          <Botao onClick={() => setPasso(passo + 1)}>Continuar<ArrowRight size={16} /></Botao>
        ) : (
          <Botao onClick={() => void terminar(false)} ocupado={ocupado}>Fazer meu primeiro cálculo<ArrowRight size={16} /></Botao>
        )}
      </div>
    </Janela>
  )
}
