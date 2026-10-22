/**
 * A primeira vez no espaço 3D: escolher o tema — PLANO-ESTOQUE-3D.md, E4.
 *
 * Cada cartão mostra a planta pronta daquele tema JÁ COM mercadoria de
 * exemplo, ao vivo: a pessoa escolhe vendo, não lendo. A prévia não tem clique
 * nem rótulo, e só existe nesta tela.
 */

import { useMemo, useState } from 'react'
import { Store, Warehouse, ShoppingBag } from 'lucide-react'
import { MEDIDAS, TEMAS, plantaPadrao, type Estrutura, type Tema } from '@shared/enderecos'
import type { MapaDoEstoque, PosicaoNoMapa, ProdutoNoMapa } from '@/lib/api'
import { Aviso, Botao } from '@/components/ui'
import { coresDosProdutos } from './calor'
import { pontoDoChao } from './lugares'
import { Palco } from './Palco'
import { hashDe } from './temas'

const ICONES = { loja_fofa: Store, armazem: Warehouse, shopping: ShoppingBag } as const
const CATEGORIAS = ['Blusas', 'Calças', 'Acessórios', 'Vestidos', 'Casacos', 'Bolsas']

/** Uma planta pronta com mercadoria inventada, só para a prévia. */
function exemplo(tema: Tema) {
  const planta = plantaPadrao(tema, 4)
  const estruturas: Estrutura[] = planta.estruturas.map((e, i) => ({ ...e, id: `ex${i}` }))
  const produtos: ProdutoNoMapa[] = CATEGORIAS.map((categoria, i) => ({
    id: `p${i}`, nome: categoria, sku: null, categoria, unidade: 'unidade', imagemId: null, arquivado: false,
    quantidade: '20', aGuardar: i === 0 ? '6' : '0', minimo: '0', revisao: 1, valorEmEstoque: '0', custoMedio: '0', preco: '0', vendidos30d: '0', diasParado: 1,
  }))
  const posicoes: PosicaoNoMapa[] = []
  for (const e of estruturas) {
    if (e.tipo === 'balcao') continue
    for (let nivel = 0; nivel < e.niveis; nivel++) {
      for (let vao = 0; vao < e.vaos; vao++) {
        const h = hashDe(`${tema}${e.id}${nivel}${vao}`)
        if (h % 5 === 0) continue
        posicoes.push({ estruturaId: e.id, nivel, vao, produtoId: `p${h % CATEGORIAS.length}`, quantidade: String(2 + (h % 9)) })
      }
    }
  }
  return { ambiente: planta.ambiente, estruturas, produtos, posicoes }
}

export function EscolhaDoEspaco({ mapa, escreve, aoMontar, reduzirMovimento }: {
  mapa: MapaDoEstoque
  escreve: boolean
  aoMontar: (tema: Tema) => Promise<void>
  reduzirMovimento: boolean
}) {
  const [montando, setMontando] = useState<Tema | null>(null)
  const exemplos = useMemo(() => Object.fromEntries(TEMAS.map((t) => [t, exemplo(t)])) as Record<Tema, ReturnType<typeof exemplo>>, [])
  return (
    <section className="panel section-gap space-start">
      <div className="between">
        <div>
          <h2>Monte o seu estoque em 3D</h2>
          <p className="muted">Escolha o jeito do seu espaço. Ele começa com uma planta pronta, que você ajusta depois — e pode trocar o tema quando quiser, sem perder nada.</p>
        </div>
      </div>
      {!escreve ? <Aviso>Quem monta o espaço é quem pode registrar movimentações. Peça a um administrador da sua empresa.</Aviso> : null}
      <div className="space-choice-grid">
        {mapa.temas.map(({ tema, nome, descricao }) => {
          const ex = exemplos[tema]
          const Icone = ICONES[tema]
          const cores = coresDosProdutos('categoria', tema, ex.produtos)
          return (
            <article key={tema} className="space-choice-card">
              <div className="space-choice-preview">
                <Palco
                  tema={tema}
                  ambiente={ex.ambiente}
                  estruturas={ex.estruturas}
                  posicoes={ex.posicoes}
                  produtos={ex.produtos}
                  cores={cores}
                  chao={pontoDoChao(ex.estruturas, ex.ambiente)}
                  reduzirMovimento={reduzirMovimento}
                  soVer
                />
              </div>
              <div className="space-choice-body">
                <h3><Icone size={18} />{nome}</h3>
                <p className="muted small">{descricao}</p>
                {escreve ? (
                  <Botao ocupado={montando === tema} disabled={montando !== null && montando !== tema} onClick={async () => {
                    setMontando(tema)
                    try { await aoMontar(tema) } finally { setMontando(null) }
                  }}>
                    Montar este espaço
                  </Botao>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
      <p className="small muted">As medidas são de referência ({MEDIDAS.estante.vao} m por vão de prateleira): a planta é um mapa do seu estoque, não um projeto de arquitetura.</p>
    </section>
  )
}
