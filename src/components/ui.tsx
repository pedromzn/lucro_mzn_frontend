/**
 * As peças de tela do Lucro Certo — as do mock (`LucroCerto/components/ui.tsx`),
 * com a mesma marcação e as mesmas classes de `styles/lucro.css`, e os nomes em
 * português. Tela nova monta com estas peças; classe nova vai para o CSS do mock.
 *
 * A janela e a caixa de busca são as do Radix, como no mock: foco preso,
 * Esc fecha, leitor de tela anuncia o título — nada disso se refaz à mão.
 */

import { useId, useState, type ReactNode } from 'react'
import { AlertCircle, ArrowUpRight, Check, ChevronDown, LoaderCircle, Search, X } from 'lucide-react'
import { Dialog, Popover } from 'radix-ui'

// ── formatação ──────────────────────────────────────────────────────────────

export const brl = (v: string | number | null | undefined): string =>
  v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const pct = (v: string | number | null | undefined): string =>
  v === null || v === undefined ? '—' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

export const quantidade = (v: string | number): string => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 6 })

/* o fuso é o do negócio, não o do navegador: uma venda das 23h não muda de dia numa viagem */
export const data = (v: string | number | Date): string =>
  new Date(v).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

export const erroDe = (e: unknown, padrao = 'Não foi possível concluir.'): string => (e instanceof Error ? e.message : padrao)

export const novaChave = (): string => crypto.randomUUID()

// ── botões e campos ─────────────────────────────────────────────────────────

const CLASSE_DA_VARIANTE = { primario: 'primary', secundario: 'secondary', fantasma: 'ghost', perigo: 'danger' } as const

export function Botao({ children, variante = 'primario', className = '', ocupado, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: keyof typeof CLASSE_DA_VARIANTE
  ocupado?: boolean
}) {
  return (
    <button type="button" className={`btn ${CLASSE_DA_VARIANTE[variante]} ${className}`} {...props} disabled={ocupado || props.disabled}>
      {ocupado ? <LoaderCircle className="spin" size={17} /> : null}
      {children}
    </button>
  )
}

export function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: ReactNode }) {
  return (
    <div className="field">
      <div className="field-title">{rotulo}</div>
      {children}
      {dica ? <small>{dica}</small> : null}
    </div>
  )
}

export function CampoDeTexto({ rotulo, dica, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { rotulo: string; dica?: ReactNode }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{rotulo}</label>
      <input id={id} {...props} />
      {dica ? <small>{dica}</small> : null}
    </div>
  )
}

/**
 * Número com vírgula na tela e ponto no dado.
 *
 * O valor guardado é o TEXTO decimal que o motor recebe (`@shared/preco`):
 * nunca passa por `Number`, que arredondaria R$ 0,1 + R$ 0,2 no caminho.
 */
export function CampoNumero({ rotulo, valor, aoMudar, prefixo = 'R$', dica, negativo = false, desabilitado }: {
  rotulo: string
  valor: string
  aoMudar: (v: string) => void
  prefixo?: string
  dica?: ReactNode
  negativo?: boolean
  desabilitado?: boolean
}) {
  const id = useId()
  const formato = negativo ? /^-?\d*(\.\d{0,8})?$/ : /^\d*(\.\d{0,8})?$/
  return (
    <div className="field">
      <label htmlFor={id}>{rotulo}</label>
      <div className="number-input">
        <span>{prefixo}</span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          disabled={desabilitado}
          value={valor.replace('.', ',')}
          onChange={(e) => {
            /* o campo nasce com "0": quem digita depois dele escreveria "018,5", que o motor recusa */
            const v = e.target.value.replace(',', '.').replace(/^(-?)0+(?=\d)/, '$1')
            if (formato.test(v)) aoMudar(v)
          }}
          onBlur={() => {
            if (valor === '' || valor === '-') aoMudar('0')
            else if (valor.endsWith('.')) aoMudar(valor.slice(0, -1))
          }}
        />
      </div>
      {dica ? <small>{dica}</small> : null}
    </div>
  )
}

export type Opcao<T extends string = string> = T | { valor: T; rotulo: string }

export function Selecao<T extends string>({ rotulo, valor, aoMudar, opcoes, dica }: {
  rotulo: string
  valor: T
  aoMudar: (v: T) => void
  opcoes: readonly Opcao<T>[]
  dica?: ReactNode
}) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{rotulo}</label>
      <select id={id} value={valor} onChange={(e) => aoMudar(e.target.value as T)}>
        {opcoes.map((o) =>
          typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.valor} value={o.valor}>{o.rotulo}</option>,
        )}
      </select>
      {dica ? <small>{dica}</small> : null}
    </div>
  )
}

/** Lista com busca — produto, canal, categoria. Com `aoCriar`, o que foi digitado vira opção nova. */
export function Combo({ rotulo, valor, aoMudar, opcoes, marcador = 'Selecione', aoCriar }: {
  rotulo: string
  valor: string
  aoMudar: (v: string) => void
  opcoes: Array<{ valor: string; rotulo: string }>
  marcador?: string
  aoCriar?: (v: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const id = useId()
  const filtradas = opcoes.filter((o) => o.rotulo.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR')))
  const escolher = (v: string) => {
    aoMudar(v)
    setAberto(false)
    setBusca('')
  }
  return (
    <div className="field">
      <span id={id} className="field-title">{rotulo}</span>
      <Popover.Root open={aberto} onOpenChange={setAberto}>
        <Popover.Trigger className="combo-trigger" aria-labelledby={id}>
          <span>{opcoes.find((o) => o.valor === valor)?.rotulo || marcador}</span>
          <ChevronDown size={16} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="combo-pop" sideOffset={5} align="start">
            <div className="search">
              <Search size={16} />
              <input aria-label={`Buscar ${rotulo}`} placeholder="Digite para buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <div className="combo-options">
              {filtradas.map((o) => (
                <button type="button" key={o.valor} className={valor === o.valor ? 'selected' : ''} onClick={() => escolher(o.valor)}>
                  {o.rotulo}
                  {valor === o.valor ? <Check size={16} /> : null}
                </button>
              ))}
              {!filtradas.length ? <p className="muted small">Nenhuma opção encontrada.</p> : null}
              {aoCriar && busca.trim() && !opcoes.some((o) => o.rotulo === busca) ? (
                <button type="button" onClick={() => { aoCriar(busca.trim()); setAberto(false); setBusca('') }}>
                  Criar “{busca.trim()}”
                </button>
              ) : null}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

// ── janela, avisos e estados ────────────────────────────────────────────────

export function Janela({ aberta, aoFechar, titulo, descricao, larga = false, children }: {
  aberta: boolean
  aoFechar: () => void
  titulo: string
  descricao?: string
  larga?: boolean
  children: ReactNode
}) {
  return (
    <Dialog.Root open={aberta} onOpenChange={(v) => !v && aoFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className={`dialog ${larga ? 'wide' : ''}`}>
          <div className="dialog-head">
            <div>
              <Dialog.Title>{titulo}</Dialog.Title>
              <Dialog.Description>{descricao ?? 'Revise as informações antes de continuar.'}</Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Fechar"><X size={20} /></Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const CLASSE_DO_AVISO = { info: 'info', erro: 'error', ok: 'success', atencao: 'warning' } as const

export function Aviso({ children, tipo = 'info' }: { children: ReactNode; tipo?: keyof typeof CLASSE_DO_AVISO }) {
  return (
    <div className={`notice ${CLASSE_DO_AVISO[tipo]}`} role={tipo === 'erro' ? 'alert' : undefined}>
      <AlertCircle size={17} />
      <div>{children}</div>
    </div>
  )
}

export function Vazio({ titulo, children, acao, icone }: { titulo: string; children: ReactNode; acao?: ReactNode; icone?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icone ?? <ArrowUpRight size={27} />}</div>
      <h3>{titulo}</h3>
      <p>{children}</p>
      {acao}
    </div>
  )
}

const CLASSE_DO_TOM = { neutro: 'neutral', verde: 'green', ambar: 'amber', vermelho: 'red', roxo: 'purple' } as const

export function Selo({ children, tom = 'neutro' }: { children: ReactNode; tom?: keyof typeof CLASSE_DO_TOM }) {
  return <span className={`badge ${CLASSE_DO_TOM[tom]}`}>{children}</span>
}
