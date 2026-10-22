/**
 * Organizar o espaço — PLANO-ESTOQUE-3D.md, fatia 6.
 *
 * O painel do editor da planta: o tamanho do espaço, acrescentar estrutura,
 * a ficha da estrutura selecionada (nome, tipo, zona, níveis, vãos, girar,
 * tirar) e montar a planta de novo. Mover é arrastar na própria cena.
 *
 * Quem decide se cabe é o servidor (`alterarEstrutura` confere sobreposição,
 * limites e mercadoria nos níveis que sairiam); a tela só antecipa o vermelho.
 */

import { useEffect, useState } from 'react'
import { Plus, RotateCw, Trash2, X } from 'lucide-react'
import {
  MEDIDAS, NOMES_DAS_ZONAS, NOMES_DOS_TIPOS, TIPOS_DE_ESTRUTURA, ZONAS, lugarLivre,
  type DadosDaEstrutura, type Tema, type TipoDeEstrutura, type Zona,
} from '@shared/enderecos'
import { lucroApi, type MapaDoEstoque } from '@/lib/api'
import { agir } from '@/lib/painel'
import { toast } from '@/lib/avisos'
import { Aviso, Botao, CampoDeTexto, CampoNumero, Selecao } from '@/components/ui'

const faixa = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, i) => String(min + i))

export function EditorDoEspaco({ mapa, editada, aoEditar, aoConcluir, aoGravar }: {
  mapa: MapaDoEstoque
  editada: string | null
  aoEditar: (id: string | null) => void
  aoConcluir: () => void
  aoGravar: () => Promise<void>
}) {
  const ambiente = mapa.ambiente!
  const tema = ambiente.tema
  const nomes = NOMES_DOS_TIPOS[tema]
  const [tamanho, setTamanho] = useState({ largura: String(ambiente.largura), profundidade: String(ambiente.profundidade) })
  const [nova, setNova] = useState<{ tipo: TipoDeEstrutura; zona: Zona }>({ tipo: 'estante', zona: 'deposito' })
  const [ficha, setFicha] = useState<DadosDaEstrutura | null>(null)
  const [tirando, setTirando] = useState(false)
  const [remontando, setRemontando] = useState<Tema | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const estrutura = mapa.estruturas.find((e) => e.id === editada) ?? null

  useEffect(() => { setTamanho({ largura: String(ambiente.largura), profundidade: String(ambiente.profundidade) }) }, [ambiente.largura, ambiente.profundidade])
  /* a ficha acompanha a estrutura escolhida — e a posição dela depois de um arraste */
  useEffect(() => { setFicha(estrutura ? { ...estrutura } : null); setTirando(false) }, [estrutura?.id, estrutura?.x, estrutura?.z, estrutura?.rotacao])

  const gravar = async <T,>(acao: () => Promise<T>, aviso: string) => {
    setOcupado(true)
    try {
      if ((await agir(acao, aviso)) !== null) await aoGravar()
    } finally {
      setOcupado(false)
    }
  }

  const acrescentar = async () => {
    const dados = { tipo: nova.tipo, zona: nova.zona, rotacao: 0 as const, niveis: MEDIDAS[nova.tipo].niveis.padrao, vaos: MEDIDAS[nova.tipo].vaos.padrao,
      nome: `${nomes[nova.tipo]} ${mapa.estruturas.filter((e) => e.tipo === nova.tipo).length + 1}` }
    const vaga = lugarLivre(dados, mapa.estruturas, ambiente)
    if (!vaga) { toast.error('Não há vaga para mais uma estrutura deste tamanho. Aumente o espaço ou tire alguma.'); return }
    setOcupado(true)
    try {
      const criada = await agir(() => lucroApi.criarEstrutura({ ...dados, ...vaga }), 'Estrutura acrescentada. Arraste para o lugar certo.')
      if (criada) { await aoGravar(); aoEditar(criada.id) }
    } finally {
      setOcupado(false)
    }
  }

  return (
    <aside className="panel space-side" aria-label="Organizar o espaço">
      <div className="between">
        <div>
          <h3>Organizar o espaço</h3>
          <small className="muted">Clique numa estrutura para editar; arraste para mudar de lugar.</small>
        </div>
        <Botao variante="secundario" onClick={aoConcluir}>Concluir</Botao>
      </div>

      {ficha && estrutura ? (
        <section className="space-editor-card">
          <div className="between">
            <strong>{estrutura.nome}</strong>
            <button className="icon-button" aria-label="Fechar a ficha" onClick={() => aoEditar(null)}><X size={17} /></button>
          </div>
          <CampoDeTexto rotulo="Nome" value={ficha.nome} maxLength={60} onChange={(e) => setFicha({ ...ficha, nome: e.target.value })} />
          <div className="form-grid">
            <Selecao rotulo="Tipo" valor={ficha.tipo} aoMudar={(tipo) => setFicha({
              ...ficha, tipo,
              niveis: Math.min(Math.max(ficha.niveis, MEDIDAS[tipo].niveis.minimo), MEDIDAS[tipo].niveis.maximo),
              vaos: Math.min(Math.max(ficha.vaos, MEDIDAS[tipo].vaos.minimo), MEDIDAS[tipo].vaos.maximo),
            })} opcoes={TIPOS_DE_ESTRUTURA.map((t) => ({ valor: t, rotulo: nomes[t] }))} />
            <Selecao rotulo="Zona" valor={ficha.zona} aoMudar={(zona) => setFicha({ ...ficha, zona })} opcoes={ZONAS.map((z) => ({ valor: z, rotulo: NOMES_DAS_ZONAS[z] }))} />
          </div>
          <div className="form-grid">
            <Selecao rotulo="Níveis" valor={String(ficha.niveis)} aoMudar={(v) => setFicha({ ...ficha, niveis: Number(v) })} opcoes={faixa(MEDIDAS[ficha.tipo].niveis.minimo, MEDIDAS[ficha.tipo].niveis.maximo)} />
            <Selecao rotulo="Vãos" valor={String(ficha.vaos)} aoMudar={(v) => setFicha({ ...ficha, vaos: Number(v) })} opcoes={faixa(MEDIDAS[ficha.tipo].vaos.minimo, MEDIDAS[ficha.tipo].vaos.maximo)} />
          </div>
          <div className="space-side-actions">
            <Botao ocupado={ocupado} onClick={() => void gravar(() => lucroApi.alterarEstrutura(estrutura.id, ficha), 'Estrutura atualizada.')}>Salvar</Botao>
            <Botao variante="fantasma" disabled={ocupado} onClick={() => void gravar(() => lucroApi.alterarEstrutura(estrutura.id, { rotacao: ((estrutura.rotacao + 90) % 360) as DadosDaEstrutura['rotacao'] }), 'Estrutura girada.')}>
              <RotateCw size={15} />Girar 90°
            </Botao>
            {tirando ? (
              <Botao variante="perigo" ocupado={ocupado} onClick={() => void gravar(async () => { await lucroApi.retirarEstrutura(estrutura.id); aoEditar(null); return true }, 'Estrutura tirada da planta.')}>Confirmar</Botao>
            ) : (
              <Botao variante="fantasma" onClick={() => setTirando(true)}><Trash2 size={15} />Tirar</Botao>
            )}
          </div>
          {tirando ? <Aviso tipo="atencao">Só sai da planta vazia. O histórico continua mostrando o que passou por ela.</Aviso> : null}
        </section>
      ) : (
        <div className="space-list">
          {mapa.estruturas.map((e) => (
            <button key={e.id} className="space-choice" onClick={() => aoEditar(e.id)}>
              <span><strong>{e.nome}</strong><small>{nomes[e.tipo]} · {NOMES_DAS_ZONAS[e.zona]} · {e.niveis} × {e.vaos}</small></span>
            </button>
          ))}
        </div>
      )}

      <section className="space-editor-card">
        <strong>Acrescentar estrutura</strong>
        <div className="form-grid">
          <Selecao rotulo="Tipo" valor={nova.tipo} aoMudar={(tipo) => setNova({ ...nova, tipo })} opcoes={TIPOS_DE_ESTRUTURA.map((t) => ({ valor: t, rotulo: nomes[t] }))} />
          <Selecao rotulo="Zona" valor={nova.zona} aoMudar={(zona) => setNova({ ...nova, zona })} opcoes={ZONAS.map((z) => ({ valor: z, rotulo: NOMES_DAS_ZONAS[z] }))} />
        </div>
        <Botao variante="secundario" ocupado={ocupado} onClick={() => void acrescentar()}><Plus size={15} />Acrescentar</Botao>
      </section>

      <section className="space-editor-card">
        <strong>Tamanho do espaço</strong>
        <div className="form-grid">
          <CampoNumero rotulo="Largura" prefixo="m" valor={tamanho.largura} aoMudar={(v) => setTamanho({ ...tamanho, largura: v })} />
          <CampoNumero rotulo="Profundidade" prefixo="m" valor={tamanho.profundidade} aoMudar={(v) => setTamanho({ ...tamanho, profundidade: v })} />
        </div>
        <Botao variante="fantasma" ocupado={ocupado} onClick={() => void gravar(() => lucroApi.alterarEspaco({ largura: Number(tamanho.largura), profundidade: Number(tamanho.profundidade) }), 'Tamanho do espaço atualizado.')}>Salvar tamanho</Botao>
      </section>

      <section className="space-editor-card">
        <strong>Montar a planta de novo</strong>
        <small className="muted">Troca todas as estruturas pela planta pronta de um tema. Só com as estruturas vazias — devolva a mercadoria para “a guardar” antes.</small>
        {remontando ? (
          <div className="space-side-actions">
            <Selecao rotulo="Planta de" valor={remontando} aoMudar={setRemontando} opcoes={mapa.temas.map((t) => ({ valor: t.tema, rotulo: t.nome }))} />
            <Botao variante="perigo" ocupado={ocupado} onClick={() => void gravar(async () => { const r = await lucroApi.montarEspaco(remontando, true); aoEditar(null); setRemontando(null); return r }, 'Planta montada de novo.')}>Confirmar</Botao>
            <Botao variante="fantasma" onClick={() => setRemontando(null)}>Cancelar</Botao>
          </div>
        ) : (
          <Botao variante="fantasma" disabled={mapa.posicoes.length > 0} onClick={() => setRemontando(tema)}>Montar de novo</Botao>
        )}
      </section>
    </aside>
  )
}
