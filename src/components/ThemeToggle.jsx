import { useTheme } from '../context/ThemeContext'
import { FlashlightIcon } from './BrandIcons'

export function ThemeToggle() {
  const { theme, toggleTheme, changingTheme } = useTheme()
  return <button type="button" className="theme-toggle" onClick={event => toggleTheme(event.currentTarget.querySelector('svg'))} aria-label={theme === 'dark' ? 'Dark mode' : 'Light mode'} aria-pressed={theme === 'dark'} aria-busy={changingTheme || undefined} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
    <FlashlightIcon />
    {theme === 'dark' ? 'Dark mode' : 'Light mode'}
  </button>
}
