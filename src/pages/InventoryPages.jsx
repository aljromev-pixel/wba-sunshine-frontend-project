import { useEffect, useMemo, useState } from 'react'
import { FormField, useFormFeedback, AsyncButton, ConfirmDialog, EmptyState, FormError, StatusBadge, formatDate } from '../components/Shared'
import { useApp } from '../context/AppContext'
import { inventoryService } from '../services/inventoryService'
import { daysUntil, fifoBatch, getBatchStatus, getStockStatus, today, usableStock } from '../utils/inventoryLogic'
import { PERMISSIONS } from '../utils/permissions'
import { apiErrorMessage } from '../utils/apiErrors'
import { ProductPlanningFields } from '../components/ProductPlanningFields'

const categories = ['All categories', 'Air Conditioners', 'Smart Home', 'Air Quality', 'Replacement Filters']
const emptyProduct = { sku: '', name: '', category: '', stock: 0, reorderPoint: 0, capacity: '', supplier: '', leadTime: 0, unit: 'units', monthlySales: 0, demandPattern: 'Stable-Demand', monthlySalesHistory: [], seasonalProfile: [] }

function ProductForm({ initial, onClose, onSaved, notify, onBusyChange }) {
  const [form, setForm] = useState(initial ? { ...emptyProduct, ...initial, capacity: initial.capacity ?? '', supplier: initial.supplier ?? '' } : emptyProduct)
  const feedback = useFormFeedback()
  const { error, setError, handleError } = feedback
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    onBusyChange(true)
    try {
      const payload = { ...form, stock: Number(form.stock), reorderPoint: Number(form.reorderPoint), capacity: form.capacity === '' ? null : Number(form.capacity), leadTime: Number(form.leadTime), monthlySales: Number(form.monthlySales) }
      payload.monthlySalesHistory = form.monthlySalesHistory.map(row => ({ month: row.month, quantity: Number(row.quantity) }))
      payload.seasonalProfile = form.seasonalProfile.map(row => ({ month: Number(row.month), multiplier: Number(row.multiplier) }))
      if (initial) delete payload.stock
      if (initial) await inventoryService.updateProduct(initial.id, payload)
      else await inventoryService.createProduct(payload)
      notify(`Product ${initial ? 'updated' : 'created'}.`)
      onSaved()
    } catch (exception) {
      handleError(exception)
    } finally {
      setSubmitting(false)
      onBusyChange(false)
    }
  }
  return <form className="surface compact-form" onSubmit={submit}>
    <div className="section-heading"><div><p className="eyebrow">{initial ? 'EDIT' : 'CREATE'}</p><h2>{initial ? 'Edit product' : 'Add product'}</h2></div><button type="button" className="inline-button" onClick={onClose} disabled={submitting}>Cancel</button></div>
    <div className="form-grid">{[['sku', 'SKU'], ['name', 'Name'], ['category', 'Category'], ['supplier', 'Supplier'], ['unit', 'Unit'], ['stock', initial ? 'Current stock (read only)' : 'Starting stock', 'number'], ['reorderPoint', 'Reorder point', 'number'], ['capacity', 'Capacity', 'number'], ['leadTime', 'Lead time (days)', 'number'], ['monthlySales', 'Monthly sales', 'number']].map(([name, label, type = 'text']) => <FormField key={name} name={name} feedback={feedback}>{label}<input disabled={submitting} readOnly={Boolean(initial && name === 'stock')} name={name} type={type} min={type === 'number' ? '0' : undefined} value={form[name]} onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))} required={name !== 'capacity' && name !== 'supplier'} /></FormField>)}</div>
    <ProductPlanningFields form={form} setForm={setForm} feedback={feedback} disabled={submitting} />
    {initial && <p className="muted">Use stock movements or an approved batch count to change stock. Editing product details does not change quantities.</p>}
    <FormError>{error}</FormError><AsyncButton className="button primary" loading={submitting} loadingLabel="Saving…">{initial ? 'Save product' : 'Create product'}</AsyncButton>
  </form>
}
export function InventoryList() {
  const { data, can, notify } = useApp()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All categories')
  const [status, setStatus] = useState('All status')
  const [sort, setSort] = useState('name')
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmation, setConfirmation] = useState(null)
  const manage = can(PERMISSIONS.INVENTORY_EDIT)
  const remove = async (item) => {
    await inventoryService.deleteProduct(item.id)
    notify('Product deleted.')
  }
  const items = useMemo(
    () =>
      data.products
        .filter(
          (item) =>
            (category === 'All categories' || item.category === category) &&
            (status === 'All status' || getStockStatus(item) === status) &&
            `${item.name} ${item.sku} ${item.supplier}`.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) =>
          sort === 'stock'
            ? a.stock - b.stock
            : sort === 'status'
              ? getStockStatus(a).localeCompare(getStockStatus(b))
              : a.name.localeCompare(b.name)
        ),
    [data.products, search, category, status, sort]
  )
  return (
    <section className="page-stack">
      <div className="page-intro">
        <div>
          <p className="eyebrow">PRODUCT CATALOGUE</p>
          <h2>Inventory at a glance</h2>
          <p>Search appliance lines, review supplier details, and open a complete batch history.</p>
        </div>
        <div className="form-actions"><span className="record-count">{items.length} products</span>{manage && <button className="button primary" disabled={saving} onClick={() => { setCreating(true); setEditing(null) }}>Add product</button>}</div>
      </div>
      {(creating || editing) && <ProductForm key={editing?.id || 'new'} onBusyChange={setSaving} initial={editing} notify={notify} onClose={() => { setCreating(false); setEditing(null) }} onSaved={() => { setCreating(false); setEditing(null) }} />}
      {data.products.some(product => product.batchStock !== null && product.batchStock !== undefined && product.stock !== product.batchStock) && <p className="form-error" role="alert">Some product totals differ from batch allocations. Complete a verified batch count and adjustment review before recording further movements for those products.</p>}
      <section className="surface">
        <div className="filter-bar">
          <label className="search-field">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search SKU, product, or supplier"
              aria-label="Search products"
            />
          </label>
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter category">
            {categories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter stock status">
            <option>All status</option>
            <option>In stock</option>
            <option>Low stock</option>
            <option>Near capacity</option>
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products">
            <option value="name">Sort: Name</option>
            <option value="stock">Sort: Stock</option>
            <option value="status">Sort: Status</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Current stock</th>
                <th>Reorder point</th>
                <th>Supplier / lead time</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    <small>{item.sku}</small>
                  </td>
                  <td>{item.category}<small>{item.demandPattern || 'Stable-Demand'}</small></td>
                  <td>
                    <strong>{item.stock}</strong> {item.unit}<small>{usableStock(item)} usable</small>
                  </td>
                  <td>
                    {item.reorderPoint} {item.unit}
                  </td>
                  <td>
                    {item.supplier}
                    <small>{item.leadTime} day lead time</small>
                  </td>
                  <td>
                    <StatusBadge>{getStockStatus(item)}</StatusBadge>
                  </td>
                  <td>
                    <a className="row-link" href={`#/inventory/${item.id}`}>
                      Details →
                    </a>
                    {manage && <><button className="inline-button" disabled={saving} onClick={() => { setEditing(item); setCreating(false) }}>Edit</button><button className="inline-button" disabled={saving} onClick={() => setConfirmation(item)}>Delete</button></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && (
            <EmptyState title="No products found" text="Try clearing a filter or using a different search term." />
          )}
        </div>
      </section>
      {confirmation && <ConfirmDialog tone="danger" title="Delete product?" message={`Move ${confirmation.name} to Trash? Eligible records can be restored. Products with stock, batches or inventory history cannot be deleted.`} confirmLabel="Delete product" onCancel={() => setConfirmation(null)} onConfirm={() => remove(confirmation)} />}
    </section>
  )
}
export function ProductDetails({ productId }) {
  const { data } = useApp()
  const [activity, setActivity] = useState(null)
  const [activityError, setActivityError] = useState('')
  const [activityAttempt, setActivityAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setActivity(null); setActivityError('')
    if (data.history?.transactions) inventoryService.productHistory(productId).then(records => { if (active) setActivity(records) }).catch(error => { if (active) setActivityError(apiErrorMessage(error)) })
    return () => { active = false }
  }, [productId, data.loadedAt, activityAttempt])
  const product = data.products.find((item) => item.id === productId)
  if (!product)
    return (
      <section className="surface">
        <EmptyState title="Product not found" text="The requested inventory record is unavailable." />
      </section>
    )
  const batches = data.batches.filter((item) => item.productId === product.id)
  const movements = activity || data.transactions.filter((item) => item.productId === product.id)
  const fifo = fifoBatch(data.batches, product.id)
  return (
    <section className="page-stack">
      <a className="back-link" href="#/inventory">
        ← Back to inventory
      </a>
      <div className="detail-hero">
        <div>
          <p className="eyebrow">{product.category}</p>
          <h2>{product.name}</h2>
          <p>
            {product.sku} · {product.supplier} · {product.leadTime} day lead time
          </p>
        </div>
        <StatusBadge>{getStockStatus(product)}</StatusBadge>
      </div>
      <div className="metric-grid product-metrics">
        <article>
          <small>Current stock</small>
          <strong>{product.stock}</strong>
          <span>{product.unit} on hand · {usableStock(product)} usable</span>
        </article>
        <article>
          <small>Reorder point</small>
          <strong>{product.reorderPoint}</strong>
          <span>{product.unit} minimum target</span>
        </article>
        <article>
          <small>Storage capacity</small>
          <strong>{product.capacity}</strong>
          <span>{product.capacity > 0 ? `${Math.round((product.stock / product.capacity) * 100)}% utilized` : 'Capacity not set'}</span>
        </article>
        <article>
          <small>Average monthly sales</small>
          <strong>{product.monthlySales}</strong>
          <span>Recent baseline</span>
        </article>
      </div>
      {fifo && (
        <section className="fifo-callout">
          <span>⇢</span>
          <div>
            <p className="eyebrow">SUGGESTED FIFO BATCH</p>
            <strong>{fifo.number}</strong>
            <p>
              {fifo.quantity} available ·{' '}
              {fifo.expiresAt ? `Expires ${formatDate(fifo.expiresAt)}` : `Received ${formatDate(fifo.receivedAt)}`}
            </p>
          </div>
          <a href="#/stock-out" className="button primary">
            Start stock out
          </a>
        </section>
      )}
      <div className="two-column">
        <section className="surface">
          <div className="section-heading">
            <div>
              <p className="eyebrow">BATCHES</p>
              <h2>On-hand batches</h2>
            </div>
            <a href="#/batches">Manage batches</a>
          </div>
          {batches.length ? (
            <div className="compact-list">
              {batches.map((batch) => (
                <div key={batch.id}>
                  <div>
                    <strong>{batch.number}</strong>
                    <small>
                      {batch.location || 'Main warehouse'} · Received {formatDate(batch.receivedAt)}{' '}
                      {batch.expiresAt && `· Expires ${formatDate(batch.expiresAt)}`}
                    </small>
                  </div>
                  <div>
                    <b>{batch.quantity}</b>
                    <StatusBadge>{getBatchStatus(batch)}</StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No batch records" />
          )}
        </section>
        <section className="surface">
          <div className="section-heading">
            <div>
              <p className="eyebrow">MOVEMENTS</p>
              <h2>Recent activity</h2>
            </div>
          </div>
          {data.history?.transactions && activity === null && !activityError && <p role="status">Loading product activity…</p>}
          {activityError && <div><FormError>{activityError}</FormError><button className="inline-button" onClick={() => setActivityAttempt(value => value + 1)}>Retry product activity</button></div>}
          {movements.length ? (
            <div className="compact-list">
              {movements.slice(0, 5).map((movement) => (
                <div key={movement.id}>
                  <div>
                    <strong>
                      {movement.type} · {movement.quantity} {product.unit}
                    </strong>
                    <small>
                      {movement.id} · {formatDate(movement.date, true)}
                    </small>
                    <small>Stock {movement.stockBefore ?? 'not recorded'} → {movement.stockAfter ?? 'not recorded'} · {movement.sourceLocation || '—'} → {movement.destinationLocation || '—'}</small>
                  </div>
                  <StatusBadge>{movement.status}</StatusBadge>
                </div>
              ))}
            </div>
          ) : (
            (!data.history?.transactions || activity !== null) && !activityError && <EmptyState title="No movements yet" />
          )}
        </section>
      </div>
    </section>
  )
}
function BatchForm({ initial, products, onClose, onSaved, notify, onBusyChange }) {
  const [form, setForm] = useState(initial || { productId: products[0]?.id || '', number: '', quantity: 0, receivedAt: today(), expiresAt: '', location: 'Main warehouse' })
  const feedback = useFormFeedback()
  const { error, setError, handleError } = feedback
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    onBusyChange(true)
    try {
      const payload = { ...form, productId: String(form.productId), quantity: Number(form.quantity), expiresAt: form.expiresAt || null }
      if (initial) await inventoryService.updateBatch(initial.id, payload)
      else await inventoryService.createBatch(payload)
      notify(`Batch ${initial ? 'updated' : 'created'}.`)
      onSaved()
    } catch (exception) {
      handleError(exception)
    } finally {
      setSubmitting(false)
      onBusyChange(false)
    }
  }
  return <form className="surface compact-form" onSubmit={submit}>
    <div className="section-heading"><div><p className="eyebrow">{initial ? 'EDIT' : 'CREATE'}</p><h2>{initial ? 'Edit batch' : 'Add batch'}</h2></div><button type="button" className="inline-button" onClick={onClose} disabled={submitting}>Cancel</button></div>
    <div className="form-grid">{!initial && <FormField name="productId" feedback={feedback}>Product<select disabled={submitting} value={form.productId} onChange={(event) => setForm((current) => ({ ...current, productId: event.target.value }))}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></FormField>}<FormField name="number" feedback={feedback}>Batch number<input disabled={submitting} value={form.number} onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))} required /></FormField>{!initial && <FormField name="quantity" feedback={feedback}>Quantity<input disabled={submitting} type="number" min="0" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} required /></FormField>}<FormField name="receivedAt" feedback={feedback}>Received<input disabled={submitting} type="date" value={form.receivedAt} onChange={(event) => setForm((current) => ({ ...current, receivedAt: event.target.value }))} required /></FormField><FormField name="expiresAt" feedback={feedback}>Expiry<input disabled={submitting} type="date" value={form.expiresAt || ''} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} /></FormField></div>
    <FormField name="location" feedback={feedback}>Storage location<input required disabled={submitting} readOnly={Boolean(initial)} value={form.location || 'Main warehouse'} maxLength={100} onChange={event => setForm(current => ({ ...current, location: event.target.value }))} /></FormField>
    {initial && <p className="muted">Use Transfer to move quantities to another location.</p>}
    <FormError>{error}</FormError><AsyncButton className="button primary" loading={submitting} loadingLabel="Saving…">{initial ? 'Save batch' : 'Create batch'}</AsyncButton>
  </form>
}
export function Batches() {
  const { data, can, notify } = useApp()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All batches')
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmation, setConfirmation] = useState(null)
  const manage = can(PERMISSIONS.INVENTORY_EDIT)
  const remove = async (batch) => {
    await inventoryService.deleteBatch(batch.id); notify('Batch deleted.')
  }
  const rows = data.batches.filter((batch) => {
    const product = data.products.find((item) => item.id === batch.productId)
    return (
      (filter === 'All batches' || getBatchStatus(batch) === filter) &&
      `${batch.number} ${product?.name}`.toLowerCase().includes(search.toLowerCase())
    )
  })
  return (
    <section className="page-stack">
      <div className="page-intro">
        <div>
          <p className="eyebrow">BATCH CONTROL</p>
          <h2>FIFO and expiry management</h2>
          <p>Use the oldest valid stock first. Expired batches are automatically excluded from FIFO recommendations.</p>
        </div>
        {manage && <button className="button primary" disabled={saving} onClick={() => { setCreating(true); setEditing(null) }}>Add batch</button>}
      </div>
      {(creating || editing) && <BatchForm key={editing?.id || 'new'} onBusyChange={setSaving} initial={editing} products={data.products} notify={notify} onClose={() => { setCreating(false); setEditing(null) }} onSaved={() => { setCreating(false); setEditing(null) }} />}
      <section className="surface">
        <div className="filter-bar">
          <label className="search-field">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search batch or product"
            />
          </label>
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option>All batches</option>
            <option>Available</option>
            <option>Expiring soon</option>
            <option>Expired</option>
            <option>Depleted</option>
          </select>
        </div>
        <div className="batch-timeline" aria-label="Batch expiry timeline">{rows.map(batch => {
          const lifetime = batch.expiresAt ? (Date.parse(batch.expiresAt) - Date.parse(batch.receivedAt)) / 86400000 : 0
          const used = lifetime > 0 ? Math.max(0, Math.min(100, (1 - daysUntil(batch.expiresAt) / lifetime) * 100)) : 0
          return <article key={batch.id}><strong>{batch.number}</strong><small>{data.products.find(product => product.id === batch.productId)?.name} · {batch.location || 'Main warehouse'}</small><StatusBadge>{getBatchStatus(batch)}</StatusBadge>{batch.expiresAt ? <><progress aria-label={`${batch.number} shelf life elapsed`} value={used} max="100" /><small>Received {formatDate(batch.receivedAt)} → expires {formatDate(batch.expiresAt)} · {daysUntil(batch.expiresAt)} days remaining</small></> : <small>Received {formatDate(batch.receivedAt)} · no expiry recorded</small>}</article>
        })}</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Batch</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Received</th>
                <th>Expiration</th>
                <th>Status</th>
                {manage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((batch) => {
                const product = data.products.find((item) => item.id === batch.productId)
                return (
                  <tr key={batch.id}>
                    <td>
                      <strong>{batch.number}</strong>
                      <small>{batch.location || 'Main warehouse'}</small>
                    </td>
                    <td>
                      {product?.name}
                      <small>{product?.sku}</small>
                    </td>
                    <td>
                      {batch.quantity} {product?.unit}
                    </td>
                    <td>{formatDate(batch.receivedAt)}</td>
                    <td>
                      {batch.expiresAt ? (
                        <>
                          {formatDate(batch.expiresAt)}
                          <small>{daysUntil(batch.expiresAt)} days</small>
                        </>
                      ) : (
                        'Not applicable'
                      )}
                    </td>
                    <td>
                      <StatusBadge>{getBatchStatus(batch)}</StatusBadge>
                    </td>
                    {manage && <td><button className="inline-button" disabled={saving} onClick={() => { setEditing(batch); setCreating(false) }}>Edit</button><button className="inline-button" disabled={saving} onClick={() => setConfirmation(batch)}>Delete</button></td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!rows.length && <EmptyState title="No matching batches" />}
        </div>
      </section>
      {confirmation && <ConfirmDialog tone="danger" title="Delete batch?" message={`Move ${confirmation.number} to Trash? It can be restored. Only empty batches without movement history can be deleted.`} confirmLabel="Delete batch" onCancel={() => setConfirmation(null)} onConfirm={() => remove(confirmation)} />}
    </section>
  )
}
