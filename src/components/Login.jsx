import { useId, useState } from 'react'
import { useApp } from '../context/AppContext'
import { FormField, useFormFeedback, AsyncButton, FormError } from './Shared'
import { ThemeToggle } from './ThemeToggle'
import { BrandLogo } from './BrandLogo'

export function Login({ portal = 'staff' }) {
  const { login, authError, canRetrySession, retrySession } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const passwordId = useId()
  const feedback = useFormFeedback()
  const { error, setError, handleError } = feedback
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    if (submitting) return
    setError('')
    setShowPassword(false)
    setSubmitting(true)
    try {
      await login({ email, password, portal })
    } catch (exception) {
      handleError(exception)
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <main className="login-page">
      <section className="login-brand">
        <BrandLogo />
        <p className="eyebrow">POWERING INVENTORY CLARITY</p>
        <h1>Reliable stock control, brilliantly connected.</h1>
        <p>WBA keeps every appliance, batch, and movement visible, accountable, and ready for the next demand.</p>
      </section>
      <section className="login-card" aria-labelledby="login-heading">
        <div className="auth-actions"><ThemeToggle /></div>
        <p className="eyebrow">{portal === 'admin' ? 'ADMIN ACCESS' : 'STAFF ACCESS'}</p>
        <h2 id="login-heading">{portal === 'admin' ? 'Admin sign in' : 'Sign in to your workspace'}</h2>
        <p>{portal === 'admin' ? 'For Administration Managers. Use your assigned administrator account.' : 'For Warehouse, Sales and Purchasing accounts, including managers and supervisors.'}</p>
        <form className="compact-form" onSubmit={submit}>
          <FormField name="email" feedback={feedback}>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" disabled={submitting} /></FormField>
          <div className="login-password-field">
            <label htmlFor={passwordId}>Password</label>
            <div className="login-password-control">
              <input id={passwordId} name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" disabled={submitting} aria-invalid={feedback.fieldErrors.password ? true : undefined} aria-describedby={feedback.fieldErrors.password ? `${passwordId}-error` : undefined} />
              <button type="button" className="password-visibility" aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} aria-controls={passwordId} aria-pressed={showPassword} disabled={submitting} onClick={() => setShowPassword(visible => !visible)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  {showPassword && <path d="m3 3 18 18" />}
                </svg>
              </button>
            </div>
            {feedback.fieldErrors.password && <span id={`${passwordId}-error`} className="form-error" role="alert">{[].concat(feedback.fieldErrors.password).join(' ')}</span>}
          </div>
          <FormError>{error || authError}</FormError>
          {canRetrySession && <button type="button" className="inline-button" onClick={retrySession} disabled={submitting}>Retry session restoration</button>}
          <AsyncButton className="button primary" loading={submitting} loadingLabel="Signing in…">Sign in</AsyncButton>
        </form>
        <p className="public-account-link">Need an account? Contact your administrator for access.</p>
        <p className="public-account-link"><a href={portal === 'admin' ? '#/sign-in' : '#/admin/sign-in'}>{portal === 'admin' ? 'Use Staff sign in' : 'Use Admin sign in'}</a></p>
        <a className="public-back" href="#/">← Back to home</a>
      </section>
    </main>
  )
}
