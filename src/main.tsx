import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installAuthAutoRenew, preloadGoogleAuth } from './features/auth/googleAuth'
import { installTrashFlush } from './features/gallery/trashQueue'

installAuthAutoRenew()
installTrashFlush()
void preloadGoogleAuth().catch(() => undefined)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
