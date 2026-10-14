import { getStockStatus } from '../utils/inventoryLogic'

const stockStatuses = ['In stock', 'Low stock', 'Near capacity']
const statusClass = status => status.toLowerCase().replaceAll(' ', '-')

export function StockHealthChart({ products }) {
  const total = products.length
  let offset = 0
  const segments = stockStatuses.map(status => {
    const count = products.filter(product => getStockStatus(product) === status).length
    const percent = total ? count / total * 100 : 0
    const segment = { status, count, percent, offset }
    offset += percent
    return segment
  })
  return <figure className="stock-health-chart" aria-label="Stock health distribution">
    <div className="stock-doughnut">
      <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle className="ring-track" cx="60" cy="60" r="46" />
        {segments.filter(segment => segment.count > 0).map(segment => <circle key={segment.status} className={`ring-segment ${statusClass(segment.status)}`} cx="60" cy="60" r="46" pathLength="100" strokeDasharray={`${segment.percent} ${100 - segment.percent}`} strokeDashoffset={-segment.offset} transform="rotate(-90 60 60)" />)}
      </svg>
      <div className="ring-label"><strong>{total}</strong><small>products</small></div>
    </div>
    <figcaption>
      {!total && <p className="muted">No products yet. Add a product to see stock health.</p>}
      <ul className="chart-legend">{segments.map(segment => <li key={segment.status}>
        <span className={`legend-dot ${statusClass(segment.status)}`} aria-hidden="true" />
        <span>{segment.status}</span><strong>{segment.count}<small>{Math.round(segment.percent)}%</small></strong>
      </li>)}</ul>
    </figcaption>
  </figure>
}

export function ShelfLifeRing({ value, number }) {
  const elapsed = Math.max(0, Math.min(100, value))
  return <div className="shelf-life-ring" role="meter" aria-label={`${number} shelf life elapsed`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(elapsed)} aria-valuetext={`${Math.round(elapsed)}% of shelf life elapsed`}>
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <circle className="ring-track" cx="60" cy="60" r="46" />
      <circle className="ring-segment" cx="60" cy="60" r="46" pathLength="100" strokeDasharray={`${elapsed} ${100 - elapsed}`} transform="rotate(-90 60 60)" />
    </svg>
    <span className="ring-label"><strong>{Math.round(elapsed)}%</strong><small>elapsed</small></span>
  </div>
}
