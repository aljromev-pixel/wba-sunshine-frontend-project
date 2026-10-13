import { useState } from 'react'
import { FormField, useFormFeedback, AsyncButton, ConfirmDialog, EmptyState, FormError, StatusBadge, formatDate } from '../components/Shared'
import { useApp } from '../context/AppContext'
import { inventoryService } from '../services/inventoryService'
import { fifoBatch, getBatchStatus, today, usableStock } from '../utils/inventoryLogic'
import { PERMISSIONS } from '../utils/permissions'
import { HistoryMore } from '../components/HistoryMore'

const config = {
  'Stock In': {
    note: 'Record received goods into the single warehouse. Add a supplier reference for traceability.',
    action: 'Record stock in',
  },
  'Stock Out': {
    note: 'Use available stock only. The oldest valid FIFO batch is selected automatically when applicable.',
    action: 'Complete stock out',
  },
  Transfer: { note: 'Move a batch between storage locations. The warehouse total remains unchanged.', action: 'Record transfer' },
  Return: { note: 'Return accepted stock to inventory after verification.', action: 'Process return' },
}
export function MovementForm({ type }) {
  const { data, notify } = useApp()
  const [productId, setProductId] = useState('')
  const [batchId, setBatchId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reference, setReference] = useState('')
  const [destinationLocation, setDestinationLocation] = useState('')
  const [returnCondition, setReturnCondition] = useState('')
  const [location, setLocation] = useState('Main warehouse')
  const [batchNumber, setBatchNumber] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const feedback = useFormFeedback()
  const { error, setError, handleError } = feedback
  const [submitting, setSubmitting] = useState(false)
  const product = data.products.find((item) => item.id === productId)
  const batches = data.batches.filter((item) => item.productId === productId)
  const suggested = productId ? fifoBatch(data.batches, productId) : null
  const chooseProduct = (id) => {
    setProductId(id)
    const suggestion = fifoBatch(data.batches, id)
    setBatchId(type === 'Stock In' ? 'new' : suggestion?.id || '')
  }
  const submit = async (event) => {
    event.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      const transaction = await inventoryService.move({ type, productId, quantity, batchId, reference, destinationLocation, returnCondition, location, batchNumber, expiresAt })
      notify(`${type} recorded as ${transaction.id}.`)
      setProductId('')
      setBatchId('')
      setQuantity('')
      setReference('')
      setDestinationLocation('')
      setReturnCondition('')
      setBatchNumber('')
      setExpiresAt('')
    } catch (exception) {
      handleError(exception)
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <section className="page-stack workflow-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">WAREHOUSE WORKFLOW</p>
          <h2>{type} transaction</h2>
          <p>{config[type].note}</p>
        </div>
      </div>
      <form className="surface transaction-form" onSubmit={submit}>
        <div className="form-grid">
          <FormField name="productId" feedback={feedback}>
            Product
            <select disabled={submitting} value={productId} onChange={(event) => chooseProduct(event.target.value)} required>
              <option value="">Select a product</option>
              {data.products.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name} — {usableStock(item)} usable / {item.stock} on hand
                </option>
              ))}
            </select>
          </FormField>
          <FormField name="quantity" feedback={feedback}>
            Quantity
            <input disabled={submitting}
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
              placeholder="Enter quantity"
            />
          </FormField>
          <FormField name="batchId" feedback={feedback}>
            Batch
            {type === 'Stock In' ? (
              <select disabled={submitting} value={batchId} onChange={(event) => setBatchId(event.target.value)}>
                <option value="new">Create receiving batch</option>
                {batches.map((batch) => (
                  <option value={batch.id} key={batch.id} disabled={getBatchStatus(batch) === 'Expired'}>
                    {batch.number} · {batch.location || 'Main warehouse'} — {batch.quantity} available
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={batchId}
                onChange={(event) => setBatchId(event.target.value)}
                required
                disabled={submitting || !productId}
              >
                <option value="">Select a batch</option>
                {batches.map((batch) => (
                  <option value={batch.id} key={batch.id} disabled={getBatchStatus(batch) === 'Expired'}>
                    {batch.number} · {batch.location || 'Main warehouse'} — {getBatchStatus(batch)}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          {type === 'Transfer' && <FormField name="destinationLocation" feedback={feedback}>Destination location<input required disabled={submitting} value={destinationLocation} maxLength={100} onChange={event => setDestinationLocation(event.target.value)} placeholder="For example, Rack B" /></FormField>}
          {type === 'Return' && <FormField name="returnCondition" feedback={feedback}>Return condition<select required disabled={submitting} value={returnCondition} onChange={event => setReturnCondition(event.target.value)}><option value="">Verify condition</option><option value="Resaleable">Inspected and resaleable</option></select><small>Do not return damaged goods to usable stock. Record the inspection and original dispatch reference below.</small></FormField>}
          {type === 'Stock In' && batchId === 'new' && <>
            <FormField name="location" feedback={feedback}>Receiving location<input required disabled={submitting} value={location} maxLength={100} onChange={event => setLocation(event.target.value)} /></FormField>
            <FormField name="batchNumber" feedback={feedback}>Receiving batch number (optional)<input disabled={submitting} value={batchNumber} maxLength={255} onChange={event => setBatchNumber(event.target.value)} placeholder="Generated automatically if omitted" /></FormField>
            <FormField name="expiresAt" feedback={feedback}>{product?.demandPattern === 'Perishable-Rotating' ? 'Verified expiry date (required)' : 'Expiry date (optional)'}<input type="date" required={product?.demandPattern === 'Perishable-Rotating'} min={today()} disabled={submitting} value={expiresAt} onChange={event => setExpiresAt(event.target.value)} /></FormField>
          </>}
          <FormField name="reference" feedback={feedback}>
            Reference / reason
            <input disabled={submitting}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              required
              placeholder={type === 'Stock Out' ? 'Sales order or reference' : 'Enter reference'}
            />
          </FormField>
        </div>
        {product && (
          <div className="form-context">
            <span>
              Stock on hand:{' '}
              <strong>
                {product.stock} {product.unit}
              </strong>
            </span>
            {suggested && type !== 'Stock In' && (
              <span>
                FIFO suggestion: <strong>{suggested.number}</strong> · {suggested.quantity} available
              </span>
            )}
          </div>
        )}
        {error && (
          <FormError>{error}</FormError>
        )}
        <div className="form-actions">
          <AsyncButton type="submit" className="button primary" loading={submitting} loadingLabel="Saving…">{config[type].action}</AsyncButton>
        </div>
      </form>
    </section>
  )
}
const countBatches = (data, product) => {
  if (!product) return []
  const batches = data.batches.filter(batch => batch.productId === product.id)
  const unallocated = product.stock - batches.reduce((sum, batch) => sum + batch.quantity, 0)
  return unallocated > 0 || !batches.length ? [...batches, { id: '0', number: 'Unallocated opening stock', location: 'Main warehouse', quantity: Math.max(0, unallocated) }] : batches
}
const verifiedCounts = (batches, quantities, total) => batches.map(batch => ({ batchId: Number(batch.id), quantity: batches.length === 1 ? Number(total) : Number(quantities[batch.id] ?? (batch.quantity === 0 ? 0 : '')) }))
function BatchCountFields({ batches, quantities, setQuantities, disabled }) {
  return batches.length > 1 && <fieldset disabled={disabled} className="compact-form"><legend>Physical quantity in each batch and location</legend><div className="form-grid">{batches.map(batch => <label key={batch.id}>{batch.number} · {batch.location || 'Main warehouse'}<input type="number" min="0" step="1" required value={quantities[batch.id] ?? (batch.quantity === 0 ? '0' : '')} onChange={event => setQuantities(current => ({ ...current, [batch.id]: event.target.value }))} /></label>)}</div><p className="muted">Enter every physical count. Approval updates these batches and their product total together.</p></fieldset>
}
const countTotal = (batches, quantities) => batches.reduce((sum, batch) => sum + Number(quantities[batch.id] || 0), 0)

export function CycleCount() {
  const { data, notify } = useApp()
  const [productId, setProductId] = useState(data.products[0]?.id || '')
  const [counted, setCounted] = useState('')
  const [quantities, setQuantities] = useState({})
  const [submitted, setSubmitted] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const feedback = useFormFeedback()
  const { error, setError, handleError } = feedback
  const product = data.products.find((item) => item.id === productId) || data.products[0]
  const batches = countBatches(data, product)
  const total = batches.length > 1 ? countTotal(batches, quantities) : counted
  const variance = !product || total === '' ? null : Number(total) - product.stock
  const submit = async (event) => {
    event.preventDefault()
    if (submitting || !product || total === '' || !Number.isInteger(Number(total)) || Number(total) < 0) return
    setError('')
    setSubmitting(true)
    const reason = `Cycle count: system ${product.stock}, counted ${total}`
    try {
      const request = await inventoryService.submitAdjustment({ productId: product.id, requestedQty: total, reason, batchCounts: verifiedCounts(batches, quantities, total), expectedStockVersion: product.stockVersion })
      setSubmitted(request)
      setCounted('')
      setQuantities({})
      notify(`Cycle count submitted as ${request.id}; review is required.`)
    } catch (exception) {
      handleError(exception)
    } finally {
      setSubmitting(false)
    }
  }
  if (!product) return <section className="surface"><EmptyState title="No products to count" text="Add a product before submitting a cycle count." /></section>
  return (
    <section className="page-stack">
      <div className="page-intro">
        <div>
          <p className="eyebrow">VERIFICATION WORKFLOW</p>
          <h2>Cycle count</h2>
          <p>
            Compare a physical count with the system quantity. Variances are submitted as adjustment requests for
            review.
          </p>
        </div>
      </div>
      <form className="surface count-card" onSubmit={submit}>
        <FormField name="productId" feedback={feedback}>
          Product
          <select disabled={submitting}
            value={product.id}
            onChange={(event) => {
              setProductId(event.target.value)
                setCounted('')
                setQuantities({})
              setSubmitted(null)
            }}
          >
            {data.products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </FormField>
        <div className="count-comparison">
          <article>
            <small>System quantity</small>
            <strong>{product?.stock}</strong>
            <span>{product?.unit}</span>
          </article>
          <article>
            <FormField name="requestedQty" feedback={feedback}>Counted quantity
            <input disabled={submitting}
              type="number"
              min="0"
              readOnly={batches.length > 1}
              value={total}
              onChange={(event) => setCounted(event.target.value)}
              step="1"
              placeholder="Enter count"
              required
            />
            </FormField>
          </article>
          <article className={variance ? 'variance' : ''}>
            <small>Variance</small>
            <strong>{variance === null ? '—' : variance > 0 ? `+${variance}` : variance}</strong>
            <span>{variance === null ? 'Awaiting count' : variance === 0 ? 'Matched' : 'Requires review'}</span>
          </article>
        </div>
        <BatchCountFields batches={batches} quantities={quantities} setQuantities={setQuantities} disabled={submitting} />
        <div className="form-actions">
          <AsyncButton className="button primary" loading={submitting} loadingLabel="Submitting…">Submit count result</AsyncButton>
        </div>
        <FormError>{error}</FormError>
        {submitted && (
          <p className="success-note">
            Submitted {submitted.id}. The inventory quantity remains unchanged until an authorized reviewer approves it.
          </p>
        )}
      </form>
    </section>
  )
}
export function Adjustments() {
  const { data, user, can, notify } = useApp()
  const [productId, setProductId] = useState('')
  const [requestedQty, setRequestedQty] = useState('')
  const [quantities, setQuantities] = useState({})
  const [reason, setReason] = useState('')
  const feedback = useFormFeedback()
  const { error, setError, handleError } = feedback
  const [submitting, setSubmitting] = useState(false)
  const [reviewing, setReviewing] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const approve = can(PERMISSIONS.ADJUSTMENT_APPROVE)
  const request = can(PERMISSIONS.ADJUSTMENT_REQUEST)
  const product = data.products.find(item => item.id === productId)
  const batches = countBatches(data, product)
  const total = batches.length > 1 ? countTotal(batches, quantities) : requestedQty
  const submit = async (event) => {
    event.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      const item = await inventoryService.submitAdjustment({ productId, requestedQty: total, reason, batchCounts: verifiedCounts(batches, quantities, total), expectedStockVersion: product?.stockVersion })
      notify(`Adjustment request ${item.id} submitted.`)
      setProductId('')
      setRequestedQty('')
      setReason('')
      setQuantities({})
      setError('')
    } catch (exception) {
      handleError(exception)
    } finally {
      setSubmitting(false)
    }
  }
  const review = async (id, decision) => {
    setReviewing(id)
    try {
      await inventoryService.reviewAdjustment(id, decision)
      notify(`Adjustment request ${decision ? 'approved and applied' : 'rejected'}.`)
    } finally {
      setReviewing(null)
    }
  }
  return (
    <section className="page-stack">
      <div className="page-intro">
        <div>
          <p className="eyebrow">CONTROLLED CHANGES</p>
          <h2>Inventory adjustments</h2>
          <p>
            Staff submit requests; only authorized supervisors, purchasing managers, or administrators can approve an
            inventory change.
          </p>
        </div>
      </div>
      <div className="two-column adjustments-grid">
        {request && <form className="surface compact-form" onSubmit={submit}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">REQUEST</p>
              <h2>Submit adjustment</h2>
            </div>
          </div>
          <FormField name="productId" feedback={feedback}>
            Product
            <select disabled={submitting} value={productId} onChange={(event) => { setProductId(event.target.value); setRequestedQty(''); setQuantities({}) }} required>
              <option value="">Select a product</option>
              {data.products.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name} — system: {item.stock}
                </option>
              ))}
            </select>
          </FormField>
          <FormField name="requestedQty" feedback={feedback}>
            Verified quantity
            <input disabled={submitting}
              type="number"
              min="0"
              readOnly={batches.length > 1}
              value={total}
              onChange={(event) => setRequestedQty(event.target.value)}
              required
            />
          </FormField>
          <BatchCountFields batches={batches} quantities={quantities} setQuantities={setQuantities} disabled={submitting} />
          <FormField name="reason" feedback={feedback}>
            Reason
            <textarea disabled={submitting}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              placeholder="Describe the count variance, damage, or other reason"
            />
          </FormField>
          <FormError>{error}</FormError>
          <AsyncButton className="button primary" loading={submitting} loadingLabel="Submitting…">Submit for review</AsyncButton>
        </form>}
        <section className="surface">
          <div className="section-heading">
            <div>
              <p className="eyebrow">REVIEW QUEUE</p>
              <h2>{approve ? 'Approve or reject requests' : 'Request status'}</h2>
            </div>
          </div>
          <div className="compact-list">
            {data.adjustments.map((item) => {
              const product = data.products.find((entry) => entry.id === item.productId)
              return (
                <div key={item.id} className="adjustment-row">
                  <div>
                    <strong>
                      {item.id} · {product?.name}
                    </strong>
                    <small>
                      System {item.systemQty} → requested {item.requestedQty} · {item.requestedBy}
                    </small>
                    <small>{item.reason}</small>
                    {item.batchCounts?.map(count => { const batch = data.batches.find(entry => entry.id === String(count.batchId)); return <small key={count.batchId}>{batch?.number || count.batchId} · {batch?.location || 'Main warehouse'}: verified {count.quantity}</small> })}
                  </div>
                  <div>
                    {item.status === 'Pending' && approve && item.requestedById !== String(user?.id) ? (
                      <span className="review-actions">
                        <button disabled={reviewing === item.id} onClick={() => setConfirmation({ id: item.id, decision: true })}>Approve</button>
                        <button disabled={reviewing === item.id} onClick={() => setConfirmation({ id: item.id, decision: false })}>Reject</button>
                      </span>
                    ) : item.status === 'Pending' && approve ? (
                      <small>Another authorized user must review this request.</small>
                    ) : (
                      <StatusBadge>{item.status}</StatusBadge>
                    )}
                  </div>
                </div>
              )
            })}
            {!data.adjustments.length && <EmptyState title="No adjustment requests" />}
          </div>
          <HistoryMore section="adjustments" />
        </section>
      </div>
      {confirmation && <ConfirmDialog tone={confirmation.decision ? 'default' : 'danger'} title={`${confirmation.decision ? 'Approve' : 'Reject'} adjustment?`} message="This decision will be recorded in the audit trail." confirmLabel={confirmation.decision ? 'Approve' : 'Reject'} onCancel={() => setConfirmation(null)} onConfirm={() => review(confirmation.id, confirmation.decision)} />}
    </section>
  )
}
