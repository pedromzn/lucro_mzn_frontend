/**
 * O cliente da API do painel do Lucro Certo.
 *
 * Três destinos, e quem decide é o proxy (o do Vite, e na instância o nginx do
 * `lucro.`): `/api/auth` e `/api/nucleo` vão para o Núcleo, o resto de `/api`
 * vai para o backend deste app (`:3020`). A identidade é o cookie de sessão; a
 * empresa e o espaço saem do Núcleo, nunca daqui.
 *
 * A parte do Núcleo e da loja é a do painel do MKT (`mzn_mkt/frontend/src/lib/api.ts`):
 * as rotas são da suíte, e as telas de conta são as mesmas.
 */

import type { Calculo, Premissas } from '@shared/preco'
import type { DadosDoCanal, Preferencias } from '@shared/contratos'
import type { LayoutDeEtiqueta, EstiloDeEtiqueta } from '@shared/etiquetas'
import type { Ambiente, DadosDaEstrutura, Endereco, Estrutura, PedidoDeTransferencia, Sugestao, Tarefa, Tema } from '@shared/enderecos'
import { cabecalhosDeSessao, encerrarSessaoPorToken } from './sessao'
import type { RetratoDaSessao } from './sessao'

export class ErroDaApi extends Error {
  constructor(message: string, public codigo?: string, public status?: number, public detalhes?: unknown) {
    super(message)
  }
}

/**
 * Os 402 que significam "precisa assinar ou regularizar" — vão para a página DESTE
 * app na loja. Dois ficam de fora: `sem_assento`, que é problema do
 * administrador (liberar uma licença, e a mensagem dele explica o que fazer), e
 * `app_nao_contratado` (22/10/2026), porque no primeiro acesso o painel começa a
 * avaliação sozinho (`painel.ts`) em vez de mandar à loja.
 */
const CODIGOS_DE_ASSINATURA = new Set(['trial_expirado', 'assinatura_vencida', 'app_pausado'])

async function pedir(path: string, options: RequestInit = {}): Promise<Response> {
  const resposta = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData || options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...cabecalhosDeSessao(),
      ...(options.headers || {}),
    },
  })
  /* 401 é fim de sessão, não erro de tela: desloga e manda para a entrada */
  if (resposta.status === 401) {
    encerrarSessaoPorToken()
    throw new ErroDaApi('Sua sessão expirou. Entre novamente.', 'nao_autenticado', 401)
  }
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}))
    /* 402 é assinatura: quem venceu vai para a LOJA, o único lugar onde resolve — deslogar seria perder o cliente na porta */
    if (resposta.status === 402 && CODIGOS_DE_ASSINATURA.has(corpo?.codigo)) location.assign(`${URL_DA_LOJA}/app/lucro`)
    throw new ErroDaApi(corpo?.error || `Falha na requisição (${resposta.status})`, corpo?.codigo, resposta.status, corpo?.details)
  }
  return resposta
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const resposta = await pedir(path, options)
  if (resposta.status === 204) return undefined as T
  const corpo = await resposta.json().catch(() => ({}))
  return (corpo?.data ?? corpo) as T
}

/** Para o que volta ARQUIVO (o PDF de etiquetas): a resposta inteira, para a tela baixar. */
export async function arquivo(path: string, options: RequestInit = {}): Promise<Blob> {
  return (await pedir(path, options)).blob()
}

const json = (corpo: unknown, method = 'POST'): RequestInit => ({ method, body: JSON.stringify(corpo) })

// ── Núcleo: usuários, empresa, espaços e licenças ───────────────────────────

export interface UsuarioDaEmpresa {
  id: string
  nome: string
  email: string
  cargo: string | null
  telefone: string | null
  avatar_url: string | null
  papel: 'super_admin' | 'admin' | 'membro'
  status: 'convidado' | 'ativo' | 'suspenso' | 'removido'
  convite_pendente: boolean
  convite_expira_em: string | null
  ultimo_login_em: string | null
  criado_em: string
  aplicativos: Array<{ aplicativo: string; papel_no_app: string }>
  /** `null` = gestor, que enxerga todos os espaços */
  espacos: Array<{ id: string; nome: string }> | null
}

export interface EntradaDeUsuario {
  nome: string
  email?: string
  papel: 'super_admin' | 'admin' | 'membro'
  cargo?: string | null
  telefone?: string | null
  espacos?: string[]
  aplicativos?: Array<{ aplicativo: string; papel_no_app?: string }>
}

export interface ResultadoDoConvite {
  id: string
  email: string
  convite: { link: string | null; enviado: boolean; motivo: string | null }
}

export interface DadosDaEmpresa {
  id: string
  slug: string
  nome_fantasia: string
  razao_social: string | null
  cnpj: string | null
  email: string | null
  telefone: string | null
  endereco: Record<string, string>
  dominio: string | null
  url_termos: string | null
  url_privacidade: string | null
  logo_url: string | null
  pais: string
  timezone: string
  locale: string
  moeda: string
  status: string
  criada_em: string
}

export interface EspacoDaEmpresa {
  id: string
  nome: string
  descricao: string | null
  cor: string | null
  padrao: boolean
  arquivado_em: string | null
  membros: number | null
  criado_em: string
}

export interface LicencaDeApp {
  aplicativo: string
  nome: string
  descricao: string | null
  icone: string | null
  cor: string | null
  contratado: boolean
  status: string | null
  plano: string | null
  provisionado: boolean
  assentos: { contratados: number; usados: number; disponiveis: number } | null
  papeis: Array<{ id: string; nome: string; descricao?: string }>
}

export const nucleoApi = {
  usuarios: () => request<UsuarioDaEmpresa[]>('/nucleo/usuarios'),
  convidar: (entrada: EntradaDeUsuario) =>
    request<ResultadoDoConvite>('/nucleo/usuarios', { method: 'POST', body: JSON.stringify(entrada) }),
  atualizarUsuario: (id: string, entrada: Partial<EntradaDeUsuario>) =>
    request<{ ok: true }>(`/nucleo/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(entrada) }),
  reenviarConvite: (id: string) =>
    request<{ link: string | null; enviado: boolean; motivo: string | null }>(
      `/nucleo/usuarios/${id}/reenviar-convite`,
      { method: 'POST' },
    ),
  desativarUsuario: (id: string) => request<{ ok: true }>(`/nucleo/usuarios/${id}/desativar`, { method: 'POST' }),
  reativarUsuario: (id: string) => request<{ ok: true }>(`/nucleo/usuarios/${id}/reativar`, { method: 'POST' }),
  removerUsuario: (id: string) => request<{ ok: true }>(`/nucleo/usuarios/${id}`, { method: 'DELETE' }),

  empresa: () => request<DadosDaEmpresa>('/nucleo/empresa'),
  salvarEmpresa: (entrada: Partial<DadosDaEmpresa>) =>
    request<DadosDaEmpresa>('/nucleo/empresa', { method: 'PUT', body: JSON.stringify(entrada) }),

  espacos: () => request<EspacoDaEmpresa[]>('/nucleo/espacos'),
  criarEspaco: (entrada: { nome: string; descricao?: string; cor?: string }) =>
    request<EspacoDaEmpresa>('/nucleo/espacos', { method: 'POST', body: JSON.stringify(entrada) }),
  salvarEspaco: (id: string, entrada: { nome?: string; descricao?: string | null; cor?: string | null; padrao?: boolean }) =>
    request<EspacoDaEmpresa>(`/nucleo/espacos/${id}`, { method: 'PUT', body: JSON.stringify(entrada) }),
  arquivarEspaco: (id: string) => request<{ ok: true }>(`/nucleo/espacos/${id}`, { method: 'DELETE' }),

  licencas: () => request<LicencaDeApp[]>('/nucleo/licencas'),
}


// ─── Loja e assinatura (Núcleo) ──────────────────────────────────────────────

export type CicloDeCobranca = 'mensal' | 'anual'

export interface PrecoDoPlano {
  /** o que se cobra por assento no ciclo: no anual, o ano inteiro */
  total: number
  /** o mesmo preço dividido por mês — é assim que a vitrine compara */
  mensalEquivalente: number
}

export interface PlanoDaLoja {
  codigo: string
  nome: string
  resumo: string
  destaques: string[]
  recomendado: boolean
  limites: { armazenamentoBytes: number; espacosDeTrabalho: number | null }
  precos: Record<CicloDeCobranca, PrecoDoPlano>
}

export interface AdicionalDaLoja {
  codigo: string
  nome: string
  resumo: string
  maximo: number
  acrescenta: { armazenamentoBytes: number }
  precos: Record<CicloDeCobranca, PrecoDoPlano>
}

export interface Vitrine {
  aplicativo: string
  adicionais: AdicionalDaLoja[]
  descontoAnual: number
  diasDeTrial: number
  assentosMin: number
  assentosMax: number
  cobrancaLigada: boolean
  modoDeTeste: boolean
  chavePublicavel: string | null
  planos: PlanoDaLoja[]
}

export interface SituacaoDaAssinatura {
  aplicativo: string
  status: 'trial' | 'ativa' | 'pausada' | 'cancelada' | 'expirada'
  planoCodigo: string | null
  planoNome: string | null
  ciclo: CicloDeCobranca | null
  assentos: number
  assentosUsados: number
  trialExpiraEm: string | null
  periodoFim: string | null
  cancelarNoFim: boolean
  inadimplenteDesde: string | null
  /** até quando o acesso vale, com os 5 dias de carência (desde 08/10/2026) */
  acessoAte?: string | null
  /** o período pago acabou e estamos na carência */
  emCarencia?: boolean
  diasRestantes: number | null
  ativa: boolean
  temCobranca: boolean
  adicionais: Record<string, number>
  armazenamentoBytes: number | null
  espacosDeTrabalho: number | null
}

export interface PreviaDaAlteracao {
  /** o que se cobra agora, em centavos */
  ajusteAgora: number
  novoTotalDoCiclo: number
  totalAtualDoCiclo: number
  ciclo: CicloDeCobranca
  planoNome: string
  assentos: number
  adicionais: Array<{ codigo: string; nome: string; blocos: number; total: number }>
  proximaCobranca: string | null
}

export interface PedidoDeAlteracao {
  plano?: string
  assentos?: number
  adicionais?: Record<string, number>
}

export const lojaApi = {
  vitrine: (app = 'lucro') => request<Vitrine>(`/nucleo/billing/planos?app=${app}`),
  assinatura: (app = 'lucro') => request<SituacaoDaAssinatura>(`/nucleo/billing/assinatura?app=${app}`),

  /**
   * Abre o checkout. Devolve a URL do gateway — a tela NAVEGA para ela.
   *
   * Note o que NÃO vai no corpo: preço. Ele é resolvido no servidor pelo
   * catálogo; mandar daqui seria deixar o navegador decidir quanto pagar.
   */
  checkout: (entrada: { plano: string; ciclo: CicloDeCobranca; assentos: number; aplicativo?: string }) =>
    request<{ url: string }>('/nucleo/billing/checkout', { method: 'POST', body: JSON.stringify(entrada) }),

  /** quanto custa mudar, sem mudar nada */
  previa: (entrada: PedidoDeAlteracao) =>
    request<PreviaDaAlteracao>('/nucleo/billing/previa', { method: 'POST', body: JSON.stringify(entrada) }),

  /** aplica a mudança na assinatura existente, com rateio */
  alterar: (entrada: PedidoDeAlteracao) =>
    request<{ ajusteAgora: number }>('/nucleo/billing/alterar', { method: 'POST', body: JSON.stringify(entrada) }),

  portal: () => request<{ url: string }>('/nucleo/billing/portal', { method: 'POST' }),
}

/** O que volta do link de confirmação: a conta criada, com a sessão inteira (`servico/cadastro.ts` no Núcleo). */
export type ConfirmacaoDeEmail = RetratoDaSessao

export const contaApi = {
  /**
   * Manda o pedido de cadastro. **Não devolve sessão** — devolve a promessa de
   * um e-mail. A conta nasce quando a pessoa clicar no link.
   */
  criar: (entrada: { nome: string; email: string; senha: string; empresa: string; aceite: boolean; aplicativo: string }) =>
    request<{ pendente: boolean; email: string }>('/auth/criar-conta', {
      method: 'POST', body: JSON.stringify(entrada),
    }),
  confirmarEmail: (token: string) =>
    request<ConfirmacaoDeEmail>('/auth/confirmar-email', {
      method: 'POST', body: JSON.stringify({ token }),
    }),
  /** reenvia para quem ainda NÃO tem conta — a tela de "confira seu e-mail" */
  reenviarCadastro: (email: string) =>
    request<{ enviado: boolean }>('/auth/reenviar-cadastro', {
      method: 'POST', body: JSON.stringify({ email }),
    }),
}

/**
 * Onde a loja responde.
 *
 * A loja é outro aplicativo, em outro endereço — como a `store.zoho.com` é
 * outro aplicativo do painel da Zoho. Em produção isto vira um subdomínio.
 */
export const URL_DA_LOJA = import.meta.env.VITE_LOJA_URL || 'http://localhost:5190'


// ── O Lucro Certo ───────────────────────────────────────────────────────────

export interface Produto {
  id: string
  nome: string
  sku: string | null
  categoria: string
  unidade: string
  status: 'ativo' | 'arquivado'
  favorito: boolean
  canalId: string | null
  imagemId: string | null
  tags: string[]
  notas: string
  premissas: Premissas
  revisao: number
  exemplo: boolean
  criadoEm: string
  atualizadoEm: string
  /** o cálculo de agora — `null` se as premissas guardadas ficaram impossíveis */
  calculo: Calculo | null
  erro?: string
}

/** O que a tela manda para gravar — sem o que o servidor calcula. */
export type ProdutoParaGravar = Omit<Produto, 'id' | 'revisao' | 'exemplo' | 'criadoEm' | 'atualizadoEm' | 'calculo' | 'erro'> & { id?: string; revisao?: number }

export interface Canal {
  id: string
  nome: string
  tipo: DadosDoCanal['tipo']
  dados: DadosDoCanal['dados']
  revisao: number
  atualizadoEm: string
}

export type TipoDeModelo = 'embalagem' | 'custo' | 'perfil'
export interface ModeloDeCusto {
  id: string
  nome: string
  tipo: TipoDeModelo
  dados: Record<string, unknown>
  revisao: number
}

export interface Cenario {
  id: string
  produtoId: string | null
  nome: string
  premissas: Premissas
  resultado: Calculo
  base: Premissas
  criadoEm: string
}

export interface Estado {
  agora: number
  empresa: string
  usuario: { id: string; nome: string }
  /** leitor só consulta — a tela esconde o que grava, e o servidor recusa de todo jeito */
  podeEscrever: boolean
  produtos: Produto[]
  canais: Canal[]
  modelosDeCusto: ModeloDeCusto[]
  cenarios: Cenario[]
  historico: Array<{ id: string; produtoId: string; revisao: number; loteId: string | null; criadoEm: string }>
  preferencias: Preferencias
}

export interface Revisao {
  id: string
  revisao: number
  retrato: { nome: string; premissas: Premissas; calculo: Calculo }
  versaoDoMotor: string
  loteId: string | null
  criadoEm: string
}

export interface LinhaDaPrevia {
  linha?: number
  acao?: 'Criar' | 'Atualizar' | 'Ignorar duplicado'
  antes: Produto | null
  depois: (ProdutoParaGravar & { premissas: Premissas }) | null
  sugerido?: string
  erro?: string
}
export interface Previa { id: string; linhas: LinhaDaPrevia[] }

export interface RegraDoLote {
  ids: string[]
  meta?: string
  aumentoDoCusto?: string
  embalagem?: string
  arredondamento?: Premissas['arredondamento']
  canalId?: string
}

export interface ProdutoNoEstoque {
  id: string
  nome: string
  sku: string | null
  unidade: string
  canalId: string | null
  premissas: Premissas
  quantidade: string
  valorEmEstoque: string
  minimo: string
  /** quantos movimentos — zero é "ainda não controlado" */
  revisao: number
  custoMedio: string
}

export interface Movimento {
  id: string
  tipo: string
  quantidade: string
  custoUnitario: string
  saldoDepois: string
  motivo: string
  vendaId: string | null
  criadoEm: string
  produto: string
  unidade: string
  statusDaVenda: 'concluida' | 'devolvida' | null
  /** as linhas de endereço: de onde saiu (negativo) e para onde foi (positivo) */
  enderecos: Array<{ rotulo: string; quantidade: string }>
}

export interface TelaDoEstoque {
  produtos: ProdutoNoEstoque[]
  total: number
  pagina: number
  porPagina: number
  movimentos: Movimento[]
  totais: { controlados: number; repor: number; valorEmEstoque: string; vendas: number; totalVendido: string; resultadoEstimado: string }
}

export interface PedidoDeMovimento {
  chaveDaOperacao: string
  produtoId: string
  tipo: 'inicial' | 'entrada' | 'venda' | 'perda' | 'uso_proprio' | 'conferencia'
  quantidade: string
  custoUnitario?: string
  precoUnitario?: string
  desconto?: string
  canalId?: string | null
  formaDePagamento?: 'Pix' | 'Cartão' | 'Dinheiro' | 'Boleto' | 'Outro'
  motivo?: string
  /** destino da entrada, origem da saída, posição contada na conferência (PLANO-ESTOQUE-3D.md) */
  endereco?: Endereco | null
}

/* ── o estoque com endereço (PLANO-ESTOQUE-3D.md) ── */

export interface ProdutoNoMapa {
  id: string
  nome: string
  sku: string | null
  categoria: string
  unidade: string
  imagemId: string | null
  arquivado: boolean
  quantidade: string
  aGuardar: string
  minimo: string
  revisao: number
  valorEmEstoque: string
  custoMedio: string
  preco: string
  vendidos30d: string
  /** `null` é "nunca movimentou" */
  diasParado: number | null
}

export interface PosicaoNoMapa extends Endereco {
  produtoId: string
  quantidade: string
}

export interface MovimentoNoMapa {
  id: string
  tipo: string
  produtoId: string
  quantidade: string
  criadoEm: string
  linhas: Array<Endereco & { quantidade: string; rotulo: string }>
}

export interface MapaDoEstoque {
  ambiente: (Ambiente & { revisao: number }) | null
  temas: Array<{ tema: Tema; nome: string; descricao: string }>
  estruturas: Estrutura[]
  posicoes: PosicaoNoMapa[]
  produtos: ProdutoNoMapa[]
  produtosTruncados: boolean
  movimentos: MovimentoNoMapa[]
  tarefas: Tarefa[]
}

export interface DetalheDaVenda {
  id: string
  status: 'concluida' | 'devolvida'
  total: string
  resultadoEstimado: string
  canal: string
  formaDePagamento: string
  criadaEm: string
  devolvidaEm: string | null
}

export interface ModeloDeEtiqueta {
  id: string
  chave: string
  nome: string
  versao: number
  layout: LayoutDeEtiqueta
  deFabrica: boolean
}

/** o teto de uma foto ou logo — o mesmo do servidor (`arquivos/service.ts`), conferido aqui para não mandar 1 MB e ouvir "não" */
export const TAMANHO_MAXIMO_DA_IMAGEM = 1_000_000

export interface LogoDaEmpresa {
  id: string
  mime: string
  tamanho: number
  criadoEm: string
}

export interface PedidoDeEtiquetas {
  chaveDaOperacao: string
  modeloId: string
  /** o desenho da etiqueta — o papel é o `modeloId` */
  estilo: EstiloDeEtiqueta
  itens: Array<{ produtoId: string; copias: number }>
  posicaoInicial: number
  deslocamentoX: number
  deslocamentoY: number
  nomeDaLoja: string
  logoId: string | null
}

export const lucroApi = {
  estado: () => request<Estado>('/estado'),
  /** os 15 dias do Lucro Certo, no primeiro acesso de quem já é cliente de outro app (só gestor) */
  comecarAvaliacao: () => request<unknown>('/nucleo/billing/avaliar-no-painel', { method: 'POST' }),
  preferencias: (dados: Preferencias) => request<Preferencias>('/preferencias', json(dados, 'PUT')),

  criarProduto: (p: ProdutoParaGravar) => request<Produto>('/produtos', json(p)),
  salvarProduto: (p: ProdutoParaGravar & { id: string; revisao: number }) => request<Produto>(`/produtos/${p.id}`, json(p, 'PUT')),
  acaoNoProduto: (id: string, acao: 'duplicar' | 'arquivar' | 'restaurar' | 'favorito') => request<Produto>(`/produtos/${id}/${acao}`, { method: 'POST' }),
  /** só o arquivado que nunca movimentou estoque nem vendeu; o servidor diz a razão quando recusa */
  excluirProduto: (id: string) => request<{ ok: true }>(`/produtos/${id}`, { method: 'DELETE' }),
  historico: (id: string) => request<Revisao[]>(`/produtos/${id}/historico`),
  adicionarExemplos: () => request<{ quantidade: number }>('/produtos/exemplos', { method: 'POST' }),

  criarCanal: (c: Omit<Canal, 'id' | 'revisao' | 'atualizadoEm'>) => request<Canal>('/canais', json(c)),
  salvarCanal: (c: Omit<Canal, 'atualizadoEm'>) => request<Canal>(`/canais/${c.id}`, json(c, 'PUT')),

  criarModelo: (m: Omit<ModeloDeCusto, 'id' | 'revisao'>) => request<ModeloDeCusto>('/modelos-de-custo', json(m)),
  salvarModelo: (m: Omit<ModeloDeCusto, 'revisao'>) => request<ModeloDeCusto>(`/modelos-de-custo/${m.id}`, json(m, 'PUT')),
  apagarModelo: (id: string) => request<void>(`/modelos-de-custo/${id}`, { method: 'DELETE' }),

  salvarCenario: (c: { nome: string; produtoId: string | null; premissas: Premissas }) => request<Cenario>('/cenarios', json(c)),
  aplicarCenario: (id: string) => request<Produto>(`/cenarios/${id}/aplicar`, { method: 'POST' }),

  previaDoLote: (regra: RegraDoLote) => request<Previa>('/lote/previa', json(regra)),
  aplicarPrevia: (id: string) => request<{ quantidade: number; tipo: string; loteId: string }>(`/lote/${id}/aplicar`, { method: 'POST' }),
  reverterLote: (id: string) => request<{ quantidade: number }>(`/lote/${id}/reverter`, { method: 'POST' }),
  previaDaImportacao: (entrada: { formato: 'csv' | 'xlsx'; conteudo: string; duplicados: 'ignorar' | 'atualizar' }) =>
    request<Previa>('/importacao/previa', json(entrada)),

  estoque: (consulta: { pagina: number; busca: string; filtro: 'todos' | 'repor' }) =>
    request<TelaDoEstoque>(`/estoque?pagina=${consulta.pagina}&busca=${encodeURIComponent(consulta.busca)}&filtro=${consulta.filtro}`),
  registrarMovimento: (m: PedidoDeMovimento) =>
    request<{ id: string; vendaId: string | null; repetida: boolean; quantidade?: string }>('/estoque/movimentos', json(m)),
  devolverVenda: (d: { chaveDaOperacao: string; movimentoId: string; motivo: string }) => request<{ id: string }>('/estoque/devolucoes', json(d)),
  definirMinimo: (produtoId: string, minimo: string) => request<void>('/estoque/minimo', json({ produtoId, minimo }, 'PUT')),
  venda: (id: string) => request<DetalheDaVenda>(`/estoque/vendas/${id}`),

  mapaDoEstoque: () => request<MapaDoEstoque>('/estoque/mapa'),
  sugestoesDeGuarda: (produtoId: string) => request<Sugestao[]>(`/estoque/sugestoes/${encodeURIComponent(produtoId)}`),
  transferir: (t: PedidoDeTransferencia) => request<{ id: string; repetida: boolean }>('/estoque/transferencias', json(t)),
  montarEspaco: (tema: Tema, substituir = false) => request<{ ambienteId: string }>('/estoque/ambiente', json({ tema, substituir })),
  alterarEspaco: (dados: Partial<Ambiente>) => request<void>('/estoque/ambiente', json(dados, 'PUT')),
  criarEstrutura: (e: DadosDaEstrutura) => request<Estrutura>('/estoque/estruturas', json(e)),
  alterarEstrutura: (id: string, e: Partial<DadosDaEstrutura>) => request<Estrutura>(`/estoque/estruturas/${encodeURIComponent(id)}`, json(e, 'PUT')),
  retirarEstrutura: (id: string) => request<void>(`/estoque/estruturas/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  etiquetas: () => request<{ modelos: ModeloDeEtiqueta[] }>('/etiquetas'),
  salvarModeloDeEtiqueta: (m: { nome: string; layout: LayoutDeEtiqueta; anteriorId?: string }) =>
    request<{ id: string; versao: number }>('/etiquetas/modelos', json(m)),
  gerarEtiquetas: (p: PedidoDeEtiquetas) => arquivo('/etiquetas/pdf', json(p)),

  /** os logos da EMPRESA (até dois), cadastrados em Sua empresa e escolhidos nas etiquetas */
  logos: () => request<{ logos: LogoDaEmpresa[]; maximo: number }>('/logos'),
  enviarLogo: (arquivoDoLogo: File) => {
    const dados = new FormData()
    dados.append('arquivo', arquivoDoLogo)
    return request<{ id: string }>('/logos', { method: 'POST', body: dados })
  },
  apagarLogo: (id: string) => request<{ ok: true }>(`/logos/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  enviarImagem: (arquivoDaImagem: File) => {
    const dados = new FormData()
    dados.append('arquivo', arquivoDaImagem)
    return request<{ id: string; mime: string; tamanho: number }>('/arquivos', { method: 'POST', body: dados })
  },
}

/* Caminhos relativos ao cliente autenticado: todo arquivo leva o espaço escolhido. */
export const enderecos = {
  imagem: (id: string) => `/arquivos/${encodeURIComponent(id)}`,
  exportar: (formato: 'csv' | 'xlsx' | 'pdf' | 'json') => `/exportar?formato=${formato}`,
  modeloDeImportacao: '/importacao/modelo',
  estoqueEmCsv: '/estoque/exportar',
}
