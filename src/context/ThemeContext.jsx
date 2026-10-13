import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'

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
  const [changingTheme, setChangingTheme] = useState(false)
  const [spread, setSpread] = useState(null)
  const changing = useRef(false)
  const transition = useRef(null)
  const glow = useRef(null)
  const glowAnimation = useRef(null)
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#181a18' : '#f3f2ee')
  }, [theme])
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setTheme(savedTheme() || systemTheme())
    media.addEventListener('change', update)
    window.addEventListener('storage', update)
    return () => {
      media.removeEventListener('change', update)
      window.removeEventListener('storage', update)
      transition.current?.skipTransition()
      glowAnimation.current?.cancel()
    }
  }, [])
  const toggleTheme = async (icon) => {
    if (changing.current) return
    const next = theme === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem(themeKey, next) } catch { /* Switching still works when storage is unavailable. */ }
    const applyTheme = () => flushSync(() => setTheme(next))
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      applyTheme()
      return
    }
    const bounds = icon?.getBoundingClientRect()
    const x = bounds ? bounds.left + bounds.width / 2 : innerWidth / 2
    const y = bounds ? bounds.top + bounds.height * .22 : innerHeight / 2
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    const clipPath = [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`]
    const frames = { clipPath: next === 'light' ? clipPath : [...clipPath].reverse() }
    const options = { duration: 640, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'both' }
    changing.current = true
    setChangingTheme(true)
    document.documentElement.classList.add(`theme-reveal-${next}`)
    try {
      if (typeof document.startViewTransition === 'function' && typeof KeyframeEffect !== 'undefined' && 'pseudoElement' in KeyframeEffect.prototype) {
        const active = document.startViewTransition(applyTheme)
        transition.current = active
        await active.ready
        await document.documentElement.animate(frames, { ...options, pseudoElement: next === 'light' ? '::view-transition-new(root)' : '::view-transition-old(root)' }).finished
        await active.finished
      } else {
        flushSync(() => { setTheme(next); setSpread({ x, y, direction: next }) })
        glowAnimation.current = glow.current.animate(frames, options)
        await glowAnimation.current.finished
      }
    } catch {
      transition.current?.skipTransition()
      applyTheme()
    } finally {
      glowAnimation.current?.cancel()
      glowAnimation.current = null
      transition.current = null
      document.documentElement.classList.remove('theme-reveal-light', 'theme-reveal-dark')
      changing.current = false
      setChangingTheme(false)
      setSpread(null)
    }
  }
  return <ThemeContext.Provider value={{ theme, toggleTheme, changingTheme }}>
    {children}
    {spread && createPortal(<div ref={glow} className={`theme-light-spread theme-light-spread-${spread.direction}`} style={{ '--spread-x': `${spread.x}px`, '--spread-y': `${spread.y}px` }} aria-hidden="true" />, document.body)}
  </ThemeContext.Provider>
}
export const useTheme = () => useContext(ThemeContext)
