import { useApp } from '../context/AppContext'
import { getBatchStatus, getStockStatus, usableStock, movementChange } from '../utils/inventoryLogic'
import { formatDate, StatusBadge } from '../components/Shared'
import { StockHealthChart } from '../components/InventoryCharts'
import { PERMISSIONS } from '../utils/permissions'

export function Dashboard() {
  const { user, data, can } = useApp()
  const low = data.products.filter((item) => getStockStatus(item) === 'Low stock')
  const expiring = data.batches.filter((batch) => ['Expired', 'Expiring soon'].includes(getBatchStatus(batch)))
  const health = data.products.filter((item) => ['Low stock', 'Near capacity'].includes(getStockStatus(item)))
  const content =
    user.department === 'Purchasing'
      ? {
          label: 'WBA purchasing overview',
          title: 'Supply decisions, made clearer.',
          description: 'Review reorder exposure, supplier lead times, and seasonal demand before inventory runs short.',
        }
      : user.department === 'Sales'
        ? {
          label: 'WBA stock availability',
            title: 'Reliable answers for every customer.',
            description: 'Check available inventory and recent outbound activity before committing stock.',
          }
        : user.department === 'Administration'
          ? {
              label: 'WBA inventory overview',
              title: 'A complete view of inventory control.',
              description: 'Monitor stock health, workflows, and traceable activity across the warehouse.',
            }
          : {
              label: 'WBA warehouse overview',
              title: 'Keep every movement accountable.',
              description: 'Monitor stock health, batches, and discrepancies from one operational view.',
            }
  return (
    <section className="page-stack">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">{content.label}</p>
          <h2>{content.title}</h2>
          <p>{content.description}</p>
        </div>
        <div className="hero-meta">
          <span>{new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          <strong>
            {user.department} • {user.roleLevel}
          </strong>
        </div>
      </div>
      <div className="metric-grid">
        <article>
          <small>Total products</small>
          <strong>{data.products.length}</strong>
          <span>Active appliance lines</span>
        </article>
        <article>
          <small>Usable stock</small>
          <strong>{data.products.reduce((sum, item) => sum + usableStock(item), 0)}</strong>
          <span>{data.products.reduce((sum, item) => sum + item.stock, 0)} total on hand; expired stock excluded from usable</span>
        </article>
        <article className={low.length ? 'attention' : ''}>
          <small>Low stock items</small>
          <strong>{low.length}</strong>
          <span>Require replenishment review</span>
        </article>
        <article className={expiring.length ? 'attention' : ''}>
          <small>Expiring batches</small>
          <strong>{expiring.length}</strong>
          <span>Filters requiring FIFO review</span>
        </article>
      </div>
      <section className="surface"><h2>Stock health distribution</h2><StockHealthChart products={data.products} /><p className="muted">Low-stock status uses usable quantities. Capacity uses total physical stock.</p></section>
      <div className="two-column">
        <section className="surface">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ACTIVITY</p>
              <h2>Recent movements</h2>
            </div>
            {can(PERMISSIONS.AUDIT_VIEW) && <a href="#/audit-trail">View audit trail</a>}
          </div>
          <div className="activity-list">
            {data.transactions.slice(0, 4).map((item) => (
              <div key={item.id}>
                <span className="movement-icon">
                  {item.type === 'Stock In' ? '↓' : item.type === 'Stock Out' ? '↑' : '⇄'}
                </span>
                <div>
                  <strong>
                    {item.type} · {data.products.find((product) => product.id === item.productId)?.name}
                  </strong>
                  <small>
                    {item.id} · {formatDate(item.date, true)}
                  </small>
                </div>
                <b data-direction={movementChange(item).startsWith('+') ? 'increase' : /^[−-]/.test(movementChange(item)) ? 'decrease' : 'neutral'}>
                  {movementChange(item)}
                </b>
              </div>
            ))}
          </div>
        </section>
        <section className="surface">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ATTENTION</p>
              <h2>Stock health</h2>
            </div>
            <a href="#/alerts">All alerts</a>
          </div>
          <div className="health-list">
            {health
              .slice(0, 4)
              .map((item) => (
                <div key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {usableStock(item)} usable · {item.stock} on hand · ROP {item.reorderPoint}
                    </small>
                  </div>
                  <StatusBadge>{getStockStatus(item)}</StatusBadge>
                </div>
              ))}
            {!health.length && <p className="muted">Stock levels are within target ranges.</p>}
          </div>
        </section>
      </div>
    </section>
  )
}
