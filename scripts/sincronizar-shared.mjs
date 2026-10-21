/*
 * Espelha `backend/shared/` aqui dentro.
 *
 * O painel importa `@shared` — o motor de preço, os contratos, o estoque, as
 * etiquetas e a ajuda. Esse código é do backend, e o dono dele é
 * `mzn_lucro_certo/backend/shared/` (o mesmo desenho do painel do MKT). Só que o build de produção (o GitHub Actions do
 * painel, e antes a Vercel) clona **um** repositório, e
 * apontar para fora dele faz o build morrer numa cascata de `@shared` não
 * resolvido. Então o painel carrega um espelho versionado.
 *
 * Este script é o único jeito de atualizar esse espelho, e roda sozinho antes
 * de `dev`, `test` e `build`. Quando a origem não existe — que é o caso no
 * CI, onde só o painel foi clonado — ele não faz nada e sai bem: o que
 * está versionado é o que vale.
 *
 * ⚠️ NÃO EDITE `shared/` daqui. O que você escrever some na próxima sincronia,
 * e a API continua rodando o arquivo antigo — a prévia no painel passaria a
 * renderizar diferente da página publicada, que é o pior defeito possível
 * neste projeto, porque ninguém vê acontecendo.
 */

import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const origem = path.resolve(aqui, '../../backend/shared')
const destino = path.resolve(aqui, '../shared')

if (!existsSync(origem)) {
  console.log(`shared: espelho mantido (origem ausente em ${path.relative(process.cwd(), origem)})`)
  process.exit(0)
}

/* apaga antes de copiar: sem isso, arquivo removido no backend sobrevive aqui
   para sempre, e um import que já não existe lá continua compilando aqui */
rmSync(destino, { recursive: true, force: true })
cpSync(origem, destino, {
  recursive: true,
  filter: (caminho) => !/(^|\/)(\.DS_Store|node_modules)$/.test(caminho),
})

/*
 * A marca é um hash do CONTEÚDO, e não a data nem o commit de origem.
 *
 * Com data, o arquivo mudava a cada `npm test` e o `git status` vivia sujo —
 * ruído que ensina a ignorar o que deveria chamar atenção. Com o commit, ele
 * mudava a cada commit do backend, mesmo os que não tocam em `shared/`. Assim
 * ele só muda quando o espelho de fato mudou, e um `git status` limpo depois
 * da sincronia é a prova de que o espelho está em dia.
 */
function hashDaPasta(raiz) {
  const soma = createHash('sha256')
  const andar = (pasta) => {
    for (const nome of readdirSync(pasta).sort()) {
      if (nome === '.origem') continue
      const caminho = path.join(pasta, nome)
      if (statSync(caminho).isDirectory()) andar(caminho)
      else {
        soma.update(path.relative(raiz, caminho).replace(/\\/g, '/'))
        soma.update(readFileSync(caminho))
      }
    }
  }
  andar(raiz)
  return soma.digest('hex').slice(0, 16)
}

const hash = hashDaPasta(destino)
writeFileSync(
  path.join(destino, '.origem'),
  [
    '# Cópia gerada por scripts/sincronizar-shared.mjs — não edite nada desta pasta.',
    '# O original é mzn_lucro_certo/backend/shared/, e é lá que se mexe.',
    '#',
    '# Este hash é do conteúdo. Se ele mudar depois de uma sincronia, o espelho',
    '# estava velho — confira o diff e commite junto com o que veio do backend.',
    `conteudo: ${hash}`,
    '',
  ].join('\n'),
)

console.log(`shared: espelho em dia (${hash})`)
