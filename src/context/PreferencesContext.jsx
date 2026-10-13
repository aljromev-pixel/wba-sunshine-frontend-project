import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'

const PreferencesContext = createContext(null)
const preferenceKey = 'wba-display-preferences'
const defaults = { textSize: 'default', motion: 'system', ambient: true }
const normalize = value => ({
  textSize: ['small', 'default', 'large'].includes(value?.textSize) ? value.textSize : defaults.textSize,
  motion: ['system', 'reduced'].includes(value?.motion) ? value.motion : defaults.motion,
  ambient: typeof value?.ambient === 'boolean' ? value.ambient : defaults.ambient,
})
const readPreferences = () => {
  try { return normalize(JSON.parse(localStorage.getItem(preferenceKey))) } catch { return { ...defaults } }
}
const applyPreferences = preferences => {
  document.documentElement.dataset.textSize = preferences.textSize
  document.documentElement.dataset.motion = preferences.motion
  document.documentElement.dataset.ambient = preferences.ambient ? 'on' : 'off'
}
applyPreferences(readPreferences())

export function PreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(readPreferences)
  const current = useRef(preferences)
  useLayoutEffect(() => { applyPreferences(preferences) }, [preferences])
  useEffect(() => {
    const sync = event => {
      if (event.key !== preferenceKey && event.key !== null) return
      const next = readPreferences()
      current.current = next
      setPreferences(next)
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  const updatePreferences = patch => {
    const next = normalize({ ...current.current, ...patch })
    current.current = next
    setPreferences(next)
    try { localStorage.setItem(preferenceKey, JSON.stringify(next)); return true } catch { return false }
  }
  return <PreferencesContext.Provider value={{ preferences, updatePreferences, resetPreferences: () => updatePreferences(defaults) }}>{children}</PreferencesContext.Provider>
}

export const usePreferences = () => useContext(PreferencesContext)
