import { useRef, useState } from 'react'
import { BrandLogo } from '../components/BrandLogo'
import { AsyncButton, FormError, FormField, useFormFeedback } from '../components/Shared'
import { useApp } from '../context/AppContext'
import { ThemeToggle } from '../components/ThemeToggle'
import { SunIcon } from '../components/BrandIcons'

export function Landing() {
  return <div className="public-page">
    <header className="public-header">
      <BrandLogo />
      <nav aria-label="Account navigation">
        <ThemeToggle />
        <a className="public-back" href="#/sign-in">Sign in</a>
      </nav>
    </header>
    <main id="main-content">
      <section className="public-hero" aria-labelledby="home-heading">
        <div>
          <p className="eyebrow">WALANGBROWNOUT APPLIANCES</p>
          <h1 id="home-heading">A brighter way to keep stock moving.</h1>
          <p>Bring your inventory, daily movements, and stock counts together in one connected workspace.</p>
          <div className="public-actions">
            <a className="button primary" href="#/sign-in">Sign in to your workspace →</a>
          </div>
          <p className="public-caption">Accounts are created by your administrator. Contact them for access.</p>
        </div>
        <aside className="public-visual" aria-label="Inventory workflow overview">
          <span className="public-orbit" aria-hidden="true"><SunIcon /></span>
          <p className="eyebrow">EVERY ITEM. EVERY MOVEMENT.</p>
          <h2>Clarity from arrival<br />to dispatch.</h2>
          <ol>
            <li><span>01</span><div><strong>Receive & organize</strong><p>Keep products and batches in view.</p></div></li>
            <li><span>02</span><div><strong>Track the movement</strong><p>Record stock entering and leaving.</p></div></li>
            <li><span>03</span><div><strong>Count with confidence</strong><p>Request and review stock corrections.</p></div></li>
          </ol>
        </aside>
      </section>
      <section className="public-features" aria-label="Workspace features">
        <article><span aria-hidden="true">◫</span><h2>Inventory visibility</h2><p>Find products, check stock levels, and monitor inventory alerts.</p></article>
        <article><span aria-hidden="true">⇄</span><h2>Connected workflows</h2><p>Manage stock movements and physical counts with clear records.</p></article>
        <article><span aria-hidden="true">✓</span><h2>Access for your role</h2><p>Your assigned role determines the tools available in your workspace.</p></article>
      </section>
    </main>
    <footer className="public-footer">WalangBrownout Appliances · Powered by Sunshine team</footer>
  </div>
}

export function SetPassword() {
  const { changePassword, logout } = useApp()
  const [details, setDetails] = useState({ current_password: '', password: '', password_confirmation: '' })
  const [submitting, setSubmitting] = useState(false)
  const [visible, setVisible] = useState(false)
  const pending = useRef(false)
  const feedback = useFormFeedback()
  const submit = async (event) => {
    event.preventDefault()
    if (pending.current) return
    feedback.setError('')
    if (details.password !== details.password_confirmation) { feedback.setError('The passwords do not match.'); return }
    pending.current = true
    setSubmitting(true)
    try {
      await changePassword(details)
      window.location.hash = '/dashboard'
    } catch (exception) { feedback.handleError(exception) }
    finally { pending.current = false; setSubmitting(false) }
  }
  return <main className="login-page">
    <section className="login-brand"><BrandLogo /><p className="eyebrow">YOUR ACCOUNT, YOUR PASSWORD</p><h1>Make your workspace access your own.</h1><p>Your administrator has assigned your role. Set a private password before continuing.</p></section>
    <section className="login-card" aria-labelledby="password-heading">
      <div className="auth-actions"><ThemeToggle /></div>
      <p className="eyebrow">WBA ACCESS</p><h2 id="password-heading">Set your own password</h2>
      <p>Replace the temporary password supplied by your administrator. Use at least 12 characters.</p>
      <form className="compact-form" onSubmit={submit}>
        {[['current_password', 'Temporary password'], ['password', 'New password'], ['password_confirmation', 'Confirm new password']].map(([name, label]) => <FormField key={name} name={name} feedback={feedback}>{label}<input type={visible ? 'text' : 'password'} value={details[name]} onChange={(event) => setDetails(current => ({ ...current, [name]: event.target.value }))} required minLength={name === 'current_password' ? undefined : 12} maxLength={255} autoComplete={name === 'current_password' ? 'current-password' : 'new-password'} disabled={submitting} /></FormField>)}
        <button className="inline-button" type="button" aria-pressed={visible} disabled={submitting} onClick={() => setVisible(value => !value)}>{visible ? 'Hide passwords' : 'Show passwords'}</button>
        <FormError>{feedback.error}</FormError><AsyncButton className="button primary" loading={submitting} loadingLabel="Saving password…">Save password and continue</AsyncButton>
      </form>
      <button className="inline-button" type="button" onClick={logout} disabled={submitting}>Sign out</button>
    </section>
  </main>
}
