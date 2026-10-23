/**
 * O logo de cada canal de venda — Custos e canais, Comparar canais.
 *
 * O mesmo ladrilho do Marketing Flow (`mzn_mkt/frontend/src/integracoes/Logos.tsx`,
 * 22/10/2026, pedido do Pedro: "sempre use os logos"): a marca na cor dela, em
 * vez das duas primeiras letras do nome. O WhatsApp é o desenho do MKT; a
 * câmera do Instagram e o saco da Shopee são do Simple Icons (CC0, de onde o
 * MKT tirou o WhatsApp);
 * o aperto de mão do Mercado Livre é o favicon que o próprio site publica
 * (`assets/marcas/mercado-livre.svg`, baixado em 22/10/2026 de mlstatic.com) —
 * o Simple Icons não tem a marca. Vão embutidos, não como imagem do site
 * deles: o painel não depende de host de terceiro (nem da CSP) para desenhar
 * um cartão.
 *
 * Quem decide é o TIPO do canal, não o nome: "Shopee Full" e "Minha Shopee"
 * levam a mesma marca. Loja própria, loja física e outro não têm marca de
 * terceiro — ficam com um ícone no ladrilho roxo da casa.
 */

import { Globe, Store, Tag } from 'lucide-react'
import type { Canal } from '@/lib/api'
import mercadoLivre from '@/assets/marcas/mercado-livre.svg'

const CAMINHO_DA_SHOPEE = 'M15.9414 17.9633c.229-1.879-.981-3.077-4.1758-4.0969-1.548-.528-2.277-1.22-2.26-2.1719.065-1.056 1.048-1.825 2.352-1.85a5.2898 5.2898 0 0 1 2.8838.89c.116.072.197.06.263-.039.09-.145.315-.494.39-.62.051-.081.061-.187-.068-.281-.185-.1369-.704-.4149-.983-.5319a6.4697 6.4697 0 0 0-2.5118-.514c-1.909.008-3.4129 1.215-3.5389 2.826-.082 1.1629.494 2.1078 1.73 2.8278.262.152 1.6799.716 2.2438.892 1.774.552 2.695 1.5419 2.478 2.6969-.197 1.047-1.299 1.7239-2.818 1.7439-1.2039-.046-2.2878-.537-3.1278-1.19l-.141-.11c-.104-.08-.218-.075-.287.03-.05.077-.376.547-.458.67-.077.108-.035.168.045.234.35.293.817.613 1.134.775a6.7097 6.7097 0 0 0 2.8289.727 4.9048 4.9048 0 0 0 2.0759-.354c1.095-.465 1.8029-1.394 1.9449-2.554zM11.9986 1.4009c-2.068 0-3.7539 1.95-3.8329 4.3899h7.6657c-.08-2.44-1.765-4.3899-3.8328-4.3899zm7.8516 22.5981-.08.001-15.7843-.002c-1.074-.04-1.863-.91-1.971-1.991l-.01-.195L1.298 6.2858a.459.459 0 0 1 .45-.494h4.9748C6.8448 2.568 9.1607 0 11.9996 0c2.8388 0 5.1537 2.5689 5.2757 5.7898h4.9678a.459.459 0 0 1 .458.483l-.773 15.5883-.007.131c-.094 1.094-.979 1.9769-2.0709 2.0059z'
/* a câmera da marca (Simple Icons, CC0): o lucide do Lucro já não traz ícone de marca */
const CAMINHO_DO_INSTAGRAM = 'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077'
/* o balão da marca (Simple Icons, CC0) — o mesmo do MKT */
const CAMINHO_DO_WHATSAPP = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z'

const ROXO_DA_CASA = 'linear-gradient(135deg,#7C3AED,#5B21B6)'

export function LogoDoCanal({ tipo, tamanho = 40 }: { tipo: Canal['tipo']; tamanho?: number }) {
  const icone = Math.round(tamanho * 0.52)
  const ladrilho = (fundo: string, filho: React.ReactNode, rotulo: string) => (
    <span role="img" aria-label={rotulo} className="channel-logo" style={{ width: tamanho, height: tamanho, background: fundo }}>{filho}</span>
  )
  const svg = (caminho: string) => <svg viewBox="0 0 24 24" width={icone} height={icone} fill="currentColor" aria-hidden><path d={caminho} /></svg>

  switch (tipo) {
    case 'shopee':
      return ladrilho('#EE4D2D', svg(CAMINHO_DA_SHOPEE), 'Shopee')
    case 'mercadolivre':
      /* a marca já é o ladrilho (a elipse amarela): fundo branco, como as de cor única no MKT */
      return ladrilho('#fff', <img src={mercadoLivre} alt="" width={Math.round(tamanho * 0.86)} height={Math.round(tamanho * 0.86)} />, 'Mercado Livre')
    case 'redes_sociais':
      /* o canal é "Instagram / WhatsApp": as duas marcas, lado a lado */
      return (
        <span role="img" aria-label="Instagram e WhatsApp" className="channel-logo-pair">
          <LadrilhoPequeno fundo="linear-gradient(135deg,#F58529,#DD2A7B 50%,#8134AF)" tamanho={tamanho}>{svg(CAMINHO_DO_INSTAGRAM)}</LadrilhoPequeno>
          <LadrilhoPequeno fundo="#25D366" tamanho={tamanho}>{svg(CAMINHO_DO_WHATSAPP)}</LadrilhoPequeno>
        </span>
      )
    case 'loja_propria':
      return ladrilho(ROXO_DA_CASA, <Globe size={icone} strokeWidth={2.2} />, 'Loja própria')
    case 'loja_fisica':
      return ladrilho(ROXO_DA_CASA, <Store size={icone} strokeWidth={2.2} />, 'Loja física')
    default:
      return ladrilho(ROXO_DA_CASA, <Tag size={icone} strokeWidth={2.2} />, 'Canal de venda')
  }
}

function LadrilhoPequeno({ fundo, tamanho, children }: { fundo: string; tamanho: number; children: React.ReactNode }) {
  return <span className="channel-logo" style={{ width: tamanho, height: tamanho, background: fundo }}>{children}</span>
}
