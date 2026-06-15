import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/anton'
import './index.css'
import App from './App.tsx'

const root = document.getElementById('root')!

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
