import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App'
import { AppProvider } from './context/AppContext'
import { ThemeProvider } from './context/ThemeContext'
import { AmbientBackground } from './components/AmbientBackground'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AmbientBackground />
      <AppProvider>
        <App />
      </AppProvider>
    </ThemeProvider>
  </StrictMode>
)
