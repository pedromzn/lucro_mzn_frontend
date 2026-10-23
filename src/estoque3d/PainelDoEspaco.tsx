/**
 * O painel da cena — PLANO-ESTOQUE-3D.md, fatias 2, 4 e 5.
 *
 * Três estados: uma POSIÇÃO selecionada (cada produto dela por inteiro, com
 * foto, e o que dá para fazer dali), o monte "A GUARDAR" (o que chegou e
 * ainda não tem lugar) e NADA selecionado (o resumo do espaço). Os dois primeiros flutuam sobre a cena, à direita; o resumo é a
 * faixa acima dela. As peças são as de `components/ui.tsx`; quem é leitor vê
 * tudo e não vê os botões que gravam.
 *
 * Sem fila de tarefas desde 22/10/2026 (pedido do Pedro): "guardar", "levar
 * para a loja" e "comprar" eram sugestão de jogo. O espaço é o retrato do
 * estoque — onde está cada coisa, e a conferência —, não uma lista de afazeres.
 */

import { useState } from 'react'
import { ArrowLeftRight, ClipboardCheck, LocateFixed, PackagePlus, PackageSearch, Search, ShoppingBag, X } from 'lucide-react'
import { D } from '@shared/preco'
import { rotuloDaQuantidade } from '@shared/estoque'
import { MEDIDAS, NOMES_DAS_ZONAS, NOMES_DOS_TIPOS, rotuloDoEndereco, type Endereco } from '@shared/enderecos'
import { enderecos, type MapaDoEstoque, type PosicaoNoMapa, type ProdutoNoMapa } from '@/lib/api'
import { usePainel } from '@/lib/painel'
import { ImagemDoEspaco } from '@/components/ArquivosDoEspaco'
import { novoFormulario } from '@/components/FormularioDeMovimento'
import { Botao, brl, novaChave, quantidade } from '@/components/ui'
import { Paginacao, usePaginacao } from '@/components/Paginacao'
import type { Pedido } from './JanelasDoEspaco'

export type Selecao = { tipo: 'posicao'; endereco: Endereco } | { tipo: 'chao' } | null

export function PainelDoEspaco({ mapa, selecao, escreve, cores, aoFechar, aoPedir, aoSelecionar, aoVerOChao }: {
  mapa: MapaDoEstoque
  selecao: Selecao
  escreve: boolean
  cores: Map<string, string>
  aoFechar: () => void
  aoPedir: (p: Pedido) => void
  aoSelecionar: (e: Endereco) => void
  /** a linha "a guardar" da tabela abre o monte do recebimento */
  aoVerOChao: () => void
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

  /* nada selecionado: o resumo */
  const valor = mapa.produtos.reduce((s, p) => s.plus(p.valorEmEstoque), D(0))
  const unidades = mapa.produtos.reduce((s, p) => s.plus(p.quantidade), D(0))
  const aGuardar = mapa.produtos.reduce((s, p) => s.plus(p.aGuardar), D(0))
  const lugares = mapa.estruturas.filter((e) => e.tipo !== 'balcao').reduce((s, e) => s + e.niveis * e.vaos, 0)
  const ocupadas = new Set(mapa.posicoes.map((p) => `${p.estruturaId}:${p.nivel}:${p.vao}`)).size
  /* o resumo é o cartão de sempre, só que EM CIMA da cena (22/10/2026): ela fica com a largura toda */
  return (
    <section className="panel space-side space-overview" aria-label="Resumo do espaço">
      <h3>O seu espaço</h3>
      <dl className="space-summary">
        <div><dt>Valor em estoque</dt><dd>{brl(valor.toFixed(2))}</dd></div>
        <div><dt>Unidades</dt><dd>{quantidade(unidades.toString())}</dd></div>
        <div><dt>Posições ocupadas</dt><dd>{ocupadas} de {lugares}</dd></div>
        <div><dt>A guardar</dt><dd>{quantidade(aGuardar.toString())}</dd></div>
      </dl>
      {mapa.posicoes.length === 0 && mapa.estruturas.length ? (
        <p className="small muted">
          Dica: clique numa {NOMES_DOS_TIPOS[tema].estante.toLowerCase()} e use “Guardar aqui” — ou comece pelo monte “A guardar”, no chão do recebimento.
          Cada {NOMES_DOS_TIPOS[tema].estante.toLowerCase()} tem {MEDIDAS.estante.niveis.padrao} níveis por padrão.
        </p>
      ) : null}
      <OndeEstaCadaItem mapa={mapa} cores={cores} aoSelecionar={aoSelecionar} aoVerOChao={aoVerOChao} />
    </section>
  )
}

/**
 * "Onde está cada item" — a resposta em lista, na linha inteira, logo abaixo
 * dos números (22/10/2026, pedido do Pedro: "tá difícil achar onde estão os
 * itens"). Era um "Posições ocupadas, em lista" fechado, que só dizia o nome
 * da posição. Agora é uma linha por produto em cada lugar — o que está no
 * recebimento sem posição incluído —, com busca por produto, código ou
 * posição, e "Ver no 3D" leva a câmera até lá. Vale também para quem navega
 * por teclado, que era o motivo da lista antiga.
 */
function OndeEstaCadaItem({ mapa, cores, aoSelecionar, aoVerOChao }: {
  mapa: MapaDoEstoque
  cores: Map<string, string>
  aoSelecionar: (endereco: Endereco) => void
  aoVerOChao: () => void
}) {
  const [busca, setBusca] = useState('')
  const { pagina, setPagina, porPagina, setPorPagina } = usePaginacao('onde-esta', 10)
  const porProduto = new Map(mapa.produtos.map((p) => [p.id, p]))
  const porEstrutura = new Map(mapa.estruturas.map((e) => [e.id, e]))

  type Linha = { chave: string; produto: ProdutoNoMapa; lugar: string; zona: string; quanto: string; endereco: Endereco | null }
  const linhas: Linha[] = []
  for (const pos of mapa.posicoes) {
    const produto = porProduto.get(pos.produtoId)
    const e = porEstrutura.get(pos.estruturaId)
    if (!produto || !e) continue
    linhas.push({
      chave: `${pos.estruturaId}:${pos.nivel}:${pos.vao}:${pos.produtoId}`, produto, lugar: rotuloDoEndereco(e, pos.nivel, pos.vao),
      zona: NOMES_DAS_ZONAS[e.zona], quanto: pos.quantidade, endereco: { estruturaId: pos.estruturaId, nivel: pos.nivel, vao: pos.vao },
    })
  }
  for (const produto of mapa.produtos) {
    if (D(produto.aGuardar).gt(0)) linhas.push({ chave: `chao:${produto.id}`, produto, lugar: 'A guardar (sem posição)', zona: NOMES_DAS_ZONAS.recebimento, quanto: produto.aGuardar, endereco: null })
  }
  if (!linhas.length) return null

  const termo = achatar(busca)
  const achadas = linhas
    .filter((l) => !termo || achatar(`${l.produto.nome} ${l.produto.sku ?? ''} ${l.lugar} ${l.zona}`).includes(termo))
    .sort((a, b) => a.produto.nome.localeCompare(b.produto.nome, 'pt-BR') || a.lugar.localeCompare(b.lugar, 'pt-BR', { numeric: true }))
  const paginas = Math.max(1, Math.ceil(achadas.length / porPagina))
  const atual = Math.min(pagina, paginas)
  const visiveis = achadas.slice((atual - 1) * porPagina, atual * porPagina)

  return (
    <div className="space-where">
      <div className="between">
        <div>
          <h3>Onde está cada item</h3>
          <small className="muted">Um produto por lugar. “Ver no 3D” leva a câmera até a posição.</small>
        </div>
        <label className="search space-where-search">
          <Search size={16} />
          <input type="search" aria-label="Buscar item ou posição" placeholder="Buscar produto, código ou posição" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1) }} />
        </label>
      </div>
      {visiveis.length ? (
        <div className="space-where-table">
          <table>
            <thead><tr><th>Produto</th><th>Onde está</th><th>Área</th><th className="num">Quantidade</th><th aria-label="Ações" /></tr></thead>
            <tbody>
              {visiveis.map((l) => (
                <tr key={l.chave}>
                  <td>
                    <span className="space-where-produto">
                      <span className="space-dot" style={{ background: cores.get(l.produto.id) }} />
                      <strong>{l.produto.nome}</strong>
                      {l.produto.sku ? <small className="muted">{l.produto.sku}</small> : null}
                    </span>
                  </td>
                  <td>{l.lugar}</td>
                  <td className="muted">{l.zona}</td>
                  <td className="num">{rotuloDaQuantidade(l.quanto, l.produto.unidade)}</td>
                  <td className="acao">
                    <Botao variante="fantasma" onClick={() => { if (l.endereco) aoSelecionar(l.endereco); else aoVerOChao(); irParaACena() }}><LocateFixed size={15} />Ver no 3D</Botao>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="muted small">Nada encontrado para “{busca}”.</p>}
      <Paginacao pagina={atual} porPagina={porPagina} total={achadas.length} aoMudarPagina={setPagina} aoMudarPorPagina={setPorPagina} rotulo="itens" />
    </div>
  )
}

/* a cena fica abaixo da tabela: sem rolar, o clique selecionava lá embaixo e a pessoa não via nada acontecer */
const irParaACena = () => document.querySelector('.space-toolbar')?.scrollIntoView({ behavior: 'instant', block: 'start' })

/* sem acento e sem caixa: "camisa azul" acha "Camisa Azul" e "prateleira 2" acha "Prateleira 2 · nível 1" */
const achatar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
