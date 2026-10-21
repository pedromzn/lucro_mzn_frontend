/**
 * A página de venda com a calculadora grátis — o `landing.tsx` do mock, no `/`
 * para quem não entrou (PLANO-LUCRO-CERTO.md, D3). Quem tem sessão vê a Visão
 * geral no mesmo endereço.
 *
 * O que mudou do mock, e por quê:
 * - **sem medição de visitas** e sem o aviso de consentimento: o app não
 *   guarda IP nem conta acesso de quem não é cliente (AGENTS.md §9);
 * - **quem vende é a loja da suíte**: "Contratar" leva para a página do app na
 *   loja, e criar conta é o cadastro do Núcleo, com avaliação grátis;
 * - **os textos legais são do site da MZN**, os mesmos de todos os apps;
 * - a consulta automática ao Mercado Livre saiu (D4), e a FAQ diz isso.
 *
 * A calculadora roda o mesmo motor do app (`@shared/preco`), sem ir ao servidor.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, ArrowUpRight, Check, Download, GitCompareArrows, History, Menu, MoveUpRight, Package, Percent, Plus, ShieldCheck, SlidersHorizontal, X,
} from 'lucide-react'
import { PREMISSAS_PADRAO } from '@shared/preco'
import { EMAIL_DO_SUPORTE } from '@shared/ajuda'
import { URL_DA_LOJA } from '@/lib/api'
import { LINKS_LEGAIS } from '@/acesso/CaixaDosTermos'
import { Marca } from '@/components/Marca'
import { Aviso, CampoNumero, brl, pct } from '@/components/ui'
import { usarCalculo } from '@/precos/Resultado'
import { DESCONTO_ANUAL, PRECO_MENSAL_POR_USUARIO, RECURSOS } from '@/loja/oferta'

const PERGUNTAS: Array<[string, string]> = [
  ['Preciso entender de finanças?', 'Não. O fluxo organiza custo, canal e margem em etapas curtas. Cada resultado tem uma explicação consultável.'],
  ['As taxas dos marketplaces são preenchidas sozinhas?', 'Não. Você configura os perfis de cada canal conforme o seu contrato, com a fonte e a data da conferência. Nenhuma taxa é apresentada como oficial.'],
  ['O lucro mostrado é o lucro que eu realmente tive?', 'Não. É uma estimativa por unidade, baseada nos custos e preços informados. No estoque, o resultado das vendas registradas também é estimado a partir dos custos e taxas informados; não substitui a apuração financeira completa.'],
  ['Posso usar no celular?', 'A interface foi construída para celular e computador. Os dados ficam vinculados à sua conta no servidor.'],
  ['Como funciona a assinatura?', `É por pessoa que usa, mensal ou anual — no anual, ${Math.round(DESCONTO_ANUAL * 100)}% de desconto. Paga no cartão ou no Pix, e dá para mudar o número de pessoas ou cancelar pela loja da MZN.`],
  ['Consigo levar meus dados embora?', 'Sim. Você pode exportar produtos e premissas em CSV ou Excel, gerar relatórios PDF e baixar seus dados em JSON.'],
  ['Posso experimentar antes de comprar?', 'Sim. Crie sua conta e use o LucroCerto no período de avaliação, sem cartão. Para continuar depois, é só escolher um plano na loja.'],
]

export default function Vitrine() {
  const [custo, setCusto] = useState('45')
  const [taxa, setTaxa] = useState('15')
  const [margem, setMargem] = useState('25')
  const [menu, setMenu] = useState(false)
  const { calculo, erro } = usarCalculo({ ...PREMISSAS_PADRAO, custo, comissao: taxa, meta: margem, tributoConferido: false })

  return (
    <div className="public-site">
      <a href="#conteudo-publico" className="skip-link">Pular para conteúdo</a>
      <header className="public-header">
        <Link to="/" aria-label="LucroCerto início"><Marca /></Link>
        <button className="mobile-menu icon-button" onClick={() => setMenu(!menu)} aria-label="Abrir navegação">{menu ? <X /> : <Menu />}</button>
        <nav className={menu ? 'open' : ''} aria-label="Site comercial">
          <a href="#como-funciona" onClick={() => setMenu(false)}>Como funciona</a>
          <a href="#recursos" onClick={() => setMenu(false)}>Por dentro</a>
          <a href="#oferta" onClick={() => setMenu(false)}>Preço</a>
          <Link to="/entrar" className="nav-login">Entrar<ArrowUpRight size={15} /></Link>
        </nav>
      </header>
      <main id="conteudo-publico">
        <section className="landing-hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="tiny-dot" />PRECIFICAÇÃO PARA QUEM EMPREENDE</div>
            <h1>Você define o preço.<br />O LucroCerto mostra<br /><span>o que sobra.</span></h1>
            <p>Produto, embalagem, taxas, frete. Coloque os custos na mesa e descubra quanto cobrar antes de vender.</p>
            <div className="hero-ctas">
              <a className="btn primary" href="#recursos">Conhecer o LucroCerto<ArrowRight size={17} /></a>
              <a className="text-link" href="#calculadora">Abrir calculadora grátis<ArrowUpRight size={17} /></a>
            </div>
            <div className="hero-proof"><span><Check size={15} />Feito para o Brasil</span><span><Check size={15} />Sem fórmulas para decorar</span></div>
          </div>
          <div className="hero-product">
            <div className="hero-product-top">
              <span className="mini-logo"><i /><i /><i /></span><span>Seu preço, explicado</span><span className="demo-label">Cálculo de exemplo</span>
            </div>
            <div className="hero-product-body">
              <div className="hero-product-name">
                <div className="product-icon"><Package size={22} /></div>
                <div><strong>Um produto. Cada custo à vista.</strong><small>Simulação interativa em tempo real</small></div>
              </div>
              <div className="hero-price-row">
                <div><span>Preço de venda sugerido</span><strong>{brl(calculo?.sugerido)}</strong></div>
                <div className="hero-profit-chip"><MoveUpRight size={18} /><span>Margem<br /><b>{pct(calculo?.resultado.margem)}</b></span></div>
              </div>
              <div className="price-strip" aria-label="Composição do preço">
                {calculo ? (
                  <>
                    <i style={{ width: `${(Number(custo) / Number(calculo.sugerido)) * 100}%` }} />
                    <i style={{ width: `${Number(taxa)}%` }} />
                    <i style={{ flex: 1 }} />
                  </>
                ) : null}
              </div>
              <dl className="hero-breakdown">
                <div><dt><i />Custo do produto</dt><dd>{brl(custo || 0)}</dd></div>
                <div><dt><i />Taxas informadas</dt><dd>{brl(calculo?.resultado.taxas)}</dd></div>
                <div className="profit"><dt><i />O que sobra</dt><dd>{brl(calculo?.resultado.lucro)}</dd></div>
              </dl>
              <div className="hero-product-foot"><ShieldCheck size={15} /><span>Tributos e custos adicionais não incluídos neste exemplo.</span></div>
            </div>
            <div className="hero-floating"><Check size={16} /><span>O preço muda.<br /><b>As premissas ficam claras.</b></span></div>
          </div>
        </section>

        <div className="channel-ribbon">
          <span>Para quem vende em</span>
          <strong>Shopee</strong><strong>Mercado Livre</strong><strong>Instagram & WhatsApp</strong><strong>Loja própria</strong><strong>Loja física</strong>
          <small>Perfis configuráveis. Sem afiliação aos canais.</small>
        </div>

        <section className="problem-section" id="como-funciona">
          <div><div className="eyebrow">VENDER BEM COMEÇA ANTES DA VENDA</div><h2>Nem tudo que entra<br />fica com você.</h2></div>
          <div>
            <p>Um produto parece lucrativo até a comissão, a embalagem e o frete aparecerem. E aquele desconto para fechar a venda pode levar a margem junto.</p>
            <p>O LucroCerto coloca cada parte do preço no seu lugar. Para você decidir com os custos reais da sua operação.</p>
          </div>
        </section>

        <section id="calculadora" className="free-calculator">
          <div className="calculator-intro">
            <div className="eyebrow">EXPERIMENTE AGORA</div>
            <h2>Três números.<br />Uma decisão mais clara.</h2>
            <p>Faça um cálculo básico, sem criar uma conta.</p>
            <div className="formula-note">
              <span>A lógica por trás do preço</span>
              <code>Custos ÷ (1 − taxas − margem)</code>
              <small>Neste modelo, taxas e margem são percentuais sobre o preço de venda.</small>
            </div>
          </div>
          <div className="free-calculator-panel">
            <div className="form-grid">
              <CampoNumero rotulo="Custo total por unidade" valor={custo} aoMudar={setCusto} />
              <CampoNumero rotulo="Taxas sobre a venda" prefixo="%" valor={taxa} aoMudar={setTaxa} />
              <CampoNumero rotulo="Margem que deseja" prefixo="%" valor={margem} aoMudar={setMargem} />
              <div className="free-result"><span>Preço de venda sugerido</span><strong aria-live="polite">{brl(calculo?.sugerido)}</strong></div>
            </div>
            {erro ? (
              <Aviso tipo="erro">{erro}</Aviso>
            ) : (
              <div className="free-results-line">
                <span>Lucro estimado: <strong>{brl(calculo?.resultado.lucro)}</strong></span>
                <span>Equilíbrio: <strong>{brl(calculo?.equilibrio)}</strong></span>
              </div>
            )}
            <p className="small muted">
              Inclua todos os custos unitários no primeiro campo. Esta versão simplificada não modela taxas por faixa, rateios separados ou regras tributárias específicas.
            </p>
            <Link to="/criar-conta" className="text-link">Quero salvar produtos e comparar canais<ArrowRight size={16} /></Link>
          </div>
        </section>

        <section className="features-section" id="recursos">
          <div className="section-heading">
            <div><div className="eyebrow">MAIS QUE UM NÚMERO NA TELA</div><h2>Seu preço tem contexto.<br />Sua ferramenta também.</h2></div>
            <p>Da primeira simulação à revisão de todo o catálogo, cada etapa ajuda a entender a próxima decisão.</p>
          </div>
          <div className="feature-editorial">
            <div className="feature-large">
              <div className="feature-number">01 / ORGANIZAÇÃO</div>
              <h3>Seu catálogo.<br />Com memória.</h3>
              <p>Salve produtos, reutilize custos e volte ao histórico para entender o que mudou.</p>
              <div className="mini-catalog">
                <div><span><Package size={18} />Produto</span><span>Custos</span><span>Histórico</span></div>
                {['Compra e fabricação', 'Embalagem e frete', 'Comissões e tarifas'].map((s, i) => (
                  <div key={s}><span>{s}</span><span><Check size={15} />Incluído</span><span>Versão {i + 1}</span></div>
                ))}
              </div>
              <small>Visão conceitual dos componentes disponíveis.</small>
            </div>
            <div className="feature-stack">
              <article>
                <GitCompareArrows size={25} />
                <div><span className="feature-number">02 / COMPARAÇÃO</span><h3>O mesmo produto.<br />Canais com margens diferentes.</h3><p>Compare o mesmo preço ou a mesma margem, com as taxas de cada perfil.</p></div>
              </article>
              <article>
                <Percent size={25} />
                <div><span className="feature-number">03 / DECISÃO</span><h3>Desconto sem chute.</h3><p>Veja o limite para cobrir custos e o limite para preservar a sua meta.</p></div>
              </article>
            </div>
          </div>
          <div className="feature-small-grid">
            {[
              { Icone: SlidersHorizontal, titulo: 'Cenários salvos', texto: 'Simule mudanças sem alterar o preço do produto.' },
              { Icone: History, titulo: 'Alterações em lote', texto: 'Revise a prévia. Confirme. Preserve o histórico.' },
              { Icone: Download, titulo: 'Relatórios que explicam', texto: 'PDF, CSV e Excel com as premissas do cálculo.' },
            ].map(({ Icone, titulo, texto }) => (
              <article key={titulo}><Icone size={21} /><h3>{titulo}</h3><p>{texto}</p></article>
            ))}
          </div>
        </section>

        <section className="audience-section">
          <div><div className="eyebrow light">COMEÇANDO OU JÁ VENDENDO</div><h2>Para quem faz<br />o negócio acontecer.</h2></div>
          <div className="audience-tags">
            {['Pequenos comerciantes', 'Artesãos e fabricantes', 'Lojistas de marketplace', 'Quem revende', 'Lojas de bairro', 'Negócios digitais'].map((t) => <span key={t}>{t}</span>)}
          </div>
        </section>

        <section className="offer-section" id="oferta">
          <div>
            <div className="eyebrow">CLAREZA QUE CABE NO SEU NEGÓCIO</div>
            <h2>Uma ferramenta para<br />pensar melhor o preço.</h2>
            <p>Uma assinatura por pessoa que usa, sem fidelidade. Uma conta e seus produtos organizados.</p>
            <p className="offer-note">Não é um ERP e não emite notas fiscais. É o seu espaço para calcular, comparar e decidir.</p>
          </div>
          <div className="landing-offer">
            <div className="between"><strong>LucroCerto</strong><span className="badge purple">Por usuário</span></div>
            <div className="offer-price">{brl(PRECO_MENSAL_POR_USUARIO)}<span>por usuário, por mês</span></div>
            <p>
              No plano anual, {brl(PRECO_MENSAL_POR_USUARIO * (1 - DESCONTO_ANUAL))} por mês ({Math.round(DESCONTO_ANUAL * 100)}% de desconto). Cartão ou Pix,
              sem fidelidade. Comece com 15 dias de avaliação, sem cartão.
            </p>
            <ul className="checklist">
              {RECURSOS.map((t) => (
                <li key={t}><Check size={16} />{t}</li>
              ))}
            </ul>
            <Link to="/criar-conta" className="btn primary full-width">Começar avaliação grátis<ArrowRight size={17} /></Link>
            <small>
              Já tem conta? <a href={`${URL_DA_LOJA}/app/lucro`}>Assinar na loja</a> · <a href={LINKS_LEGAIS.termos} target="_blank" rel="noopener noreferrer">Condições de uso</a>
            </small>
          </div>
        </section>

        <section className="public-faq">
          <div><div className="eyebrow">ANTES DE COMEÇAR</div><h2>Perguntas que<br />fazem sentido.</h2></div>
          <div>
            {PERGUNTAS.map(([pergunta, resposta]) => (
              <details key={pergunta}><summary>{pergunta}<Plus size={16} /></summary><p>{resposta}</p></details>
            ))}
          </div>
        </section>

        <section className="closing-section">
          <div><span>Seu próximo produto já tem um custo.</span><h2>Agora, dê a ele um preço consciente.</h2></div>
          <a href="#calculadora" className="btn secondary">Calcular meu preço<ArrowRight size={17} /></a>
        </section>
      </main>
      <footer className="public-footer">
        <div><Marca /><p>Preço certo. Decisão consciente.</p></div>
        <div>
          <a href={LINKS_LEGAIS.termos} target="_blank" rel="noopener noreferrer">Termos de uso</a>
          <a href={LINKS_LEGAIS.privacidade} target="_blank" rel="noopener noreferrer">Privacidade</a>
          <a href={`mailto:${EMAIL_DO_SUPORTE}`}>Suporte</a>
        </div>
        <p>LucroCerto é um produto da MZN · <a href={LINKS_LEGAIS.site} target="_blank" rel="noopener noreferrer">mzndigital.com.br</a> · {EMAIL_DO_SUPORTE}</p>
      </footer>
    </div>
  )
}
