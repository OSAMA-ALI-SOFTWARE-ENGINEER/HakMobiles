import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import { SessionProvider } from './lib/session.tsx'
import { InstallPrompt } from './ui/InstallPrompt'
import './index.css'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <BrowserRouter>
        <App />
        <InstallPrompt />
      </BrowserRouter>
    </SessionProvider>
  </StrictMode>,
)
