import { roleLevelsForDepartment } from '../utils/permissions'
import { useEffect, useState } from 'react'
import { FormField, useFormFeedback, AsyncButton, ConfirmDialog, EmptyState, FormError, StatusBadge, formatDate } from '../components/Shared'
import { useApp } from '../context/AppContext'
import { userService } from '../services/userService'
import { apiErrorMessage } from '../utils/apiErrors'
import { calculateReorder } from '../utils/inventoryLogic'
import { buildReport, REPORT_TYPES } from '../utils/reports'

export function ReorderCalculator() {
  const { data } = useApp()
  const [productId, setProductId] = useState(data.products[0]?.id || '')
  const [monthly, setMonthly] = useState(String(data.products[0]?.monthlySales ?? 0))
  const [lead, setLead] = useState(String(data.products[0]?.leadTime ?? 0))
  const [safety, setSafety] = useState('15')
  const [multiplier, setMultiplier] = useState('1')
  const result = calculateReorder({
    monthlySales: monthly,
    leadTime: lead,
    safetyPercent: safety,
    multiplier,
  })
  const choose = (id) => {
    const p = data.products.find((x) => x.id === id)
    if (!p) return
    setProductId(id)
    setMonthly(String(p.monthlySales))
    setLead(String(p.leadTime))
    setSafety('15')
  }
  const p = data.products.find((x) => x.id === productId)
  if (!data.products.length) return <EmptyState title="No products to calculate" text="Add a product before calculating a reorder recommendation." />
  return (
    <section className="page-stack">
      <div className="page-intro">
        <div>
          <p className="eyebrow">PURCHASING PLANNING</p>
          <h2>Seasonal reorder calculator</h2>
          <p>Start with the selected product's saved sales and lead time. Adjust demand and safety assumptions for this calculation.</p>
        </div>
      </div>
      <div className="two-column calculator-grid">
        <section className="surface compact-form">
          <label>
            Product
            <select value={productId} onChange={(e) => choose(e.target.value)}>
              {data.products.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Average monthly sales
            <input type="number" min="0" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
          </label>
          <label>
            Lead time
            <input type="number" min="0" value={lead} onChange={(e) => setLead(e.target.value)} />
          </label>
          <label>
            Seasonal demand multiplier
            <input type="number" min="0" step="0.1" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} />
          </label>
          <label>
            Safety stock %
            <select value={safety} onChange={(e) => setSafety(e.target.value)}>
              <option value="15">Seasonal-critical — 15%</option>
              <option value="10">Stable — 10%</option>
            </select>
          </label>
        </section>
        <section className="surface formula-card">
          <p className="eyebrow">CALCULATED RECOMMENDATION</p>
          <h2>{p?.name}</h2>
          <div className="formula-results">
            <div>
              <small>Predicted daily demand</small>
              <strong>{result.dailyDemand.toFixed(1)}</strong>
              <span>monthly sales ÷ 30</span>
            </div>
            <div>
              <small>Safety stock</small>
              <strong>{Math.ceil(result.safetyStock)}</strong>
              <span>daily demand × lead time × {safety}%</span>
            </div>
            <div className="reorder-result">
              <small>Reorder point</small>
              <strong>{Math.ceil(result.reorderPoint)}</strong>
              <span>at {multiplier}x seasonal multiplier</span>
            </div>
          </div>
          <p className="formula-note">ROP = (daily demand × seasonal multiplier × lead time) + safety stock</p>
        </section>
      </div>
    </section>
  )
}
export function Reports() {
  const { data, retryInventory } = useApp()
  const [type, setType] = useState(REPORT_TYPES[0])
  const [multiplier, setMultiplier] = useState('1')
  const [safetyPercent, setSafetyPercent] = useState('15')
  const seasonal = type === 'Seasonal Reorder Report'
  const valid = !seasonal || (multiplier !== '' && safetyPercent !== '' && Number.isFinite(Number(multiplier)) && Number(multiplier) >= 0 && Number(multiplier) <= 100 && Number.isFinite(Number(safetyPercent)) && Number(safetyPercent) >= 0 && Number(safetyPercent) <= 100)
  const report = valid ? buildReport(type, data, { multiplier: Number(multiplier), safetyPercent: Number(safetyPercent) }) : null
  return <section className="page-stack">
    <div className="page-intro"><div>
      <p className="eyebrow">MANAGEMENT REPORTING</p>
      <h2>Inventory reports</h2>
      <p>Reports are calculated in your browser from the last successfully loaded Laravel inventory data.</p>
    </div></div>
    <section className="surface">
      <div className="filter-bar">
        <label>Report type<select value={type} onChange={(event) => setType(event.target.value)}>{REPORT_TYPES.map((name) => <option key={name}>{name}</option>)}</select></label>
        <button className="inline-button" onClick={retryInventory}>Refresh report data</button>
        <button className="button primary" disabled={!valid} onClick={() => window.print()}>Print report</button>
      </div>
      {seasonal && <div className="form-grid compact-form">
        <label>Demand multiplier<input type="number" min="0" max="100" step="0.1" value={multiplier} onChange={(event) => setMultiplier(event.target.value)} /></label>
        <label>Safety stock percent<input type="number" min="0" max="100" value={safetyPercent} onChange={(event) => setSafetyPercent(event.target.value)} /></label>
      </div>}
      <h3 className="report-title">{type}</h3>
      {!valid ? <FormError>Enter a demand multiplier and safety percentage between 0 and 100.</FormError> : <>
        <p>{report.description}</p>
        <div className="table-wrap"><table>
          <thead><tr>{report.columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
          <tbody>{report.rows.map((row) => <tr key={row.id}>{row.values.map((value, index) => <td key={report.columns[index]}>{report.columns[index] === 'Status' ? <StatusBadge>{value ?? '—'}</StatusBadge> : value ?? '—'}</td>)}</tr>)}</tbody>
        </table></div>
        {!report.rows.length && <EmptyState title="No data for this report" />}
      </>}
    </section>
  </section>
}

export function AuditTrail() {
  const { data } = useApp()
  const [search, setSearch] = useState('')
  const rows = data.audit.filter((a) =>
    `${a.user} ${a.action} ${a.reference} ${a.description}`.toLowerCase().includes(search.toLowerCase())
  )
  return (
    <section className="page-stack">
      <div className="page-intro">
        <div>
          <p className="eyebrow">ACCOUNTABILITY</p>
          <h2>Audit trail</h2>
          <p>Every important inventory workflow action is traceable by user, department, and role level.</p>
        </div>
      </div>
      <section className="surface">
        <div className="filter-bar">
          <label className="search-field">
            <span>⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user, reference, or action"
            />
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User / access</th>
                <th>Action</th>
                <th>Module</th>
                <th>Reference</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>{formatDate(a.timestamp, true)}</td>
                  <td>
                    <strong>{a.user}</strong>
                    <small>
                      {a.department} • {a.roleLevel}
                    </small>
                  </td>
                  <td>{a.action}</td>
                  <td>{a.module}</td>
                  <td>{a.reference}</td>
                  <td>{a.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <EmptyState title="No audit records found" />}
        </div>
      </section>
    </section>
  )
}
export function Users() {
  const { notify, user: currentUser } = useApp()
  const [users, setUsers] = useState([])
  const [form, setForm] = useState(null)
  const [changePassword, setChangePassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const feedback = useFormFeedback()
  const { error, setError, handleError } = feedback
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const protectedAdmin = (account) => account.department === 'Administration' && account.roleLevel === 'Manager' && String(account.id) !== String(currentUser.id)
  const openEditor = (account = null) => {
    if (account && protectedAdmin(account)) return
    setForm(account ? { ...account, isActive: account.isActive ?? true, name: account.firstName ?? account.name, lastName: account.lastName ?? '', password: '' } : { name: '', lastName: '', email: '', password: '', department: 'Warehouse', roleLevel: 'Staff', isActive: true })
    setChangePassword(!account)
    setShowPassword(false)
    setError('')
  }
  const load = async () => {
    setLoading(true)
    setLoadError('')
    try { setUsers(await userService.list()) } catch (exception) { setLoadError(apiErrorMessage(exception)) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  const save = async (event) => {
    event.preventDefault()
    if (submitting) return
    if (!roleLevelsForDepartment(form.department).includes(form.roleLevel)) { setError('Choose a supported role for this department.'); return }
    setError('')
    setSubmitting(true)
    try {
      const payload = { ...form }
      if (form.id && !changePassword) delete payload.password
      if (form.id) await userService.update(form.id, payload)
      else await userService.create(payload)
      notify(form.id ? 'User updated.' : 'User created. Share the temporary password privately; the employee must replace it before accessing inventory.')
      setForm(null); setError(''); await load()
    } catch (exception) { handleError(exception) } finally { setSubmitting(false) }
  }
  const remove = async (user) => {
    await userService.remove(user.id); notify('User deleted.'); await load()
  }
  return (
    <section className="page-stack">
      <div className="page-intro">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h2>User management</h2>
          <p>Create, edit, and remove persistent accounts with Department + Role Level assignment.</p>
        </div>
        <button className="button primary" disabled={submitting} onClick={() => openEditor()}>Add user</button>
      </div>
      {form && <form className="surface compact-form" onSubmit={save}>
        <div className="section-heading"><div><p className="eyebrow">{form.id ? 'EDIT' : 'CREATE'}</p><h2>{form.id ? 'Edit user' : 'Add user'}</h2></div><button type="button" className="inline-button" onClick={() => { setForm(null); setError('') }} disabled={submitting}>Cancel</button></div>
        <div className="form-grid">
          <FormField name="isActive" feedback={feedback}>Account access<select value={String(form.isActive)} onChange={(event) => setForm(current => ({ ...current, isActive: event.target.value === 'true' }))} disabled={submitting || String(form.id) === String(currentUser.id)}><option value="true">Active</option><option value="false">Disabled</option></select></FormField>
          <FormField name="name" feedback={feedback}>First name<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required maxLength={255} disabled={submitting} autoComplete="given-name" /></FormField>
          <FormField name="lastName" feedback={feedback}>Last name<input value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} required={!form.id} maxLength={255} disabled={submitting} autoComplete="family-name" /></FormField>
          <FormField name="email" feedback={feedback}>Email<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required disabled={submitting} /></FormField>
          <FormField name="department" feedback={feedback}>Department<select value={form.department} onChange={(event) => { const department = event.target.value; setForm((current) => ({ ...current, department, roleLevel: roleLevelsForDepartment(department).includes(current.roleLevel) ? current.roleLevel : roleLevelsForDepartment(department)[0] })) }} disabled={submitting}>{['Warehouse', 'Sales', 'Purchasing', 'Administration'].map((value) => <option key={value}>{value}</option>)}</select></FormField>
          <FormField name="roleLevel" feedback={feedback}>Role level<select value={roleLevelsForDepartment(form.department).includes(form.roleLevel) ? form.roleLevel : ''} required onChange={(event) => setForm((current) => ({ ...current, roleLevel: event.target.value }))} disabled={submitting}><option value="" disabled>Choose a supported role</option>{roleLevelsForDepartment(form.department).map((value) => <option key={value}>{value}</option>)}</select></FormField>
        </div>
        {form.id && !changePassword && <div><button type="button" className="button" disabled={submitting} onClick={() => setChangePassword(true)}>Change password</button></div>}
        {changePassword && <section aria-label="Password settings">
          <FormField name="password" feedback={feedback}>{form.id ? 'New password' : 'Temporary password'}<input type={showPassword ? 'text' : 'password'} minLength={8} maxLength={255} value={form.password || ''} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required disabled={submitting} autoComplete="new-password" /></FormField>
          <div className="form-actions">
            <button type="button" className="inline-button" aria-pressed={showPassword} disabled={submitting} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? 'Hide password' : 'Show password'}</button>
            {form.id && <button type="button" className="inline-button" disabled={submitting} onClick={() => { setChangePassword(false); setShowPassword(false); setForm((current) => ({ ...current, password: '' })); setError('') }}>Cancel password change</button>}
          </div>
          <p className="muted">{String(form.id) === String(currentUser.id) ? 'Enter a new password with at least 8 characters. Your other sessions will be revoked.' : 'Enter a temporary password with at least 8 characters and share it privately. The employee must replace it before accessing inventory; previous sessions are revoked.'}</p>
        </section>}
        <FormError>{error}</FormError>
        <AsyncButton className="button primary" loading={submitting} loadingLabel="Saving…">{form.id ? 'Save user' : 'Create user'}</AsyncButton>
      </form>}
      <section className="surface">
        {loading && <p role="status">Loading users…</p>}
        <FormError>{loadError}</FormError>
        {loadError && <AsyncButton type="button" className="button primary" loading={loading} loadingLabel="Retrying…" onClick={load}>Retry loading users</AsyncButton>}
        <div className="table-wrap" aria-busy={loading}>
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Department</th>
                <th>Role level</th><th>Account access</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                  </td>
                  <td>{u.department}</td>
                  <td>{u.roleLevel}</td><td>{u.isActive === false ? 'Disabled' : u.mustChangePassword ? 'Password setup required' : 'Active'}</td>
                  <td>
                    {protectedAdmin(u) ? <span className="muted">Protected administrator</span> : <>
                      <button className="inline-button" disabled={submitting} onClick={() => openEditor(u)}>Edit</button>
                      <button className="inline-button" disabled={submitting || String(u.id) === String(currentUser.id)} onClick={() => setConfirmation(u)}>Delete</button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !loadError && !users.length && <EmptyState title="No users found" />}
        </div>
      </section>
      {confirmation && <ConfirmDialog tone="danger" title="Delete user?" message={`Delete ${confirmation.name}? This cannot be undone.`} confirmLabel="Delete user" onCancel={() => setConfirmation(null)} onConfirm={() => remove(confirmation)} />}
    </section>
  )
}
