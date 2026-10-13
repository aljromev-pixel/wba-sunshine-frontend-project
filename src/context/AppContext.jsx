import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { authService } from '../services/authService'
import { setAuthTokenProvider, setUnauthorizedHandler } from '../services/apiClient'
import { inventoryService } from '../services/inventoryService'
import { can } from '../utils/permissions'
import { apiErrorMessage } from '../utils/apiErrors'

const AppContext = createContext(null)
const tokenKey = 'wba-auth-token'
const initials = (name) => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('')

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [data, setData] = useState(inventoryService.snapshot())
  const [notice, setNotice] = useState(null)
  const [authLoading, setAuthLoading] = useState(() => Boolean(sessionStorage.getItem(tokenKey)))
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [inventoryError, setInventoryError] = useState('')
  const [backgroundError, setBackgroundError] = useState('')
  const [authError, setAuthError] = useState('')
  const [restoreAttempt, setRestoreAttempt] = useState(0)
  const sessionVersion = useRef(0)
  const loadInventory = useCallback(async () => {
    const version = sessionVersion.current
    setInventoryLoading(true)
    setInventoryError('')
    setBackgroundError('')
    try {
      await inventoryService.load()
    } catch (exception) {
      if (version === sessionVersion.current) setInventoryError(apiErrorMessage(exception))
    } finally {
      if (version === sessionVersion.current) setInventoryLoading(false)
    }
  }, [])

  useEffect(() => inventoryService.subscribe(setData), [])
  useEffect(() => {
    if (!user || user.mustChangePassword) return
    let active = true, pending = false
    const refresh = async () => {
      if (pending || document.hidden || document.querySelector('form, [role="dialog"]')) return
      pending = true
      try {
        await inventoryService.load()
        if (active) setBackgroundError('')
      } catch (error) {
        if (active) setBackgroundError(`Automatic refresh failed. ${apiErrorMessage(error)}`)
      } finally { pending = false }
    }
    const timer = window.setInterval(refresh, 30000)
    const visible = () => { if (!document.hidden) refresh() }
    document.addEventListener('visibilitychange', visible)
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', visible) }
  }, [user?.id, user?.mustChangePassword])
  useEffect(() => inventoryService.subscribeLoadError((exception) => {
    if (sessionStorage.getItem(tokenKey)) setInventoryError(`Your change was saved, but inventory could not be refreshed. Retry loading inventory. ${apiErrorMessage(exception)}`)
  }), [])
  useEffect(() => {
    setAuthTokenProvider(() => sessionStorage.getItem(tokenKey))
    setUnauthorizedHandler(() => {
      sessionVersion.current += 1
      sessionStorage.removeItem(tokenKey)
      setUser(null)
      setAuthLoading(false)
      setInventoryLoading(false)
      setAuthError('Your session has expired. Please sign in again.')
      setInventoryError('')
      inventoryService.reset()
    })
    const token = sessionStorage.getItem(tokenKey)
    const controller = new AbortController()
    const version = sessionVersion.current
    let active = true
    if (token) Promise.resolve().then(async () => {
      if (!active) return
      try {
        const { user: authenticatedUser } = await authService.me({ signal: controller.signal })
        if (!active || version !== sessionVersion.current) return
        setUser({ ...authenticatedUser, initials: initials(authenticatedUser.name) })
        setAuthError('')
        if (!authenticatedUser.mustChangePassword) await loadInventory()
      } catch (exception) {
        if (active && exception.name !== 'AbortError' && version === sessionVersion.current) setAuthError(apiErrorMessage(exception))
      } finally {
        if (active) setAuthLoading(false)
      }
    })
    return () => {
      active = false
      controller.abort()
      setAuthTokenProvider(null)
      setUnauthorizedHandler(null)
    }
  }, [loadInventory, restoreAttempt])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4500)
    return () => clearTimeout(timer)
  }, [notice])

  const authenticate = useCallback(async (action, details) => {
    const version = ++sessionVersion.current
    const { token, user: authenticatedUser } = await authService[action](details)
    if (version !== sessionVersion.current) return
    setAuthError('')
    sessionStorage.setItem(tokenKey, token)
    setUser({ ...authenticatedUser, initials: initials(authenticatedUser.name) })
    setInventoryError('')
    if (authenticatedUser.mustChangePassword) inventoryService.reset()
    else await loadInventory()
  }, [loadInventory])

  const value = useMemo(
    () => ({
      user,
      authLoading,
      authError,
      canRetrySession: Boolean(authError && sessionStorage.getItem(tokenKey)),
      retrySession: () => {
        setAuthError('')
        setAuthLoading(true)
        setRestoreAttempt((attempt) => attempt + 1)
      },
      inventoryLoading,
      inventoryError,
      backgroundError,
      retryInventory: loadInventory,
      data,
      alerts: inventoryService.alerts(),
      can: (permission) => can(user, permission),
      notify: (message, tone = 'success') => setNotice({ message, tone }),
      notice,
      login: (credentials) => authenticate('login', credentials),
      changePassword: (details) => authenticate('changePassword', details),
      logout: async () => {
        const logoutRequest = authService.logout()
        sessionVersion.current += 1
        sessionStorage.removeItem(tokenKey)
        setUser(null)
        setAuthError('')
        setAuthLoading(false)
        setInventoryLoading(false)
        setInventoryError('')
        inventoryService.reset()
        try {
          await logoutRequest
        } catch {
          // Clear an already-invalid local session too.
        }
      },
    }),
    [user, authLoading, authError, inventoryLoading, inventoryError, backgroundError, loadInventory, authenticate, data, notice]
  )
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
export const useApp = () => useContext(AppContext)
