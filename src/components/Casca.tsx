/**
 * A casca do Lucro Certo: barra lateral, topo, título da página, dica e rodapé.
 * Nasceu do `Workspace` do mock e, desde 22/10/2026 (pedido do Pedro), veste o
 * padrão do Marketing Flow — cores, topo branco, selo da assinatura, o cartão
 * de Configurações —, menos a barra de baixo: aqui a navegação segue LATERAL.
 * O que mudou em relação ao mock é o que está por trás:
 *
 * - as abas são ROTAS (`/produtos`, `/estoque`...) em vez de `?tab=`: o voltar
 *   do navegador e o link copiado funcionam sem código próprio. Os itens do
 *   menu seguem `<button>`, como no mock, porque é nele que o CSS pinta o ativo;
 * - quem é a pessoa, a empresa e o espaço vêm da sessão do Núcleo; o sair é o
 *   da suíte;
 * - a assinatura é a do Núcleo, cobrada como a do MKT: a faixa avisa
 *   (`AvisoDeAssinatura`), e quem está vencido leva 402 do servidor e vai para
 *   a loja (`lib/api.ts`). O portão de compra do mock não existe aqui.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight, Boxes, Building2, Calculator, ChartNoAxesCombined, ChevronRight, ChevronUp, GitCompareArrows, LayoutDashboard,
  LifeBuoy, LogOut, Menu, Package, Settings, Settings2, SlidersHorizontal, Tags, User, X,
} from 'lucide-react'
import { useSessao } from '@/lib/sessao'
import { usePainel } from '@/lib/painel'
import { toast, useAviso } from '@/lib/avisos'
import { lucroApi } from '@/lib/api'
import { useAssinatura } from '@/loja/estadoDaAssinatura'
import { AvisoDeAssinatura } from '@/loja/AvisoDeAssinatura'
import { LINKS_LEGAIS } from '@/acesso/CaixaDosTermos'
import { ConviteDeMfa } from '@/conta/ConviteDeMfa'
import { JanelaDosTermos } from '@/conta/JanelaDosTermos'
import { PrimeirosPassos } from '@/pages/PrimeirosPassos'
import { Marca } from './Marca'
import { Aviso, Botao, Janela } from './ui'

const MENU = [
  { para: '/', rotulo: 'Visão geral', Icone: LayoutDashboard },
  { para: '/produtos', rotulo: 'Produtos', Icone: Package },
  { para: '/precificar', rotulo: 'Precificar', Icone: Calculator },
  { para: '/simulacoes', rotulo: 'Simulações', Icone: SlidersHorizontal },
  { para: '/canais', rotulo: 'Comparar canais', Icone: GitCompareArrows },
  { para: '/custos', rotulo: 'Custos e canais', Icone: Settings2 },
  { para: '/estoque', rotulo: 'Estoque e vendas', Icone: Boxes },
  { para: '/etiquetas', rotulo: 'Etiquetas', Icone: Tags },
  { para: '/relatorios', rotulo: 'Relatórios', Icone: ChartNoAxesCombined },
]

/* o título e o subtítulo de cada página, com os textos do mock */
const TITULOS: Record<string, [string, string, string]> = {
  '/': ['Visão geral', 'Seu negócio, mais claro.', 'Cada preço tem uma história. Entenda a sua.'],
  '/produtos': ['Produtos', 'Seu catálogo, organizado.', 'Encontre, revise e compare os seus produtos.'],
  '/produtos/importar': ['Importar produtos', 'Seu catálogo, de uma vez.', 'Traga uma planilha e confira cada coluna antes de deixar entrar.'],
  '/precificar': ['Precificar', 'Preço com propósito.', 'Custos na mesa. Margem à vista.'],
  '/simulacoes': ['Simulações', 'Experimente antes de decidir.', 'Mude preço e custos ou simule uma promoção, sem mexer no catálogo.'],
  '/canais': ['Comparar canais', 'Mesmo produto. Outros caminhos.', 'Veja quanto sobra em cada canal de venda.'],
  '/custos': ['Custos e canais', 'Cada custo no seu lugar.', 'Organize as premissas que dão confiança ao seu preço.'],
  '/estoque': ['Estoque e vendas', 'Seu estoque, acompanhado.', 'Entradas, vendas e reposição com um histórico claro.'],
  '/etiquetas': ['Etiquetas', 'Loja e transporte.', 'Escolha o modelo, confira os dados e gere seu PDF.'],
  '/relatorios': ['Relatórios', 'Os números que orientam.', 'Enxergue a rentabilidade estimada do seu catálogo.'],
  '/conta': ['Minha conta', 'Sua conta. Seu controle.', 'Perfil, assinatura, segurança e privacidade.'],
  '/empresa': ['Sua empresa', 'Sua equipe, organizada.', 'Dados da empresa, pessoas com acesso, espaços de trabalho e logos.'],
  '/ajuda': ['Ajuda', 'Sua central de clareza.', 'Respostas práticas para usar o LucroCerto.'],
}

/*
 * As telas que não leem o catálogo do app: a conta, a empresa e a ajuda falam
 * só com o Núcleo, e por isso abrem mesmo com a assinatura vencida — como as
 * telas de conta do MKT. As outras pedem `/api/estado`, e o 402 leva à loja.
 */
const SEM_CATALOGO = ['/conta', '/empresa', '/ajuda']

/* o que mora em Configurações: no MKT é o cartão da barra de cima; aqui abre ao lado do item da barra lateral */
const CONFIGURACOES = [
  { para: '/ajuda', rotulo: 'Central de ajuda', descricao: 'Respostas práticas para usar o LucroCerto.', Icone: LifeBuoy, soGestor: false },
  { para: '/conta', rotulo: 'Minha conta', descricao: 'Perfil, assinatura, segurança e privacidade.', Icone: User, soGestor: false },
  { para: '/empresa', rotulo: 'Sua empresa', descricao: 'Dados, pessoas com acesso, espaços de trabalho e logos.', Icone: Building2, soGestor: true },
]

/** `/precificar/prd_x` é Precificar; `/empresa/usuarios` é Sua empresa */
const raizDa = (caminho: string) => (caminho === '/' ? '/' : `/${caminho.split('/')[1]}`)

export function Casca({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const { retrato, espacoAtual, trocarEspaco, sair, ehGestor } = useSessao()
  const { estado, erro, carregar, recarregar } = usePainel()
  const { situacao, buscado, carregar: carregarAssinatura } = useAssinatura()
  const [menuMovel, setMenuMovel] = useState(false)
  const [trocandoEspaco, setTrocandoEspaco] = useState(false)

  const raiz = raizDa(pathname)
  /* a sub-rota com título próprio (a importação) ganha da raiz */
  const titulo = TITULOS[pathname] ?? TITULOS[raiz] ?? TITULOS['/']
  const precisaDoCatalogo = !SEM_CATALOGO.includes(raiz)

  useEffect(() => { void carregarAssinatura() }, [carregarAssinatura])
  useEffect(() => {
    if (precisaDoCatalogo) void carregar()
  }, [precisaDoCatalogo, carregar])
  useEffect(() => {
    setMenuMovel(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  /* aceitou os termos com o painel parado no erro (o primeiro acesso esperava por eles): tenta de novo sozinho */
  const termosPendentes = retrato?.termosPendentes?.length ?? 0
  /* só reage à mudança dos termos, de propósito: com `erro` nas dependências, cada falha de rede recarregaria em laço */
  useEffect(() => {
    if (erro && termosPendentes === 0 && precisaDoCatalogo) void recarregar()
  }, [termosPendentes])

  if (!retrato) return null
  const primeiroNome = retrato.usuario.nome.split(' ')[0]
  const statusDaAssinatura = !situacao ? '' : situacao.status === 'trial' ? 'Em avaliação' : situacao.ativa ? 'Assinatura ativa' : 'Assinatura vencida'

  if (!buscado || (precisaDoCatalogo && !estado)) {
    return (
      <div className="app-loading">
        <Marca />
        {erro ? (
          <>
            <Aviso tipo="erro">{erro}</Aviso>
            <Botao onClick={() => void recarregar()}>Tentar novamente</Botao>
            {/* o primeiro acesso pode estar esperando o aceite: sem a janela aqui, ela nunca abriria */}
            <JanelaDosTermos />
          </>
        ) : (
          <>
            <div className="skeleton loading-title" />
            <div className="loading-grid">{[1, 2, 3, 4].map((n) => <div className="skeleton" key={n} />)}</div>
            <p>Preparando seu espaço de trabalho…</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Pular para conteúdo</a>
      {menuMovel ? <button className="mobile-shade" aria-label="Fechar menu" onClick={() => setMenuMovel(false)} /> : null}
      <aside className={`sidebar ${menuMovel ? 'open' : ''}`}>
        <Link to="/" className="brand-link" aria-label="LucroCerto início"><Marca /></Link>
        <div className="workspace-name">
          <span>{retrato.empresa.nome.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{retrato.empresa.nome}</strong>
            <small>
              {espacoAtual?.nome ?? 'Seu espaço de trabalho'}
              {retrato.espacos.length > 1 ? <button className="workspace-switch" onClick={() => setTrocandoEspaco(true)}>trocar</button> : null}
            </small>
          </div>
        </div>
        <div className="nav-label">SEU NEGÓCIO</div>
        <nav aria-label="Navegação principal">
          {MENU.map(({ para, rotulo, Icone }) => {
            const ativo = raiz === para
            return (
              <button key={para} className={ativo ? 'active' : ''} aria-current={ativo ? 'page' : undefined} onClick={() => navegar(para)}>
                <Icone size={18} />{rotulo}{ativo ? <span className="nav-glow" /> : null}
              </button>
            )
          })}
        </nav>
        <div className="sidebar-bottom">
          <MenuDeConfiguracoes raiz={raiz} itens={CONFIGURACOES.filter((c) => !c.soGestor || ehGestor())} aoIr={navegar} />
          <div className="sidebar-user">
            <span className="avatar">{retrato.usuario.nome.slice(0, 1)}</span>
            <div><strong>{primeiroNome}</strong><small>{statusDaAssinatura}</small></div>
            <button className="icon-button" aria-label="Sair da conta" onClick={async () => { try { await sair(); navegar('/', { replace: true }) } catch { toast.error('Não foi possível sair. Tente novamente.') } }}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <div className="app-body">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Abrir menu" onClick={() => setMenuMovel(true)}><Menu size={21} /></button>
          <div className="breadcrumb"><span>{SEM_CATALOGO.includes(raiz) ? 'Configurações' : 'Seu negócio'}</span><ChevronRight size={13} /><strong>{titulo[0]}</strong></div>
          <div className="topbar-right">
            {statusDaAssinatura ? (
              <Link className="topbar-seal" data-tom={situacao && situacao.status !== 'trial' && !situacao.ativa ? 'perigo' : undefined} to="/conta" title="Ver a assinatura em Minha conta">
                <i />{statusDaAssinatura}
              </Link>
            ) : null}
            <a href={LINKS_LEGAIS.site} title="Ver o site da MZN" className="icon-button" aria-label="Ver o site da MZN" target="_blank" rel="noopener noreferrer">
              <ArrowUpRight size={17} />
            </a>
            <Link className="avatar" to="/conta" aria-label="Abrir minha conta">{retrato.usuario.nome.slice(0, 1)}</Link>
          </div>
        </header>
        <main id="main-content" className="main-content">
          <div className="page-heading">
            {/* como no MKT: o título é o nome da tela; a frase do mock ficou no subtítulo */}
            <div>
              <h1>{titulo[0]}</h1>
              <p>{titulo[1]} {titulo[2]}</p>
            </div>
            {/* sem o "Precificar produto" do mock em toda tela (22/10/2026, pedido do Pedro): ele fica na Visão geral, no Produtos vazio e no menu */}
          </div>
          {situacao ? <AvisoDeAssinatura situacao={situacao} /> : null}
          <ConviteDeMfa />
          {children}
          {estado?.preferencias.dicas !== false ? (
            <div className="learning-foot">
              <span>Uma dica de clareza</span>
              Lucro estimado é o que sobra após os custos informados. Ele não equivale ao lucro realizado.
            </div>
          ) : null}
          <footer className="app-footer">
            <span>LucroCerto · decisões com clareza</span>
            <div>
              <a href={LINKS_LEGAIS.termos} target="_blank" rel="noopener noreferrer">Termos</a>
              <a href={LINKS_LEGAIS.privacidade} target="_blank" rel="noopener noreferrer">Privacidade</a>
              <Link to="/ajuda">Ajuda</Link>
            </div>
          </footer>
        </main>
      </div>

      <AvisoFlutuante />
      <JanelaDosTermos />
      {/* depois do aceite dos termos: as duas janelas juntas deixam a dos termos presa por baixo */}
      {estado && estado.podeEscrever && estado.preferencias.primeirosPassos === false && !retrato.termosPendentes?.length ? (
        <PrimeirosPassos
          aoTerminar={async (escolhas) => {
            try {
              await lucroApi.preferencias({ ...escolhas, primeirosPassos: true })
            } finally {
              await recarregar()
            }
            if (escolhas.prioridade) navegar('/precificar')
          }}
        />
      ) : null}
      <Janela aberta={trocandoEspaco} aoFechar={() => setTrocandoEspaco(false)} titulo="Trocar de espaço de trabalho" descricao="Cada espaço tem o próprio catálogo, estoque e etiquetas.">
        <div className="onboarding-choices">
          {retrato.espacos.map((e) => (
            <button key={e.id} className={e.id === espacoAtual?.id ? 'active' : ''} onClick={() => trocarEspaco(e.id)}>
              {e.nome}{e.padrao ? ' · padrão' : ''}
            </button>
          ))}
        </div>
      </Janela>
    </div>
  )
}

/**
 * Configurações, na barra lateral: o cartão abre ao lado do item, preso a
 * ele (posição fixa, porque a barra rola e cortaria um cartão absoluto). No
 * celular a barra é uma gaveta estreita, e o cartão vira uma lista dentro dela.
 */
function MenuDeConfiguracoes({ raiz, itens, aoIr }: {
  raiz: string
  itens: typeof CONFIGURACOES
  aoIr: (para: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [lugar, setLugar] = useState<{ left: number; bottom: number } | null>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const cartao = useRef<HTMLDivElement>(null)
  const ativo = itens.some((i) => i.para === raiz)

  useEffect(() => { setAberto(false) }, [raiz])
  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node
      if (!botao.current?.contains(alvo) && !cartao.current?.contains(alvo)) setAberto(false)
    }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { setAberto(false); botao.current?.focus() } }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', tecla) }
  }, [aberto])

  const alternar = () => {
    const r = botao.current?.getBoundingClientRect()
    /* a borda é a da BARRA, não a do botão: o cartão encosta nela, sem cobrir o item */
    const barra = botao.current?.closest('.sidebar')?.getBoundingClientRect()
    if (r) setLugar({ left: (barra?.right ?? r.right) + 12, bottom: Math.max(12, window.innerHeight - r.bottom) })
    setAberto(!aberto)
  }

  return (
    <nav aria-label="Configurações" className="settings-nav">
      <button ref={botao} className={ativo ? 'active' : ''} aria-expanded={aberto} aria-haspopup="true" onClick={alternar}>
        <Settings size={18} />Configurações<ChevronUp size={15} className={`settings-arrow${aberto ? ' open' : ''}`} />
      </button>
      {aberto ? (
        <div ref={cartao} className="settings-card" style={lugar ?? undefined}>
          <p>Configurações</p>
          {itens.map(({ para, rotulo, descricao, Icone }) => (
            <button key={para} aria-current={raiz === para ? 'page' : undefined} onClick={() => aoIr(para)}>
              <Icone size={18} />
              <span><strong>{rotulo}</strong><small>{descricao}</small></span>
            </button>
          ))}
        </div>
      ) : null}
    </nav>
  )
}

/** O `.toast` do mock: um de cada vez, some sozinho. */
function AvisoFlutuante() {
  const { texto, chave, fechar } = useAviso()
  useEffect(() => {
    if (!texto) return
    const relogio = setTimeout(fechar, 6500)
    return () => clearTimeout(relogio)
  }, [texto, chave, fechar])
  if (!texto) return null
  return (
    <div className="toast" role="status">
      <span>{texto}</span>
      <button aria-label="Fechar aviso" onClick={fechar}><X size={16} /></button>
    </div>
  )
}
