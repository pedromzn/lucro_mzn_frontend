/** Guia Transporte do Lucro Certo — endereçamento, expedição auxiliar e entrega própria (PLANO-ETIQUETAS-TRANSPORTE). */
import { useEffect, useState, type FormEvent } from 'react'
import { Check, Download, MapPin, Package, Truck, Plus, Save, Pencil, Trash2, ArrowLeft } from 'lucide-react'
import { MODELOS_DE_TRANSPORTE, UFS, linhasDoEndereco, pedidoDeTransporteSchema, salvarModeloDeTransporteSchema, type EnderecoDeTransporte, type PedidoDeTransporte, type ModeloDeTransporteSalvo } from '@shared/transporte'
import { Aviso, Botao, CampoDeTexto, CampoNumero, Selecao, Janela, Vazio, data, erroDe } from '@/components/ui'
import { lucroApi } from '@/lib/api'
import { usePainel } from '@/lib/painel'
import { toast } from '@/lib/avisos'

type EnderecoNoFormulario = Omit<EnderecoDeTransporte, 'uf'> & { uf: EnderecoDeTransporte['uf'] | '' }
type RascunhoDeTransporte = Omit<PedidoDeTransporte, 'remetente' | 'destinatario'> & { remetente: EnderecoNoFormulario; destinatario: EnderecoNoFormulario }
const vazio = (): EnderecoNoFormulario => ({ nome: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', cep: '', telefone: '' })
const novoRascunho = (empresa: string): RascunhoDeTransporte => ({
  modelo: 'enderecamento', papel: 'a4', remetente: { ...vazio(), nome: empresa }, destinatario: vazio(),
  pedido: '', transportadora: '', servico: '', referenciaDoFrete: '', volumes: 1,
  peso: '', comprimento: '', largura: '', altura: '', documento: 'nfe', numeroDaNota: '', chaveFiscal: '', instrucoes: '',
})
const CAMPOS = [
  ['nome', 'Nome completo ou razão social', 70], ['cep', 'CEP', 9],
  ['logradouro', 'Logradouro', 80], ['numero', 'Número ou S/N', 12],
  ['complemento', 'Complemento (opcional)', 60], ['bairro', 'Bairro', 50], ['cidade', 'Cidade', 50],
  ['telefone', 'Telefone com DDD', 20],
] as const
const ROTULOS: Record<string, string> = {
  remetente: 'Remetente', destinatario: 'Destinatário', pedido: 'Pedido', peso: 'Peso', comprimento: 'Comprimento', largura: 'Largura', altura: 'Altura',
  numeroDaNota: 'Número da NF-e', chaveFiscal: 'Chave fiscal', volumes: 'Volumes', transportadora: 'Transportadora', servico: 'Serviço', referenciaDoFrete: 'Referência do frete', instrucoes: 'Instruções',
  ...Object.fromEntries(CAMPOS.map(([campo, nome]) => [campo, nome])), uf: 'UF',
}

function CamposDeEndereco({ titulo, valor, aoMudar, telefoneObrigatorio = false }: { titulo: string; valor: EnderecoNoFormulario; aoMudar: (v: EnderecoNoFormulario) => void; telefoneObrigatorio?: boolean }) {
  return <fieldset className="tr-address">
    <legend>{titulo}</legend>
    <div className="form-grid">
      {CAMPOS.map(([campo, rotulo, limite]) => <CampoDeTexto key={campo} rotulo={`${rotulo}${campo === 'telefone' && !telefoneObrigatorio ? ' (opcional)' : ''}`} value={valor[campo]} maxLength={limite}
        required={campo !== 'complemento' && (campo !== 'telefone' || telefoneObrigatorio)}
        type={campo === 'telefone' ? 'tel' : 'text'} inputMode={campo === 'cep' ? 'numeric' : undefined}
        onChange={(e) => aoMudar({ ...valor, [campo]: e.target.value })} />)}
      <Selecao rotulo="UF" valor={valor.uf} aoMudar={(uf) => aoMudar({ ...valor, uf })} opcoes={[{ valor: '', rotulo: 'Selecione a UF' }, ...UFS]} />
    </div>
  </fieldset>
}

export default function EtiquetasDeTransporte() {
  const estado = usePainel((s) => s.estado)!
  const [dados, setDados] = useState<RascunhoDeTransporte>(() => novoRascunho(estado.empresa))
  const [modelos, setModelos] = useState<ModeloDeTransporteSalvo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroDaBiblioteca, setErroDaBiblioteca] = useState('')
  const [busca, setBusca] = useState('')
  const [formularioAberto, setFormularioAberto] = useState(false)
  const [modeloAtual, setModeloAtual] = useState<ModeloDeTransporteSalvo | null>(null)
  const [nomeDoModelo, setNomeDoModelo] = useState('')
  const [gravando, setGravando] = useState(false)
  const [paraExcluir, setParaExcluir] = useState<ModeloDeTransporteSalvo | null>(null)
  const [erroDoModelo, setErroDoModelo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erros, setErros] = useState<string[]>([])
  const mudar = <K extends keyof RascunhoDeTransporte>(campo: K, valor: RascunhoDeTransporte[K]) => setDados((atual) => ({ ...atual, [campo]: valor }))
  const modelo = MODELOS_DE_TRANSPORTE.find((m) => m.id === dados.modelo)!
  const termo = busca.toLocaleLowerCase('pt-BR')
  const visiveis = modelos.filter((m) => `${m.nome} ${m.dados.remetente.nome} ${m.dados.destinatario?.nome ?? ''}`.toLocaleLowerCase('pt-BR').includes(termo))

  async function carregar() {
    setCarregando(true)
    setErroDaBiblioteca('')
    try { setModelos((await lucroApi.modelosDeTransporte()).modelos) }
    catch (e) { setErroDaBiblioteca(erroDe(e, 'Não foi possível carregar os modelos.')) }
    finally { setCarregando(false) }
  }
  useEffect(() => { void carregar() }, [])

  function abrir(salvo: ModeloDeTransporteSalvo | null) {
    setModeloAtual(salvo)
    setNomeDoModelo(salvo?.nome ?? '')
    setDados(salvo ? { ...novoRascunho(estado.empresa), ...structuredClone(salvo.dados), destinatario: structuredClone(salvo.dados.destinatario ?? vazio()) } : novoRascunho(estado.empresa))
    setErros([])
    setErroDoModelo('')
    setFormularioAberto(true)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  async function salvar(comoNovo = false) {
    setErroDoModelo('')
    /* Pedido, nota e referência de frete nunca são padrões: cada remessa deve informá-los de novo. */
    const { pedido: _pedido, numeroDaNota: _nota, chaveFiscal: _chave, referenciaDoFrete: _frete, ...padroes } = dados
    const validacao = salvarModeloDeTransporteSchema.safeParse({
      ...(modeloAtual && !comoNovo ? { id: modeloAtual.id, revisao: modeloAtual.revisao } : {}),
      nome: nomeDoModelo,
      dados: { ...padroes, destinatario: Object.values(dados.destinatario).every((v) => !v.trim()) ? null : dados.destinatario },
    })
    if (!validacao.success) {
      setErroDoModelo(validacao.error.issues.map((i) => `${i.path[0] === 'nome' ? 'Nome do modelo' : i.path.filter((p) => p !== 'dados').map((p) => ROTULOS[p] ?? p).join(' → ')}: ${i.message}`).join(' '))
      return
    }
    setGravando(true)
    try {
      const salvo = await lucroApi.salvarModeloDeTransporte(validacao.data)
      setModeloAtual(salvo)
      setNomeDoModelo(salvo.nome)
      setModelos((atuais) => [salvo, ...atuais.filter((m) => m.id !== salvo.id)])
      toast('Modelo salvo. Você pode reutilizá-lo pela tabela de transporte.')
    } catch (e) { setErroDoModelo(erroDe(e)) } finally { setGravando(false) }
  }

  async function excluir() {
    if (!paraExcluir) return
    setGravando(true)
    setErroDaBiblioteca('')
    try {
      await lucroApi.excluirModeloDeTransporte(paraExcluir.id, paraExcluir.revisao)
      setModelos((atuais) => atuais.filter((m) => m.id !== paraExcluir.id))
      if (modeloAtual?.id === paraExcluir.id) { setModeloAtual(null); setNomeDoModelo('') }
      setParaExcluir(null)
      toast('Modelo excluído.')
    } catch (e) { setErroDaBiblioteca(erroDe(e)); setParaExcluir(null) } finally { setGravando(false) }
  }

  async function gerar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErros([])
    const validacao = pedidoDeTransporteSchema.safeParse(dados)
    if (!validacao.success) {
      setErros(validacao.error.issues.map((i) => `${i.path.map((p) => ROTULOS[p] ?? p).join(' → ')}: ${i.message}`))
      return
    }
    setOcupado(true)
    try {
      const pdf = await lucroApi.gerarEtiquetasDeTransporte(validacao.data)
      const url = URL.createObjectURL(pdf)
      const link = document.createElement('a')
      link.href = url
      link.download = `LucroCerto-transporte-${dados.modelo}.pdf`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast('PDF gerado. Imprima em tamanho real, 100%.')
    } catch (erro) { setErros([erroDe(erro)]) } finally { setOcupado(false) }
  }

  return <div className="tr-page">
    {!formularioAberto ? <section className="panel tr-library" aria-label="Modelos de transporte salvos">
      <div className="between tr-library-head">
        <div><h2>Seus modelos de transporte</h2><p className="muted small">Reutilize os dados salvos e ajuste o destino e os volumes de cada envio.</p></div>
        {estado.podeEscrever ? <Botao disabled={gravando} onClick={() => abrir(null)}><Plus size={16} />Novo modelo</Botao> : null}
      </div>
      <div className="tr-library-tools"><CampoDeTexto rotulo="Buscar modelo" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, remetente ou destinatário" /><Botao variante="fantasma" ocupado={carregando} onClick={carregar}>Atualizar tabela</Botao></div>
      {erroDaBiblioteca ? <Aviso tipo="erro">{erroDaBiblioteca}</Aviso> : null}
      {carregando ? <p role="status" className="muted small">Carregando modelos…</p> : visiveis.length ? <div className="tr-library-table"><table>
        <thead><tr><th>Modelo</th><th>Remetente</th><th>Destinatário padrão</th><th>Papel</th><th>Atualizado</th><th>Ações</th></tr></thead>
        <tbody>{visiveis.map((m) => <tr key={m.id}>
          <td><strong>{m.nome}</strong><small>{MODELOS_DE_TRANSPORTE.find((tipo) => tipo.id === m.dados.modelo)?.nome}</small></td>
          <td>{m.dados.remetente.nome}<small>{m.dados.remetente.cidade} / {m.dados.remetente.uf}</small></td>
          <td>{m.dados.destinatario?.nome ?? 'A definir em cada envio'}</td>
          <td>{m.dados.papel === 'a4' ? 'A4 · 2 por folha' : 'Térmica · 10 × 15 cm'}</td>
          <td>{data(m.atualizadoEm)}</td>
          <td><div className="actions"><Botao variante="secundario" disabled={gravando} onClick={() => abrir(m)}>Usar modelo</Botao>{estado.podeEscrever ? <><Botao variante="fantasma" aria-label={`Editar modelo ${m.nome}`} disabled={gravando} onClick={() => abrir(m)}><Pencil size={15} /></Botao><Botao variante="fantasma" aria-label={`Excluir modelo ${m.nome}`} disabled={gravando} onClick={() => setParaExcluir(m)}><Trash2 size={15} /></Botao></> : null}</div></td>
        </tr>)}</tbody>
      </table></div> : !erroDaBiblioteca ? <Vazio titulo={busca ? 'Nenhum modelo encontrado.' : 'Nenhum modelo de transporte salvo.'}>{busca ? 'Tente outro nome na busca.' : 'Crie seu primeiro modelo para não preencher o remetente e as configurações de impressão a cada envio.'}</Vazio> : null}
    </section> : null}
    {formularioAberto ? <>
    <div className="between tr-editor-head" id="transporte-formulario"><div><h2>{modeloAtual ? `Usando: ${modeloAtual.nome}` : 'Novo modelo de transporte'}</h2><p className="muted small">Pedido, nota fiscal e referência do frete são preenchidos novamente em cada envio.</p></div><Botao variante="fantasma" disabled={ocupado || gravando} onClick={() => setFormularioAberto(false)}><ArrowLeft size={16} />Voltar aos modelos</Botao></div>
    <Aviso>Para Correios e transportadoras, a contratação e a identificação oficial são feitas no serviço de frete. Estes modelos organizam o endereçamento e os volumes; não compram frete nem emitem rastreamento.</Aviso>
    <form onSubmit={gerar} className="lbl-layout">
      <div className="lbl-steps">
        <section className="panel lbl-step">
          <div className="lbl-step-head"><span className="lbl-step-number">1</span><div><h2>Tipo da etiqueta</h2><p className="muted small">Escolha conforme a forma de entrega.</p></div></div>
          <div className="tr-models" role="group" aria-label="Tipo de etiqueta de transporte">
            {MODELOS_DE_TRANSPORTE.map((m, i) => {
              const Icone = [MapPin, Truck, Package][i]
              return <button type="button" key={m.id} aria-pressed={dados.modelo === m.id} className={`tr-model${dados.modelo === m.id ? ' active' : ''}`} onClick={() => { mudar('modelo', m.id); setErros([]) }}>
                <Icone size={21} /><strong>{m.nome}{dados.modelo === m.id ? <Check size={15} /> : null}</strong><small>{m.descricao}</small>
              </button>
            })}
          </div>
          <p className="small muted tr-model-note">{dados.modelo === 'enderecamento' ? 'Leve ao atendimento para contratar a postagem e receber a identificação oficial. A área reservada deve ficar livre.' : dados.modelo === 'expedicao' ? 'Use junto da etiqueta oficial exigida pela transportadora. A referência abaixo é a que você recebeu na contratação do frete.' : 'Para motoboy, frota ou entregador próprio. O recibo será preenchido no recebimento.'}</p>
        </section>
        <section className="panel lbl-step">
          <div className="lbl-step-head"><span className="lbl-step-number">2</span><div><h2>Quem envia e quem recebe</h2><p className="muted small">Confira os endereços antes de imprimir. Use S/N para endereço sem número.</p></div></div>
          <CamposDeEndereco titulo="Remetente" valor={dados.remetente} aoMudar={(v) => mudar('remetente', v)} />
          <CamposDeEndereco titulo="Destinatário" valor={dados.destinatario} telefoneObrigatorio={dados.modelo === 'local'} aoMudar={(v) => mudar('destinatario', v)} />
        </section>
        <section className="panel lbl-step">
          <div className="lbl-step-head"><span className="lbl-step-number">3</span><div><h2>Volumes e documentação</h2><p className="muted small">Uma etiqueta numerada por volume. Peso e medidas devem ser iguais entre os volumes deste arquivo.</p></div></div>
          <div className="form-grid">
            <CampoDeTexto rotulo="Referência do pedido" required maxLength={35} value={dados.pedido} onChange={(e) => mudar('pedido', e.target.value)} />
            <CampoDeTexto rotulo="Quantidade de volumes" type="number" min={1} max={30} step={1} required value={dados.volumes || ''} onChange={(e) => mudar('volumes', Number(e.target.value))} />
            {(['peso', 'comprimento', 'largura', 'altura'] as const).map((campo) => <CampoNumero key={campo} rotulo={`${ROTULOS[campo]} por volume`} prefixo={campo === 'peso' ? 'kg' : 'cm'} valor={dados[campo]} aoMudar={(v) => mudar(campo, v)} />)}
          </div>
          {dados.modelo === 'expedicao' ? <div className="form-grid tr-freight">
            <CampoDeTexto rotulo="Transportadora contratada" required maxLength={45} value={dados.transportadora} onChange={(e) => mudar('transportadora', e.target.value)} />
            <CampoDeTexto rotulo="Serviço contratado" required maxLength={40} value={dados.servico} onChange={(e) => mudar('servico', e.target.value)} />
            <CampoDeTexto rotulo="Referência fornecida no frete" required maxLength={45} value={dados.referenciaDoFrete} onChange={(e) => mudar('referenciaDoFrete', e.target.value)} />
          </div> : null}
          <div className="form-grid tr-freight">
            <Selecao rotulo="Documento já emitido" valor={dados.documento} aoMudar={(v) => setDados((atual) => ({ ...atual, documento: v, numeroDaNota: '', chaveFiscal: '' }))} opcoes={[{ valor: 'nfe', rotulo: 'NF-e / DANFE' }, { valor: 'dce', rotulo: 'DC-e / DACE (quando aplicável)' }]} />
            {dados.documento === 'nfe' ? <CampoDeTexto rotulo="Número da NF-e" required inputMode="numeric" maxLength={9} value={dados.numeroDaNota} onChange={(e) => mudar('numeroDaNota', e.target.value)} /> : null}
          </div>
          <CampoDeTexto rotulo={`Chave de acesso de 44 dígitos${dados.documento === 'nfe' ? ' (opcional)' : ''}`} required={dados.documento === 'dce'} inputMode="numeric" maxLength={44} value={dados.chaveFiscal} onChange={(e) => mudar('chaveFiscal', e.target.value)} />
          <p className="muted small">Anexe o DANFE ou a DACE do documento emitido. A etiqueta apenas informa a referência; não autoriza nem consulta o documento fiscal. DC-e é usada somente quando houver dispensa de nota fiscal.</p>
          <CampoDeTexto rotulo="Instruções de entrega (opcional)" maxLength={120} value={dados.instrucoes} onChange={(e) => mudar('instrucoes', e.target.value)} dica="Ex.: portaria, horário de recebimento ou ponto de referência. Evite informações pessoais desnecessárias." />
        </section>
      </div>
      <aside className="tr-aside">
        <section className="panel lbl-step">
          <div id="transporte-salvar-modelo" className="tr-save-model">
            <CampoDeTexto rotulo="Nome do modelo" maxLength={100} value={nomeDoModelo} onChange={(e) => setNomeDoModelo(e.target.value)} placeholder="Ex.: Loja Centro · caixa pequena" />
            <p className="muted small">Salva o remetente, papel, medidas e o destinatário preenchido. Para um modelo sem destino fixo, deixe todos os campos do destinatário vazios. Pedido, nota fiscal e referência do frete não são salvos no modelo.</p>
            {erroDoModelo ? <Aviso tipo="erro">{erroDoModelo}</Aviso> : null}
            <div className="actions"><Botao variante="secundario" ocupado={gravando} disabled={!estado.podeEscrever || ocupado} onClick={() => salvar()}><Save size={16} />{modeloAtual ? 'Salvar alterações no modelo' : 'Salvar modelo'}</Botao>{modeloAtual ? <Botao variante="fantasma" disabled={gravando || ocupado || !estado.podeEscrever} onClick={() => salvar(true)}>Salvar como novo</Botao> : null}</div>
          </div>
          <div className="between"><h2>Prévia do volume 1</h2><span className="muted small">100 × 150 mm</span></div>
          <div className={`tr-label tr-label-${dados.modelo}`} aria-label="Prévia da etiqueta de transporte">
            <header><strong>{modelo.nome.toLocaleUpperCase('pt-BR')}</strong><b>1 / {dados.volumes || 1}</b></header>
            <p>Pedido: {dados.pedido || 'Preencha o pedido'}</p>
            {dados.modelo === 'enderecamento' ? <div className="tr-reserved">USO EXCLUSIVO DOS CORREIOS</div> : null}
            <div className="tr-label-section"><b>DESTINATÁRIO</b>{linhasDoEndereco(dados.destinatario).map((linha, i) => <div key={i} className={linha.startsWith('CEP ') ? 'tr-cep' : ''}>{linha}</div>)}</div>
            <div className="tr-label-section"><b>REMETENTE</b>{linhasDoEndereco(dados.remetente).map((linha, i) => <div key={i}>{linha}</div>)}</div>
            <div className="tr-label-section"><b>VOLUME E DOCUMENTAÇÃO</b>
              {dados.modelo === 'expedicao' ? <><div>{dados.transportadora || 'Transportadora'} · {dados.servico || 'Serviço'}</div><div>Referência do frete: {dados.referenciaDoFrete || 'A preencher'}</div></> : null}
              <div>Peso por volume: {dados.peso || '—'} kg</div><div>{dados.comprimento || '—'} × {dados.largura || '—'} × {dados.altura || '—'} cm por volume</div>
              <div>{dados.documento === 'nfe' ? `NF-e nº ${dados.numeroDaNota || '—'} · Anexar DANFE` : 'DC-e emitida · Anexar DACE'}</div>
              {dados.chaveFiscal ? <div>Chave: {dados.chaveFiscal}</div> : null}
            </div>
            {dados.instrucoes ? <div className="tr-label-section"><b>INSTRUÇÕES DE ENTREGA</b><div>{dados.instrucoes}</div></div> : null}
            {dados.modelo === 'local' ? <div className="tr-label-section tr-receipt"><b>RECEBIMENTO</b><div>Recebedor: _____________________</div><div>Data: ____/____/______ Hora: ____:____</div><div>Assinatura: _____________________</div></div> : null}
            <footer>{dados.modelo === 'expedicao' ? 'Anexar a etiqueta oficial da transportadora.' : dados.modelo === 'enderecamento' ? 'Identificação oficial e postagem no atendimento.' : 'Identificação para logística própria.'}<br />Não substitui DANFE/DACE.</footer>
          </div>
          <p className="muted small">Prévia de conteúdo. Medidas e quebras finais são conferidas no PDF.</p>
          <Selecao rotulo="Papel de impressão" valor={dados.papel} aoMudar={(v) => mudar('papel', v)} opcoes={[{ valor: 'termica', rotulo: 'Térmica · 100 × 150 mm' }, { valor: 'a4', rotulo: 'A4 · duas etiquetas por folha' }]} />
          {dados.volumes > 0 ? <p className="muted small">{dados.papel === 'a4' ? `${Math.ceil(dados.volumes / 2)} folha(s) A4 · duas etiquetas de 10 × 15 cm lado a lado, com marcas de corte.` : `${dados.volumes} etiqueta(s) de 10 × 15 cm na bobina térmica.`}</p> : null}
          <p className="muted small">Imprima a 100%, sem ajustar à página. Fixe na maior face da embalagem, sem cobrir os códigos da etiqueta oficial com fita.</p>
          <div aria-live="polite">{erros.length ? <Aviso tipo="erro"><ul className="tr-errors">{erros.map((erro, i) => <li key={i}>{erro}</li>)}</ul></Aviso> : null}</div>
          <Botao type="submit" ocupado={ocupado} disabled={!estado.podeEscrever}><Download size={17} />Baixar {dados.volumes || 1} etiqueta{dados.volumes === 1 ? '' : 's'}</Botao>
          {!estado.podeEscrever ? <p className="small muted">Peça a alguém com permissão de edição para gerar o PDF.</p> : null}
          <p className="muted small">Baixar o PDF não altera o modelo salvo. Para guardar as mudanças, use Salvar modelo.</p>
        </section>
        <details className="panel tr-sources"><summary>Orientações e padrões consultados</summary>
          <p>Os modelos de endereçamento e expedição auxiliam a identificação; a aceitação e os códigos de postagem são do serviço contratado.</p>
          <a href="https://www.correios.com.br/enviar/precisa-de-ajuda/guia-de-enderecamento/guia-de-enderecamento" target="_blank" rel="noreferrer">Guia de endereçamento dos Correios</a>
          <a href="https://centraldeajuda.melhorenvio.com.br/hc/pt-br/articles/31220428174356-Como-preencher-os-dados-da-etiqueta-de-frete" target="_blank" rel="noreferrer">Dados para contratação do frete</a>
          <a href="https://legislacao.fazenda.sp.gov.br/Paginas/RC33575_2026.aspx" target="_blank" rel="noreferrer">Documentação: DC-e quando aplicável</a>
        </details>
      </aside>
    </form>
    </> : null}
    <Janela aberta={!!paraExcluir} aoFechar={() => { if (!gravando) setParaExcluir(null) }} titulo="Excluir modelo de transporte" descricao="O modelo será removido da biblioteca deste espaço de trabalho.">
      <p>Excluir <strong>{paraExcluir?.nome}</strong>?</p>
      <div className="actions section-gap"><Botao variante="fantasma" disabled={gravando} onClick={() => setParaExcluir(null)}>Cancelar</Botao><Botao variante="perigo" ocupado={gravando} onClick={excluir}>Excluir modelo</Botao></div>
    </Janela>
  </div>
}
