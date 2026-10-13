import { useMemo, useState } from 'react'
import { EmptyState, StatusBadge, formatDate } from '../components/Shared'
import { useApp } from '../context/AppContext'

export function AlertPage() {
  const { alerts } = useApp()
  const [search, setSearch] = useState('')
  const [type, setType] = useState('All alerts')
  const rows = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          (type === 'All alerts' || alert.type === type) &&
          `${alert.product} ${alert.detail}`.toLowerCase().includes(search.toLowerCase())
      ),
    [alerts, search, type]
  )
  const destination = (alert) =>
    alert.type === 'Inventory Discrepancy'
      ? '#/adjustments'
      : alert.type.includes('Expir') || alert.type.includes('Capacity')
        ? '#/batches'
        : '#/inventory'
  return (
    <section className="page-stack">
      <div className="page-intro">
        <div>
          <p className="eyebrow">IN-APP MONITORING</p>
          <h2>Inventory alerts</h2>
          <p>Review low stock, expiry, capacity, and discrepancy signals without external notifications.</p>
        </div>
        <span className="record-count">{rows.length} active alerts</span>
      </div>
      <section className="surface">
        <div className="filter-bar">
          <label className="search-field">
            <span>⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search alerts" />
          </label>
          <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Filter alert type">
            <option>All alerts</option>
            <option>Low Stock</option>
            <option>Expiring Stock</option>
            <option>Expired Stock</option>
            <option>Capacity Threshold</option>
            <option>Inventory Discrepancy</option>
          </select>
        </div>
        <div className="alert-list">
          {rows.map((alert) => (
            <article key={alert.id}>
              <StatusBadge>{alert.severity}</StatusBadge>
              <div>
                <strong>
                  {alert.type} · {alert.product}
                </strong>
                <p>{alert.detail}</p>
                <small>Generated {formatDate(alert.date)}</small>
              </div>
              <a href={destination(alert)}>Review →</a>
            </article>
          ))}
          {!rows.length && (
            <EmptyState title="No alerts match this view" text="Your selected inventory signals are clear." />
          )}
        </div>
      </section>
    </section>
  )
}
