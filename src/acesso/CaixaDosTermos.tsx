/**
 * MOD-01 — a caixa "li e concordo" do cadastro e do convite.
 *
 * Nasce DESMARCADA e trava o botão até ser marcada: aceite que vem marcado de
 * fábrica não prova nada. O servidor recusa o envio sem ela
 * (`termos_nao_aceitos`, `servico/termos.ts` no Núcleo), então isto aqui é só
 * a metade que a pessoa vê. Os textos moram no site oficial e abrem em outra
 * aba, para o formulário preenchido não se perder.
 */

const SITE = 'https://www.mzndigital.com.br'

export const LINKS_LEGAIS = {
  site: SITE,
  termos: `${SITE}/termos-de-uso`,
  privacidade: `${SITE}/politica-de-privacidade`,
}

export function CaixaDosTermos({ marcado, aoMudar }: { marcado: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={marcado} onChange={(e) => aoMudar(e.target.checked)} />
      <span>
        Li e concordo com os <a href={LINKS_LEGAIS.termos} target="_blank" rel="noopener noreferrer">Termos de Uso</a> e com o{' '}
        <a href={LINKS_LEGAIS.privacidade} target="_blank" rel="noopener noreferrer">Aviso de Privacidade</a>, e declaro ter 18 anos ou mais.
      </span>
    </label>
  )
}
