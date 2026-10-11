import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react'

const ThemeContext = createContext(null)
const themeKey = 'sunshine-theme'
const systemTheme = () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
const savedTheme = () => {
  try {
    const value = localStorage.getItem(themeKey)
    return ['light', 'dark'].includes(value) ? value : null
  } catch { return null }
}
document.documentElement.dataset.theme = savedTheme() || systemTheme()

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme)
  useLayoutEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setTheme(savedTheme() || systemTheme())
    media.addEventListener('change', update)
    window.addEventListener('storage', update)
    return () => {
      media.removeEventListener('change', update)
      window.removeEventListener('storage', update)
    }
  }, [])
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem(themeKey, next) } catch { /* Switching still works when storage is unavailable. */ }
    setTheme(next)
  }
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}
export const useTheme = () => useContext(ThemeContext)
