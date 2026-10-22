/**
 * Editar um produto sem sair do catálogo — o cadastro (nome, categoria,
 * unidade, código, tags, observações e foto) e o essencial do preço (custo,
 * preço cobrado e margem desejada), com o sugerido recalculado a cada tecla.
 *
 * Taxas, canal, tributos e custos extras continuam no Precificar: o botão
 * "Precificação completa" leva o produto para lá. A gravação é a mesma do
 * assistente (`salvarProduto`, com a revisão como trava): vira revisão no
 * histórico, e outra aba que salvou antes faz esta levar 409.
 */

import { useEffect, useState } from 'react'
import { ImagePlus, SlidersHorizontal, Trash2 } from 'lucide-react'
import type { Premissas } from '@shared/preco'
import { CATEGORIAS, UNIDADES } from '@shared/contratos'
import { enderecos, lucroApi, type Produto, type ProdutoParaGravar, TAMANHO_MAXIMO_DA_IMAGEM } from '@/lib/api'
import { agir } from '@/lib/painel'
import { toast } from '@/lib/avisos'
import { usarCalculo } from '@/precos/Resultado'
import { ImagemDoEspaco } from './ArquivosDoEspaco'
import { Aviso, Botao, CampoDeTexto, CampoNumero, Combo, Janela, Selecao, brl, erroDe, pct } from './ui'

export type Rascunho = ProdutoParaGravar & { id?: string; revisao?: number }

/** O produto como a gravação o recebe — sem o cálculo e o que o servidor decide. */
export const paraGravar = (p: Produto): Rascunho => ({
  id: p.id, revisao: p.revisao, nome: p.nome, sku: p.sku, categoria: p.categoria, unidade: p.unidade, status: p.status,
  favorito: p.favorito, canalId: p.canalId, imagemId: p.imagemId, tags: p.tags, notas: p.notas, premissas: p.premissas,
})

export function EditarProduto({ produto, aoFechar, aoCompleta }: {
  produto: Produto | null
  aoFechar: () => void
  /** abrir no Precificar, para o que esta janela não tem (taxas, canal, tributos) */
  aoCompleta: (p: Produto) => void
}) {
  const [p, setP] = useState<Rascunho | null>(null)
  const [gravando, setGravando] = useState(false)
  const [categoriasNovas, setCategoriasNovas] = useState<string[]>([])
  /* cada abertura começa do produto como está agora — não do rascunho da vez anterior */
  useEffect(() => { setP(produto ? paraGravar(produto) : null) }, [produto])

  const { calculo, erro } = usarCalculo(p?.premissas ?? produto?.premissas ?? ({} as Premissas))
  if (!produto || !p) return null

  const mudar = <K extends keyof Rascunho>(chave: K, valor: Rascunho[K]) => setP((a) => (a ? { ...a, [chave]: valor } : a))
  const premissa = <K extends keyof Premissas>(chave: K, valor: Premissas[K]) =>
    setP((a) => (a ? { ...a, premissas: { ...a.premissas, [chave]: valor } } : a))
  const x = p.premissas
  const avaliacao = calculo?.atual ?? calculo?.resultado ?? null

  async function enviarImagem(arquivo: File | undefined) {
    if (!arquivo) return
    if (arquivo.size > TAMANHO_MAXIMO_DA_IMAGEM) { toast('Escolha uma imagem de até 1 MB.'); return }
    try {
      const r = await lucroApi.enviarImagem(arquivo)
      mudar('imagemId', r.id)
    } catch (e) {
      toast(erroDe(e))
    }
  }

  async function salvar() {
    if (!p) return
    if (!p.nome.trim()) { toast('Informe o nome do produto.'); return }
    if (!calculo) return
    setGravando(true)
    try {
      const salvo = await agir(() => lucroApi.salvarProduto({ ...p, sku: p.sku || null, id: p.id!, revisao: p.revisao! }), 'Produto atualizado.')
      if (salvo) aoFechar()
    } finally {
      setGravando(false)
    }
  }

  return (
    <Janela aberta aoFechar={aoFechar} larga titulo="Editar produto" descricao="Cada alteração vira uma revisão no histórico do produto.">
      <div className="product-editor">
        <div className="product-editor-photo">
          {p.imagemId
            ? <ImagemDoEspaco caminho={enderecos.imagem(p.imagemId)} className="product-editor-image" alt={p.nome} />
            : <div className="product-editor-image vazia"><ImagePlus size={26} /></div>}
          <label className="btn ghost">
            <ImagePlus size={15} />{p.imagemId ? 'Trocar foto' : 'Adicionar foto'}
            <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void enviarImagem(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          {p.imagemId ? <Botao variante="fantasma" onClick={() => mudar('imagemId', null)}><Trash2 size={15} />Tirar a foto</Botao> : null}
          <small className="muted">PNG, JPG ou WebP, até 1 MB.</small>
        </div>

        <div className="form-stack">
          <CampoDeTexto rotulo="Nome do produto" value={p.nome} maxLength={120} onChange={(e) => mudar('nome', e.target.value)} />
          <div className="form-grid">
            <Combo
              rotulo="Categoria"
              valor={p.categoria}
              aoMudar={(v) => mudar('categoria', v)}
              opcoes={[...new Set([...CATEGORIAS, ...categoriasNovas, p.categoria])].map((c) => ({ valor: c, rotulo: c }))}
              aoCriar={(v) => { setCategoriasNovas([...categoriasNovas, v]); mudar('categoria', v) }}
            />
            <Selecao rotulo="Vendido por" valor={p.unidade} aoMudar={(v) => mudar('unidade', v)} opcoes={UNIDADES} />
          </div>
          <div className="form-grid">
            <CampoDeTexto rotulo="Código do produto (SKU)" value={p.sku ?? ''} maxLength={60} onChange={(e) => mudar('sku', e.target.value)} />
            <CampoDeTexto
              rotulo="Tags (separadas por vírgula)"
              value={p.tags.join(',')}
              onChange={(e) => mudar('tags', e.target.value.split(',').map((s) => s.trim()).slice(0, 12))}
            />
          </div>
          <CampoDeTexto rotulo="Observações" value={p.notas} maxLength={1500} onChange={(e) => mudar('notas', e.target.value)} />

          <h3 className="product-editor-section">Preço</h3>
          <div className="form-grid">
            <CampoNumero rotulo="Custo de compra ou fabricação" valor={x.custo} aoMudar={(v) => premissa('custo', v)} />
            <CampoNumero rotulo="Quantidade incluída nesse custo" prefixo={p.unidade === 'unidade' ? 'un.' : p.unidade} valor={x.quantidade} aoMudar={(v) => premissa('quantidade', v)} />
          </div>
          <div className="form-grid">
            <CampoNumero rotulo="Preço que você cobra" valor={x.preco} aoMudar={(v) => premissa('preco', v)} />
            <CampoNumero rotulo="Margem de lucro desejada" prefixo="%" negativo valor={x.meta} aoMudar={(v) => premissa('meta', v)} />
          </div>
          {erro ? <Aviso tipo="erro">{erro}</Aviso> : calculo ? (
            <dl className="product-editor-result">
              <div><dt>Preço sugerido</dt><dd>{brl(calculo.sugerido)}</dd></div>
              <div><dt>{calculo.atual ? 'Margem com o seu preço' : 'Margem no sugerido'}</dt><dd>{avaliacao ? pct(avaliacao.margem) : '—'}</dd></div>
              <div><dt>Lucro por {p.unidade}</dt><dd>{avaliacao ? brl(avaliacao.lucro) : '—'}</dd></div>
            </dl>
          ) : null}
          <small className="muted">Taxas do canal, tributos, embalagem e custos extras ficam na precificação completa.</small>
        </div>
      </div>
      <div className="dialog-actions">
        <Botao variante="fantasma" onClick={() => aoCompleta(produto)}><SlidersHorizontal size={15} />Precificação completa</Botao>
        <Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao>
        <Botao ocupado={gravando} disabled={!calculo} onClick={() => void salvar()}>Salvar alterações</Botao>
      </div>
    </Janela>
  )
}
