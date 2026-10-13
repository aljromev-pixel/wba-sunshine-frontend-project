import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { apiErrorMessage } from '../utils/apiErrors'
import { SunIcon } from './BrandIcons'

export function useFormFeedback() {
  const [error, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  return {
    error,
    fieldErrors,
    setError: (message) => { setMessage(message); setFieldErrors({}) },
    handleError: (exception) => {
      setMessage(apiErrorMessage(exception))
      setFieldErrors(exception?.data?.errors || {})
    },
  }
}

export function FormField({ name, feedback, children, ...props }) {
  const errorId = `${useId()}-error`
  const messages = feedback.fieldErrors[name]
  return <label {...props}>
    {Children.map(children, (child) => isValidElement(child) && ['input', 'select', 'textarea'].includes(child.type)
      ? cloneElement(child, { name: child.props.name || name, 'aria-invalid': messages ? true : undefined, 'aria-describedby': messages ? [child.props['aria-describedby'], errorId].filter(Boolean).join(' ') : child.props['aria-describedby'] })
      : child)}
    {messages && <span id={errorId} className="form-error" role="alert">{[].concat(messages).join(' ')}</span>}
  </label>
}

export function EmptyState({ title = 'Nothing to show', text = 'There are no records that match this view.' }) {
  return (
    <div className="empty-state">
      <span>◌</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}
export function StatusBadge({ children }) {
  const value = String(children).toLowerCase().replaceAll(' ', '-')
  return <span className={`status ${value}`}>{children}</span>
}
export function LoadingState({ children = 'Loading workspace…', fullPage = false }) {
  return (
    <div className={`loading-state${fullPage ? ' loading-screen' : ''}`} role="status" aria-live="polite">
      <span className="loading-logo" aria-hidden="true"><SunIcon /></span>
      <p>{children}</p>
    </div>
  )
}
export function FormError({ children }) {
  if (!children) return null
  return <p className="form-error" role="alert">{children}</p>
}
export function AsyncButton({ loading, children, loadingLabel = 'Saving…', ...props }) {
  return <button {...props} aria-busy={loading || undefined} disabled={loading || props.disabled}>{loading && <SunIcon className="sun-icon button-spinner" />}{loading ? loadingLabel : children}</button>
}
export function ConfirmDialog({ title = 'Confirm action', message, confirmLabel = 'Confirm', tone = 'default', onCancel, onConfirm }) {
  const titleId = useId()
  const messageId = useId()
  const dialog = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    const workspace = document.querySelector('.application')
    const previousInert = workspace?.inert
    document.body.style.overflow = 'hidden'
    if (workspace) workspace.inert = true
    dialog.current.querySelector('button').focus()
    return () => {
      document.body.style.overflow = previousOverflow
      if (workspace) workspace.inert = previousInert
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!pending.current) onCancel()
      }
      if (event.key !== 'Tab') return
      const controls = [...dialog.current.querySelectorAll('button:not([disabled])')]
      const first = controls[0]
      const last = controls.at(-1)
      if (!first) { event.preventDefault(); dialog.current.focus(); return }
      if (!dialog.current.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last) || (event.shiftKey && document.activeElement === first)) {
        event.preventDefault()
        const target = event.shiftKey ? last : first
        target.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onCancel])
  const confirm = async () => {
    if (pending.current) return
    pending.current = true
    setLoading(true)
    dialog.current.focus()
    setError('')
    try {
      await onConfirm()
      onCancel()
    } catch (exception) {
      setError(apiErrorMessage(exception))
    } finally {
      pending.current = false
      setLoading(false)
    }
  }
  return createPortal(<div className="confirm-overlay" role="presentation">
    <section ref={dialog} tabIndex={-1} className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} aria-busy={loading}>
      <h2 id={titleId}>{title}</h2>
      <p id={messageId}>{message}</p>
      <FormError>{error}</FormError>
      <div className="form-actions">
        <button type="button" className="inline-button" onClick={onCancel} disabled={loading}>Cancel</button>
        <AsyncButton type="button" className={`button ${tone === 'danger' ? 'danger' : 'primary'}`} onClick={confirm} loading={loading} loadingLabel="Processing…">{confirmLabel}</AsyncButton>
      </div>
    </section>
  </div>, document.body)
}
export const formatDate = (date, withTime = false) =>
  new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', ...(withTime ? { timeStyle: 'short' } : {}) }).format(
    new Date(date)
  )
