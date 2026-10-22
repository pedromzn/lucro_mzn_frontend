/**
 * As janelas de ação do espaço 3D — PLANO-ESTOQUE-3D.md, fatia 4.
 *
 * Duas: o MOVIMENTO (o formulário de sempre, `FormularioDeMovimento`, com o
 * lugar já escolhido) e o MOVER — transferir entre posições, ou guardar o que
 * está no chão. Para guardar, as sugestões vêm do servidor (`sugerirGuarda`),
 * com o motivo de cada uma; e sempre dá para escolher clicando no mapa.
 *
 * A chave da operação nasce uma vez por janela (o pedido já chega com ela): o
 * duplo clique não move duas vezes.
 */

import { useEffect, useState } from 'react'
import { MapPin, MousePointerClick } from 'lucide-react'
import { D } from '@shared/preco'
import { mesmoEndereco, rotuloDoEndereco, type Endereco, type Sugestao } from '@shared/enderecos'
import { lucroApi, type MapaDoEstoque } from '@/lib/api'
import { agir, usePainel } from '@/lib/painel'
import { CamposDoMovimento, type FormularioDeMovimento } from '@/components/FormularioDeMovimento'
import { Aviso, Botao, CampoDeTexto, CampoNumero, Combo, Janela, quantidade } from '@/components/ui'

export type Pedido =
  | { tipo: 'movimento'; form: FormularioDeMovimento; lugar?: string; tipos: readonly FormularioDeMovimento['tipo'][] }
  | { tipo: 'mover'; chave: string; produtoId: string; origem: Endereco | null; destino: Endereco | null; quantidade: string }

type Mover = Extract<Pedido, { tipo: 'mover' }>

export function JanelasDoEspaco({ mapa, pedido, aoFechar, aoEscolherNoMapa, aoGravar }: {
  mapa: MapaDoEstoque
  pedido: Pedido | null
  aoFechar: () => void
  aoEscolherNoMapa: (p: Mover) => void
  aoGravar: () => Promise<void>
}) {
  return (
    <>
      <Janela
        aberta={pedido?.tipo === 'movimento'}
        aoFechar={aoFechar}
        titulo={pedido?.tipo === 'movimento' && pedido.lugar ? 'Movimentar nesta posição' : 'Registrar movimentação'}
        descricao="Confira o produto, a quantidade e os valores antes de salvar."
      >
        {pedido?.tipo === 'movimento' ? <Movimento key={pedido.form.chaveDaOperacao} pedido={pedido} aoFechar={aoFechar} aoGravar={aoGravar} /> : null}
      </Janela>
      <Janela
        aberta={pedido?.tipo === 'mover'}
        aoFechar={aoFechar}
        titulo={pedido?.tipo === 'mover' && !pedido.origem ? 'Guardar no lugar' : 'Mover de lugar'}
        descricao="O saldo do produto não muda: só o lugar onde ele está."
      >
        {pedido?.tipo === 'mover' ? <MoverDeLugar key={pedido.chave} mapa={mapa} pedido={pedido} aoFechar={aoFechar} aoGravar={aoGravar} aoEscolherNoMapa={aoEscolherNoMapa} /> : null}
      </Janela>
    </>
  )
}

function Movimento({ pedido, aoFechar, aoGravar }: { pedido: Extract<Pedido, { tipo: 'movimento' }>; aoFechar: () => void; aoGravar: () => Promise<void> }) {
  const estado = usePainel((s) => s.estado)!
  const [form, setForm] = useState(pedido.form)
  const [ocupado, setOcupado] = useState(false)
  /* da posição, o produto é o que está nela; da entrada, qualquer um do catálogo */
  const produtos = estado.produtos.filter((p) => p.status === 'ativo' && (pedido.tipos.includes('entrada') || p.id === pedido.form.produtoId))
  return (
    <CamposDoMovimento
      form={form}
      aoMudar={setForm}
      produtos={produtos}
      canais={estado.canais}
      ocupado={ocupado}
      lugar={pedido.lugar}
      tipos={pedido.tipos}
      aoSalvar={async () => {
        setOcupado(true)
        try {
          const r = await agir(() => lucroApi.registrarMovimento(form), form.tipo === 'venda' ? 'Venda registrada e estoque atualizado.' : 'Movimentação registrada no histórico.')
          if (r) { aoFechar(); await aoGravar() }
        } finally {
          setOcupado(false)
        }
      }}
    />
  )
}

function MoverDeLugar({ mapa, pedido, aoFechar, aoGravar, aoEscolherNoMapa }: {
  mapa: MapaDoEstoque
  pedido: Mover
  aoFechar: () => void
  aoGravar: () => Promise<void>
  aoEscolherNoMapa: (p: Mover) => void
}) {
  const [produtoId, setProdutoId] = useState(pedido.produtoId)
  const [destino, setDestino] = useState<Endereco | null>(pedido.destino)
  /* da prateleira dá para devolver ao chão: destino "a guardar" é escolha, não falta de escolha */
  const [paraOChao, setParaOChao] = useState(false)
  const [qtd, setQtd] = useState(D(pedido.quantidade).toString())
  const [motivo, setMotivo] = useState('')
  const [sugestoes, setSugestoes] = useState<Sugestao[] | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const produto = mapa.produtos.find((p) => p.id === produtoId)
  const estrutura = (e: Endereco | null) => (e ? mapa.estruturas.find((x) => x.id === e.estruturaId) : undefined)
  const rotulo = (e: Endereco | null) => {
    const est = estrutura(e)
    return e && est ? rotuloDoEndereco(est, e.nivel, e.vao) : 'A guardar (chão do recebimento)'
  }
  const disponivel = pedido.origem
    ? mapa.posicoes.find((p) => p.produtoId === produtoId && mesmoEndereco(p, pedido.origem))?.quantidade ?? '0'
    : produto?.aGuardar ?? '0'

  useEffect(() => {
    if (pedido.origem || destino) return
    let viva = true
    setSugestoes(null)
    void lucroApi.sugestoesDeGuarda(produtoId).then((s) => { if (viva) setSugestoes(s) }).catch(() => { if (viva) setSugestoes([]) })
    return () => { viva = false }
  }, [produtoId, pedido.origem, destino])

  const escolhaPendente = !destino && !paraOChao
  const invalido = escolhaPendente || !D(qtd || 0).gt(0) || D(qtd || 0).gt(disponivel) || (!pedido.origem && !destino)
  const podeTrocarProduto = !pedido.origem
  const aGuardar = mapa.produtos.filter((p) => D(p.aGuardar).gt(0) && !p.arquivado)

  return (
    <div className="form-stack">
      {podeTrocarProduto && aGuardar.length > 1 ? (
        <Combo rotulo="Produto a guardar" valor={produtoId} aoMudar={(v) => { setProdutoId(v); setQtd(D(mapa.produtos.find((p) => p.id === v)?.aGuardar ?? '0').toString()) }} opcoes={aGuardar.map((p) => ({ valor: p.id, rotulo: p.nome }))} />
      ) : <p><strong>{produto?.nome}</strong></p>}
      <dl className="space-route">
        <div><dt>De</dt><dd>{rotulo(pedido.origem)}</dd></div>
        <div><dt>Para</dt><dd>{destino ? rotulo(destino) : paraOChao ? rotulo(null) : <span className="muted">escolha abaixo</span>}</dd></div>
      </dl>

      {!destino && !paraOChao ? (
        <div className="space-choices">
          {!pedido.origem ? (
            sugestoes === null ? <div className="skeleton" style={{ height: 64 }} /> : sugestoes.length ? sugestoes.map((s) => (
              <button key={`${s.endereco.estruturaId}:${s.endereco.nivel}:${s.endereco.vao}`} className="space-choice" onClick={() => setDestino(s.endereco)}>
                <MapPin size={16} /><span><strong>{s.rotulo}</strong><small>{s.motivo}</small></span>
              </button>
            )) : <Aviso>A planta não tem posição livre. Ajuste o espaço ou escolha uma posição ocupada no mapa.</Aviso>
          ) : (
            <button className="space-choice" onClick={() => setParaOChao(true)}>
              <MapPin size={16} /><span><strong>Devolver para “a guardar”</strong><small>Volta para o chão do recebimento.</small></span>
            </button>
          )}
          <Botao variante="secundario" onClick={() => aoEscolherNoMapa({ ...pedido, produtoId, quantidade: qtd })}><MousePointerClick size={16} />Escolher no mapa</Botao>
        </div>
      ) : (
        <button className="text-link" onClick={() => { setDestino(null); setParaOChao(false) }}>Trocar o destino</button>
      )}

      <CampoNumero rotulo="Quantidade" prefixo={produto?.unidade ?? 'un.'} valor={qtd} aoMudar={setQtd} dica={`Disponível na origem: ${quantidade(disponivel)} ${produto?.unidade ?? ''}`} />
      <CampoDeTexto rotulo="Observação — opcional" value={motivo} maxLength={250} onChange={(e) => setMotivo(e.target.value)} />
      <Botao
        ocupado={ocupado}
        disabled={invalido}
        onClick={async () => {
          setOcupado(true)
          try {
            const r = await agir(
              () => lucroApi.transferir({ chaveDaOperacao: pedido.chave, produtoId, quantidade: qtd, origem: pedido.origem, destino: paraOChao ? null : destino, motivo }),
              pedido.origem ? 'Mercadoria movida.' : 'Mercadoria guardada.',
            )
            if (r) { aoFechar(); await aoGravar() }
          } finally {
            setOcupado(false)
          }
        }}
      >
        {pedido.origem ? 'Confirmar mudança' : 'Guardar'}
      </Botao>
    </div>
  )
}
