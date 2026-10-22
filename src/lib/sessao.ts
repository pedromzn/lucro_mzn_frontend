/**
 * A sessão do painel — a MESMA do painel do Marketing Flow
 * (`mzn_mkt/frontend/src/lib/sessao.ts`), porque a sessão é da suíte: o mesmo
 * cookie, a mesma prova de origem, as mesmas rotas do Núcleo. A única diferença
 * é o `x-aplicativo: lucro`, que diz ao Núcleo de que app são os espaços de
 * trabalho desta tela (os espaços são por app desde 21/10/2026).
 *
 * O que vem abaixo é o texto do original.
 *
 * **O token não mora mais aqui.** Ele vai e volta num cookie `HttpOnly`
 * (`mzn_sessao`) que este código não consegue ler — e é esse o ponto: no
 * `localStorage`, qualquer script que entrasse na página o levava embora.
 * Desde 21/09/2026 o JavaScript do painel não tem acesso à credencial.
 *
 * **O que este arquivo manda é a prova de origem.** O servidor também devolve
 * `mzn_csrf`, legível de propósito, e toda escrita o repete no cabeçalho
 * `x-csrf-token`. Ler cookie é coisa de mesma origem, então uma página de fora
 * não monta esse cabeçalho — mesmo que o navegador anexe o cookie de sessão
 * sozinho. Sem isso o cookie abriria CSRF, porque `SameSite=Lax` barra outro
 * *site* e `api.<dominio>` é o mesmo site do painel.
 *
 * **Ninguém sabe se há sessão sem perguntar.** Como não há token para olhar, o
 * painel pergunta ao servidor em toda carga (`/auth/eu`) e trata 401 como
 * "não está logado". É uma ida a mais na abertura, e em troca a tela nunca
 * mostra painel para quem já foi desativado.
 *
 * **O `x-workspace-id` continua saindo daqui**, e continua sendo só uma
 * preferência: o servidor valida e, se não for um espaço da pessoa, usa o
 * padrão dela. A tela não precisa se defender disso.
 *
 * **Um 401 desloga na hora.** O servidor devolve `sessao_revogada` quando
 * alguém foi desativado ou trocou a senha — a tela não deve insistir nem
 * mostrar erro de rede para algo que é fim de sessão.
 */

import { create } from 'zustand'

/* a chave é deste app: o espaço guardado no MKT não é um espaço do Lucro Certo */
const CHAVE_ESPACO = 'lucro.espaco'

/** o app deste painel, para o Núcleo — catálogo de aplicativos, migration 016 */
export const APLICATIVO = 'lucro'
const COOKIE_CSRF = 'mzn_csrf'

export type PapelNaOrganizacao = 'super_admin' | 'admin' | 'membro'

export interface AplicativoDaSessao {
  id: string
  nome: string
  icone: string | null
  cor: string | null
  base_url: string | null
  papel_no_app: string
  provisionado: boolean
}

export interface EspacoDaSessao {
  id: string
  nome: string
  cor: string | null
  padrao: boolean
}

export interface EstadoDoMfa {
  ativo: boolean
  adiadoAte: string | null
  codigosRestantes: number
  /** o servidor consegue guardar a semente? sem chave, ligar é recusado */
  disponivel: boolean
  /** mostrar o convite agora? quem decide é o SERVIDOR, não o navegador */
  convidar: boolean
}

export interface RetratoDaSessao {
  usuario: { id: string; nome: string; email: string; avatar_url: string | null; cargo: string | null }
  empresa: { id: string; nome: string; slug: string; logo_url: string | null }
  papel: PapelNaOrganizacao
  aplicativos: AplicativoDaSessao[]
  espacos: EspacoDaSessao[]
  /** só vem de `/auth/eu`; o login não o traz, e a tela trata a ausência */
  mfa?: EstadoDoMfa
  /** o que falta aceitar dos termos — com algo dentro, a janela do aceite abre (`conta/JanelaDosTermos.tsx`) */
  termosPendentes?: DocumentoPendente[]
}

export interface DocumentoPendente {
  documento: 'termos' | 'privacidade'
  versao: string
  titulo: string
  url: string
  /** null = nunca aceitou versão nenhuma (as contas de antes do aceite) */
  aceitaAntes: string | null
}

/*
 * Fora do React de propósito: o cliente de API precisa da prova de origem e do
 * espaço em toda requisição, inclusive nas que saem de fora de um componente.
 */
/*
 * `localStorage` LANÇA, não só devolve vazio.
 *
 * Em janela anônima, com dados de site bloqueados ou dentro de um iframe de
 * terceiro, o simples acesso estoura — e estourando aqui, no corpo do módulo,
 * o painel inteiro fica com a tela branca e sem erro que ajude.
 */
export const armazem = {
  ler(chave: string): string | null {
    try { return globalThis.localStorage?.getItem(chave) ?? null } catch { return null }
  },
  gravar(chave: string, valor: string): void {
    try { globalThis.localStorage?.setItem(chave, valor) } catch { /* só na memória desta aba */ }
  },
  apagar(chave: string): void {
    try { globalThis.localStorage?.removeItem(chave) } catch { /* idem */ }
  },
}

let espacoEscolhido: string | null = armazem.ler(CHAVE_ESPACO)

/** o cookie de origem; `document.cookie` não lê o de sessão, que é HttpOnly */
function segredoDeOrigem(): string | null {
  try {
    for (const parte of (globalThis.document?.cookie ?? '').split(';')) {
      const igual = parte.indexOf('=')
      if (igual < 0) continue
      if (parte.slice(0, igual).trim() !== COOKIE_CSRF) continue
      return decodeURIComponent(parte.slice(igual + 1).trim())
    }
  } catch { /* sem document, ou acesso bloqueado: o servidor recusa e a tela avisa */ }
  return null
}

/** esquece a sessão só aqui; quem avisa o servidor é `sair` */
function esquecerLocal(): void {
  espacoEscolhido = null
  armazem.apagar(CHAVE_ESPACO)
}

export function cabecalhosDeSessao(): Record<string, string> {
  const cabecalhos: Record<string, string> = { 'x-aplicativo': APLICATIVO }
  const origem = segredoDeOrigem()
  if (origem) cabecalhos['x-csrf-token'] = origem
  if (espacoEscolhido) cabecalhos['x-workspace-id'] = espacoEscolhido
  return cabecalhos
}

interface EstadoDaSessao {
  carregando: boolean
  retrato: RetratoDaSessao | null
  espacoAtual: EspacoDaSessao | null
  entrar: (retrato: RetratoDaSessao) => void
  sair: () => Promise<void>
  trocarEspaco: (id: string) => void
  recarregar: () => Promise<void>
  /** o que a tela pergunta o tempo todo */
  ehGestor: () => boolean
}

function escolherEspaco(espacos: EspacoDaSessao[]): EspacoDaSessao | null {
  if (espacos.length === 0) return null
  const guardado = espacos.find((e) => e.id === espacoEscolhido)
  return guardado ?? espacos.find((e) => e.padrao) ?? espacos[0]
}

async function pedir<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const resposta = await fetch(`/api${caminho}`, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      ...cabecalhosDeSessao(),
      ...(opcoes.headers || {}),
    },
  })
  const corpo = await resposta.json().catch(() => ({}))
  if (!resposta.ok) {
    const erro = new Error(corpo?.error || `Falha na requisição (${resposta.status})`) as Error & { codigo?: string }
    erro.codigo = corpo?.codigo
    throw erro
  }
  return (corpo?.data ?? corpo) as T
}

export const useSessao = create<EstadoDaSessao>((set, get) => ({
  carregando: true,
  retrato: null,
  espacoAtual: null,

  entrar: (dados) => {
    /* quem autentica é o cookie; a resposta do login não traz token desde 01/10/2026 */
    const espaco = escolherEspaco(dados.espacos)
    if (espaco) {
      espacoEscolhido = espaco.id
      armazem.gravar(CHAVE_ESPACO, espaco.id)
    }
    set({ retrato: dados, espacoAtual: espaco, carregando: false })
  },

  sair: async () => {
    /* Só navega depois da revogação: trocar de página pode cancelar o POST. */
    await pedir('/auth/sair', { method: 'POST' })
    esquecerLocal()
    set({ retrato: null, espacoAtual: null, carregando: false })
  },

  trocarEspaco: (id) => {
    const retrato = get().retrato
    const espaco = retrato?.espacos.find((e) => e.id === id)
    if (!espaco) return
    espacoEscolhido = espaco.id
    armazem.gravar(CHAVE_ESPACO, espaco.id)
    set({ espacoAtual: espaco })
    /*
     * Recarrega a página inteira ao trocar de espaço.
     *
     * Parece grosseiro e é o certo: toda tela aberta carrega dados de outro
     * espaço, e não há um lugar só para invalidar — são 20 telas com estado
     * próprio. Recarregar é a única forma honesta de garantir que nada de um
     * espaço sobra na tela do outro.
     */
    window.location.reload()
  },

  recarregar: async () => {
    /*
     * Pergunta sempre, porque não há mais token para olhar antes.
     *
     * Quem não tem cookie leva 401 e cai no `catch`, que é o mesmo caminho de
     * quem tem cookie vencido — e isso é uma simplificação, não um custo: os
     * dois casos sempre terminaram na mesma tela.
     */
    try {
      const retrato = await pedir<RetratoDaSessao>('/auth/eu')
      const espaco = escolherEspaco(retrato.espacos)
      if (espaco) {
        espacoEscolhido = espaco.id
        armazem.gravar(CHAVE_ESPACO, espaco.id)
      }
      set({ retrato, espacoAtual: espaco, carregando: false })
    } catch {
      /*
       * Silencioso de propósito: aqui o caso comum é não haver sessão nenhuma
       * — a tela de entrar, aberta por quem nunca entrou. Chamar `sair()`
       * mandaria um POST de logout a cada carga de página, para derrubar uma
       * sessão que não existe. Quem tem sessão e a perde no meio do uso cai no
       * `encerrarSessaoPorToken`, que avisa o servidor.
       */
      esquecerLocal()
      set({ retrato: null, espacoAtual: null, carregando: false })
    }
  },

  ehGestor: () => {
    const papel = get().retrato?.papel
    return papel === 'super_admin' || papel === 'admin'
  },
}))

/** chamado pelo cliente de API quando o servidor recusa o token */
export function encerrarSessaoPorToken(): void {
  esquecerLocal()
  useSessao.setState({ retrato: null, espacoAtual: null, carregando: false })
  if (!location.pathname.startsWith('/entrar')) {
    location.href = '/entrar?expirou=1'
  }
}

// ── chamadas de autenticação ────────────────────────────────────────────────

/**
 * O login pode parar no meio.
 *
 * Com MFA ligado, a senha certa NÃO devolve sessão: devolve um desafio de cinco
 * minutos, e a tela pede o código do autenticador. O desafio não abre nada
 * sozinho — o servidor o recusa em qualquer rota de sessão.
 */
export type ResultadoDeEntrada = RetratoDaSessao | { desafioDeMfa: string }

export const autenticacao = {
  entrar: (email: string, senha: string) =>
    pedir<ResultadoDeEntrada>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    }),

  /** a segunda metade do login de quem tem MFA */
  verificarMfa: (desafio: string, codigo: string) =>
    pedir<RetratoDaSessao & { usouRecuperacao: boolean; codigosRestantes: number }>(
      '/auth/mfa/verificar',
      { method: 'POST', body: JSON.stringify({ desafio, codigo }) },
    ),

  definirSenha: (entrada: { email: string; token: string; senha: string; aceite: boolean }) =>
    pedir<RetratoDaSessao>('/auth/definir-senha', {
      method: 'POST',
      body: JSON.stringify(entrada),
    }),

  pedirCodigo: (email: string) =>
    pedir<{ mensagem: string }>('/auth/esqueci-senha', { method: 'POST', body: JSON.stringify({ email }) }),

  validarCodigo: (email: string, codigo: string) =>
    pedir<{ ok: true }>('/auth/validar-codigo', { method: 'POST', body: JSON.stringify({ email, codigo }) }),

  redefinirSenha: (entrada: { email: string; codigo: string; senha: string }) =>
    pedir<{ ok: true }>('/auth/redefinir-senha', { method: 'POST', body: JSON.stringify(entrada) }),

  trocarSenha: (senhaAtual: string, senhaNova: string) =>
    pedir<{ ok: true }>('/auth/trocar-senha', { method: 'POST', body: JSON.stringify({ senhaAtual, senhaNova }) }),
}

/* ── MFA por aplicativo autenticador ─────────────────────────────────────── */

export interface MatriculaDeMfa {
  /** em grupos de quatro, para digitar à mão quando o QR não lê */
  segredo: string
  segredoCru: string
  uri: string
  /** o QR pronto, desenhado pelo servidor — o front não carrega biblioteca */
  qrSvg: string
}

/** o reaceite dos termos — manda as versões que a janela mostrou (`conta/JanelaDosTermos.tsx`) */
export const aceitarTermos = (versoes: { termos?: string; privacidade?: string }) =>
  pedir<{ termosPendentes: DocumentoPendente[] }>('/auth/termos/aceitar', {
    method: 'POST',
    body: JSON.stringify({ ...versoes, porta: 'painel' }),
  })

export const mfa = {
  /** exige a senha: ligar MFA muda o jeito de entrar na conta */
  iniciar: (senha: string) =>
    pedir<MatriculaDeMfa>('/auth/mfa/iniciar', { method: 'POST', body: JSON.stringify({ senha }) }),

  /** prova o primeiro código e devolve os dez códigos de recuperação, UMA vez */
  ativar: (codigo: string) =>
    pedir<{ codigosDeRecuperacao: string[] }>('/auth/mfa/ativar', {
      method: 'POST',
      body: JSON.stringify({ codigo }),
    }),

  desativar: (senha: string) =>
    pedir<{ ok: true }>('/auth/mfa/desativar', { method: 'POST', body: JSON.stringify({ senha }) }),

  refazerCodigos: (senha: string) =>
    pedir<{ codigosDeRecuperacao: string[] }>('/auth/mfa/codigos', {
      method: 'POST',
      body: JSON.stringify({ senha }),
    }),

  /** 7 = "lembrar mais tarde", 30 = "agora não". Não existe "nunca" */
  adiar: (dias: 7 | 30) =>
    pedir<{ adiadoAte: string }>('/auth/mfa/adiar', { method: 'POST', body: JSON.stringify({ dias }) }),
}
