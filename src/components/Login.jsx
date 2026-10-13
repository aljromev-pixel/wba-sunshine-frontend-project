import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { FormField, useFormFeedback, AsyncButton, FormError } from './Shared'
import { ThemeToggle } from './ThemeToggle'
import { BrandLogo } from './BrandLogo'

export function Login({ portal = 'staff' }) {
  const { login, authError, canRetrySession, retrySession } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const feedback = useFormFeedback()
  const { error, setError, handleError } = feedback
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    if (submitting) return
    setError('')
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
          <FormField name="password" feedback={feedback}>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" disabled={submitting} /></FormField>
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
