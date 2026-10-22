/**
 * O painel da cena — PLANO-ESTOQUE-3D.md, fatias 2, 4 e 5.
 *
 * Três estados: uma POSIÇÃO selecionada (cada produto dela por inteiro, com
 * foto, e o que dá para fazer dali), o monte "A GUARDAR" (o que chegou e
 * ainda não tem lugar) e NADA selecionado (o resumo do espaço e a fila de
 * tarefas). Os dois primeiros flutuam sobre a cena, à direita; o resumo é a
 * faixa acima dela. As peças são as de `components/ui.tsx`; quem é leitor vê
 * tudo e não vê os botões que gravam.
 */

import { ArrowLeftRight, ClipboardCheck, PackagePlus, PackageSearch, ShoppingBag, Store, Truck, X } from 'lucide-react'
import { D } from '@shared/preco'
import { rotuloDaQuantidade } from '@shared/estoque'
import { MEDIDAS, NOMES_DAS_ZONAS, NOMES_DOS_TIPOS, rotuloDoEndereco, type Endereco, type Tarefa } from '@shared/enderecos'
import { enderecos, type MapaDoEstoque, type PosicaoNoMapa, type ProdutoNoMapa } from '@/lib/api'
import { usePainel } from '@/lib/painel'
import { ImagemDoEspaco } from '@/components/ArquivosDoEspaco'
import { novoFormulario } from '@/components/FormularioDeMovimento'
import { Botao, Selo, brl, novaChave, quantidade } from '@/components/ui'
import type { Pedido } from './JanelasDoEspaco'

export type Selecao = { tipo: 'posicao'; endereco: Endereco } | { tipo: 'chao' } | null

const ICONE_DA_TAREFA = { guardar: PackageSearch, expor: Store, repor: Truck } as const

export function PainelDoEspaco({ mapa, selecao, escreve, cores, aoFechar, aoPedir, aoProcurar, aoSelecionar }: {
  mapa: MapaDoEstoque
  selecao: Selecao
  escreve: boolean
  cores: Map<string, string>
  aoFechar: () => void
  aoPedir: (p: Pedido) => void
  aoProcurar: (produtoId: string) => void
  aoSelecionar: (e: Endereco) => void
}) {
  const catalogo = usePainel((s) => s.estado!.produtos)
  const tema = mapa.ambiente!.tema
  const porProduto = new Map(mapa.produtos.map((p) => [p.id, p]))
  const doCatalogo = (id: string) => catalogo.find((p) => p.id === id)

  const movimento = (produtoId: string, tipo: Parameters<typeof novoFormulario>[1], endereco: Endereco | null, lugar: string | undefined, tipos: Extract<Pedido, { tipo: 'movimento' }>['tipos'], extra: Partial<ReturnType<typeof novoFormulario>> = {}) => {
    const p = doCatalogo(produtoId)
    if (!p) return
    aoPedir({ tipo: 'movimento', form: { ...novoFormulario(p, tipo, endereco), ...extra }, lugar, tipos })
  }
  const mover = (produtoId: string, origem: Endereco | null, destino: Endereco | null = null, quanto?: string) =>
    aoPedir({ tipo: 'mover', chave: novaChave(), produtoId, origem, destino, quantidade: quanto ?? '1' })

  const ficha = (p: ProdutoNoMapa, qtd: string, acoes: React.ReactNode) => (
    <article key={p.id} className="space-item">
      <span className="space-dot" style={{ background: cores.get(p.id) }} />
      {p.imagemId ? <ImagemDoEspaco caminho={enderecos.imagem(p.imagemId)} className="space-thumb" alt="" /> : null}
      <div className="space-item-body">
        <strong>{p.nome}</strong>
        <span>{rotuloDaQuantidade(qtd, p.unidade)}{D(p.custoMedio).gt(0) ? ` · ${brl(D(qtd).times(p.custoMedio).toFixed(2))} em estoque` : ''}</span>
        <small className="muted">{p.categoria}{D(p.preco).gt(0) ? ` · vende a ${brl(p.preco)}` : ''}</small>
        {escreve && acoes ? <div className="space-item-actions">{acoes}</div> : null}
      </div>
    </article>
  )

  /*
   * O produto clicado na cena, por inteiro: a foto grande, o que tem AQUI e no
   * estoque todo, o dinheiro parado e onde mais ele está — clicar numa das
   * outras posições leva a câmera até lá.
   */
  const detalhe = (pos: PosicaoNoMapa, p: ProdutoNoMapa, acoes: React.ReactNode) => {
    const outras = mapa.posicoes.filter((x) => x.produtoId === p.id && !(x.estruturaId === pos.estruturaId && x.nivel === pos.nivel && x.vao === pos.vao))
    return (
      <article key={p.id} className="space-product">
        {p.imagemId
          ? <ImagemDoEspaco caminho={enderecos.imagem(p.imagemId)} className="space-product-photo" alt={p.nome} />
          : <div className="space-product-photo vazia" style={{ background: cores.get(p.id) }} aria-hidden="true">{p.nome.slice(0, 1).toUpperCase()}</div>}
        <div className="space-product-head">
          <span className="space-dot" style={{ background: cores.get(p.id) }} />
          <div>
            <strong>{p.nome}</strong>
            <small className="muted">{[p.categoria, p.sku ? `SKU ${p.sku}` : null].filter(Boolean).join(' · ')}</small>
          </div>
        </div>
        <dl className="space-summary">
          <div><dt>Nesta posição</dt><dd>{rotuloDaQuantidade(pos.quantidade, p.unidade)}</dd></div>
          <div><dt>No estoque todo</dt><dd>{rotuloDaQuantidade(p.quantidade, p.unidade)}</dd></div>
          <div><dt>Custo médio</dt><dd>{D(p.custoMedio).gt(0) ? brl(D(p.custoMedio).toFixed(2)) : '—'}</dd></div>
          <div><dt>Preço de venda</dt><dd>{D(p.preco).gt(0) ? brl(D(p.preco).toFixed(2)) : '—'}</dd></div>
          <div><dt>Valor nesta posição</dt><dd>{D(p.custoMedio).gt(0) ? brl(D(pos.quantidade).times(p.custoMedio).toFixed(2)) : '—'}</dd></div>
          <div><dt>Vendidos em 30 dias</dt><dd>{rotuloDaQuantidade(p.vendidos30d, p.unidade)}</dd></div>
          {D(p.minimo).gt(0) ? <div><dt>Estoque mínimo</dt><dd>{rotuloDaQuantidade(p.minimo, p.unidade)}</dd></div> : null}
          <div><dt>Última movimentação</dt><dd>{p.diasParado === null ? 'nunca' : p.diasParado === 0 ? 'hoje' : `há ${p.diasParado} dia${p.diasParado > 1 ? 's' : ''}`}</dd></div>
        </dl>
        {D(p.aGuardar).gt(0) ? <small className="muted">{rotuloDaQuantidade(p.aGuardar, p.unidade)} ainda a guardar, no chão do recebimento.</small> : null}
        {outras.length ? (
          <div className="space-product-elsewhere">
            <small className="muted">Também em</small>
            <ul>
              {outras.slice(0, 8).map((x) => {
                const e = mapa.estruturas.find((y) => y.id === x.estruturaId)
                return e ? (
                  <li key={`${x.estruturaId}:${x.nivel}:${x.vao}`}>
                    <button className="text-link" onClick={() => aoSelecionar({ estruturaId: x.estruturaId, nivel: x.nivel, vao: x.vao })}>{rotuloDoEndereco(e, x.nivel, x.vao)}</button>
                    <span className="muted"> · {rotuloDaQuantidade(x.quantidade, p.unidade)}</span>
                  </li>
                ) : null
              })}
            </ul>
          </div>
        ) : null}
        {escreve && acoes ? <div className="space-item-actions">{acoes}</div> : null}
      </article>
    )
  }

  if (selecao?.tipo === 'posicao') {
    const e = mapa.estruturas.find((x) => x.id === selecao.endereco.estruturaId)
    if (!e) return <aside className="panel space-side"><p className="muted">Esta posição não existe mais na planta.</p></aside>
    const { nivel, vao } = selecao.endereco
    const rotulo = rotuloDoEndereco(e, nivel, vao)
    const aqui = mapa.posicoes.filter((p) => p.estruturaId === e.id && p.nivel === nivel && p.vao === vao)
    const aGuardar = mapa.produtos.filter((p) => D(p.aGuardar).gt(0) && !p.arquivado)
    return (
      <aside className="panel space-side" aria-label={`Posição ${rotulo}`}>
        <div className="between">
          <div>
            <h3>{rotulo}</h3>
            <small className="muted">{NOMES_DOS_TIPOS[tema][e.tipo]} · {NOMES_DAS_ZONAS[e.zona]}</small>
          </div>
          <button className="icon-button" aria-label="Fechar" onClick={aoFechar}><X size={18} /></button>
        </div>
        <div className="space-list">
          {aqui.length ? aqui.map((pos) => {
            const p = porProduto.get(pos.produtoId)
            if (!p) return null
            return detalhe(pos, p, p.arquivado ? null : (
              <>
                <Botao variante="secundario" onClick={() => movimento(p.id, 'venda', selecao.endereco, rotulo, ['venda', 'perda', 'uso_proprio'])}><ShoppingBag size={15} />Vender</Botao>
                <Botao variante="fantasma" onClick={() => mover(p.id, selecao.endereco, null, pos.quantidade)}><ArrowLeftRight size={15} />Mover</Botao>
                <Botao variante="fantasma" onClick={() => movimento(p.id, 'conferencia', selecao.endereco, rotulo, ['conferencia'], { quantidade: D(pos.quantidade).toString(), motivo: 'Contagem da posição' })}><ClipboardCheck size={15} />Conferir</Botao>
              </>
            ))
          }) : <p className="muted small">Posição vazia.</p>}
        </div>
        {escreve ? (
          <div className="space-side-actions">
            <Botao variante="secundario" disabled={!catalogo.some((p) => p.status === 'ativo')} onClick={() => {
              const primeiro = aqui[0]?.produtoId ?? catalogo.find((p) => p.status === 'ativo')?.id
              if (primeiro) movimento(primeiro, 'entrada', selecao.endereco, rotulo, ['entrada', 'inicial'])
            }}><PackagePlus size={15} />Entrada aqui</Botao>
            {aGuardar.length ? (
              <Botao variante="fantasma" onClick={() => mover(aGuardar[0]!.id, null, selecao.endereco, aGuardar[0]!.aGuardar)}><PackageSearch size={15} />Guardar aqui</Botao>
            ) : null}
          </div>
        ) : null}
      </aside>
    )
  }

  if (selecao?.tipo === 'chao') {
    const aGuardar = mapa.produtos.filter((p) => D(p.aGuardar).gt(0))
    return (
      <aside className="panel space-side" aria-label="A guardar">
        <div className="between">
          <div>
            <h3>A guardar</h3>
            <small className="muted">Chegou e ainda não tem posição. Fica no chão do recebimento.</small>
          </div>
          <button className="icon-button" aria-label="Fechar" onClick={aoFechar}><X size={18} /></button>
        </div>
        <div className="space-list">
          {aGuardar.length ? aGuardar.map((p) => ficha(p, p.aGuardar, p.arquivado ? null : (
            <Botao variante="secundario" onClick={() => mover(p.id, null, null, p.aGuardar)}><PackageSearch size={15} />Guardar</Botao>
          ))) : <p className="muted small">Nada a guardar. Tudo o que entrou já tem lugar.</p>}
        </div>
      </aside>
    )
  }

  /* nada selecionado: o resumo e a fila */
  const valor = mapa.produtos.reduce((s, p) => s.plus(p.valorEmEstoque), D(0))
  const unidades = mapa.produtos.reduce((s, p) => s.plus(p.quantidade), D(0))
  const aGuardar = mapa.produtos.reduce((s, p) => s.plus(p.aGuardar), D(0))
  const lugares = mapa.estruturas.filter((e) => e.tipo !== 'balcao').reduce((s, e) => s + e.niveis * e.vaos, 0)
  const ocupadas = new Set(mapa.posicoes.map((p) => `${p.estruturaId}:${p.nivel}:${p.vao}`)).size
  const fazer = (t: Tarefa) => {
    const p = porProduto.get(t.produtoId)
    if (!p) return
    if (t.tipo === 'guardar') mover(p.id, null, null, p.aGuardar)
    else if (t.tipo === 'repor') movimento(p.id, 'entrada', null, undefined, ['entrada'])
    else {
      /* expor: sai de onde há mais, fora da loja — o depósito, ou o chão */
      const zonaDe = new Map(mapa.estruturas.map((e) => [e.id, e.zona]))
      const fonte = mapa.posicoes
        .filter((x) => x.produtoId === p.id && zonaDe.get(x.estruturaId) !== 'loja' && zonaDe.get(x.estruturaId) !== 'expedicao')
        .sort((a, b) => Number(b.quantidade) - Number(a.quantidade))[0]
      mover(p.id, fonte ? { estruturaId: fonte.estruturaId, nivel: fonte.nivel, vao: fonte.vao } : null, null, fonte?.quantidade ?? p.aGuardar)
    }
  }
  /* o resumo é o cartão de sempre, só que EM CIMA da cena (22/10/2026): ela fica com a largura toda */
  return (
    <section className="panel space-side space-overview" aria-label="Resumo do espaço">
      <div className="space-overview-col">
        <h3>O seu espaço</h3>
        <dl className="space-summary">
          <div><dt>Valor em estoque</dt><dd>{brl(valor.toFixed(2))}</dd></div>
          <div><dt>Unidades</dt><dd>{quantidade(unidades.toString())}</dd></div>
          <div><dt>Posições ocupadas</dt><dd>{ocupadas} de {lugares}</dd></div>
          <div><dt>A guardar</dt><dd>{quantidade(aGuardar.toString())}</dd></div>
        </dl>
      </div>
      <div className="space-overview-col">
        <div className="between">
          <h3>Tarefas</h3>
          {mapa.tarefas.length ? <Selo tom="roxo">{mapa.tarefas.length}</Selo> : null}
        </div>
        <div className="space-tasks">
          {mapa.tarefas.length ? mapa.tarefas.map((t) => {
            const Icone = ICONE_DA_TAREFA[t.tipo]
            return (
              <article key={`${t.tipo}:${t.produtoId}`} className={`space-task ${t.tipo}`}>
                <Icone size={17} />
                <div>
                  <strong>{t.titulo}</strong>
                  <small>{t.detalhe}</small>
                  <div className="space-item-actions">
                    {escreve ? <Botao variante="secundario" onClick={() => fazer(t)}>{t.tipo === 'guardar' ? 'Guardar' : t.tipo === 'expor' ? 'Levar' : 'Registrar entrada'}</Botao> : null}
                    <Botao variante="fantasma" onClick={() => aoProcurar(t.produtoId)}>Ver no mapa</Botao>
                  </div>
                </div>
              </article>
            )
          }) : <p className="muted small">Nada pendente: tudo guardado, a loja abastecida e nenhum produto no mínimo.</p>}
        </div>
        {mapa.posicoes.length === 0 && mapa.estruturas.length ? (
          <p className="small muted section-gap">
            Dica: clique numa {NOMES_DOS_TIPOS[tema].estante.toLowerCase()} e use “Guardar aqui” — ou comece pelo monte “A guardar”, no chão do recebimento.
            Cada {NOMES_DOS_TIPOS[tema].estante.toLowerCase()} tem {MEDIDAS.estante.niveis.padrao} níveis por padrão.
          </p>
        ) : null}
        {/* atalho para quem navega por teclado: as posições ocupadas, em lista */}
        {mapa.posicoes.length ? (
          <details className="space-a11y">
            <summary>Posições ocupadas, em lista</summary>
            <ul>
              {[...new Map(mapa.posicoes.map((p) => [`${p.estruturaId}:${p.nivel}:${p.vao}`, p])).values()].slice(0, 200).map((p) => {
                const e = mapa.estruturas.find((x) => x.id === p.estruturaId)
                return e ? <li key={`${p.estruturaId}:${p.nivel}:${p.vao}`}><button className="text-link" onClick={() => aoSelecionar(p)}>{rotuloDoEndereco(e, p.nivel, p.vao)}</button></li> : null
              })}
            </ul>
          </details>
        ) : null}
      </div>
    </section>
  )
}
