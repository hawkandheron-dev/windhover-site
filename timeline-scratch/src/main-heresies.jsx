import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts-google.css'
import './index.css'
import HeresiesApp from './HeresiesApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HeresiesApp />
  </StrictMode>,
)
