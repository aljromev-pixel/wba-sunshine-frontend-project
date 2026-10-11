import { useTheme } from '../context/ThemeContext'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label="Dark mode" aria-pressed={theme === 'dark'} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
    <span aria-hidden="true">{theme === 'dark' ? '☾' : '☼'}</span>
    {theme === 'dark' ? 'Dark mode' : 'Light mode'}
  </button>
}
