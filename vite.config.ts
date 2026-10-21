import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

/*
 * O painel do Lucro Certo — o molde do painel do MKT (`mzn_mkt/frontend/vite.config.ts`).
 *
 * Porta e destino do proxy vêm do `.env`. O painel chama `/api/...` relativo
 * nos dois ambientes; quem decide o destino é o proxy — aqui o do Vite, na
 * instância o nginx do `lucro.` (`mzn_infra/fronts/lucro.mzndigital.com.br`).
 * Os dois precisam mudar juntos.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'VITE_')
  const alvo = env.VITE_API_ALVO || 'http://127.0.0.1:3020'
  const alvoDoNucleo = env.VITE_NUCLEO_ALVO || 'http://127.0.0.1:3000'

  /*
   * O build de produção RECUSA sair sem o endereço da loja: sem ele, quem está
   * com a licença vencida seria mandado para `localhost:5190` — a máquina dele.
   * Mesmo motivo e mesma trava do painel do MKT.
   */
  if (mode === 'production' && !env.VITE_LOJA_URL) {
    throw new Error(
      'VITE_LOJA_URL não está definida, e sem ela o painel manda quem está com a licença ' +
        'vencida para http://localhost:5190 em vez da loja. Defina-a nas variáveis do repositório ' +
        'no GitHub (Settings → Variables), ou num .env local — ver .env.example.',
    )
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        /* o espelho de `mzn_lucro_certo/backend/shared/` — o dono é lá; `scripts/sincronizar-shared.mjs` o refaz */
        '@shared': path.resolve(__dirname, 'shared'),
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      /* 5181: o MKT é 5180 e a loja 5190 */
      port: Number(env.VITE_PORTA) || 5181,
      host: '127.0.0.1',
      proxy: {
        /*
         * ⚠️ A ORDEM DECIDE. O Vite usa a PRIMEIRA chave que casa por prefixo:
         * com `/api` antes, o login iria para este app, que não atende
         * `/api/auth` — o sintoma seria 404 no login com o Núcleo de pé.
         */
        '/api/auth': { target: alvoDoNucleo, changeOrigin: true },
        '/api/nucleo': { target: alvoDoNucleo, changeOrigin: true },
        '/api': { target: alvo, changeOrigin: true },
      },
    },
    test: { environment: 'happy-dom' },
  }
})
