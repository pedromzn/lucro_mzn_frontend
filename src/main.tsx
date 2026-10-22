/** A entrada do painel do Lucro Certo. */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
/* as fontes da marca MZN (Inter no texto, Montserrat no título), servidas daqui mesmo: a CSP não deixa buscar fonte de fora */
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/montserrat/latin-500.css'
import '@fontsource/montserrat/latin-600.css'
import '@fontsource/montserrat/latin-700.css'
/* as mensagens de validação do zod em português, antes de qualquer esquema ser usado */
import '@shared/zodPortugues'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
