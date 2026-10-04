import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'virtual:brand.css'
import './styles/tokens.css'
import './styles/app.css'
import { App } from './App'
import { setupNative } from './lib/native'

void setupNative()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
