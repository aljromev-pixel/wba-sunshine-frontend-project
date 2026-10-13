import { calculateReorder, daysUntil, getStockStatus, warehouseDate, usableStock, planningBaseline } from './inventoryLogic.js'

export function filterReportDates(data, from = '', to = '') {
  const matches = item => {
    if (!from && !to) return true
    if (!item.date) return false
    const day = item.date.includes('T') ? warehouseDate(item.date) : item.date
    return (!from || day >= from) && (!to || day <= to)
  }
  return { ...data, transactions: data.transactions.filter(matches), adjustments: data.adjustments.filter(matches) }
}

export function reportCsv(report) {
  const cell = value => {
    let text = String(value ?? '')
    if (typeof value === 'string' && /^\s*[=+\-@]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  return '\uFEFF' + [report.columns, ...report.rows.map(row => row.values)].map(row => row.map(cell).join(',')).join('\r\n')
}

export const REPORT_TYPES = [
  'Inventory Summary', 'Stock Movement Report', 'Low Stock Report',
  'Expiring Stock Report', 'Inventory Discrepancy Report', 'Cycle Count Report',
  'Adjustment Report', 'Seasonal Reorder Report',
]

// All rows derive from the last successful Laravel inventory response, never fixtures.
export function buildReport(type, data, { multiplier = 1, safetyPercent = 15 } = {}) {
  const products = new Map(data.products.map((product) => [String(product.id), product]))
  const productName = (id) => products.get(String(id))?.name ?? 'Product unavailable'
  const row = (record, values) => ({ id: record.id, values })
  const adjustmentRows = (items) => items.map((item) => row(item, [
    item.id, productName(item.productId), item.systemQty, item.requestedQty,
    item.requestedQty - item.systemQty, item.reason, item.status,
  ]))
  const adjustmentColumns = ['Request', 'Product', 'Recorded stock', 'Counted quantity', 'Variance', 'Reason', 'Status']

  switch (type) {
    case 'Inventory Summary':
      return {
        description: 'Current product stock and saved reorder points from the inventory snapshot.',
        columns: ['SKU', 'Product', 'Stock', 'Reorder point', 'Status'],
        rows: data.products.map((item) => row(item, [item.sku, item.name, item.stock, item.reorderPoint, getStockStatus(item)])),
      }
    case 'Stock Movement Report':
      return {
        description: 'All movement records in the inventory snapshot. Quantities are recorded units; direction is identified by movement type.',
        columns: ['Movement', 'Reference', 'Product', 'Type', 'Quantity', 'Recorded at', 'Status', 'Stock before', 'Stock after', 'From location', 'To location'],
        rows: data.transactions.map((item) => row(item, [item.id, item.reference, productName(item.productId), item.type, item.quantity, item.date, item.status, item.stockBefore ?? 'Not recorded', item.stockAfter ?? 'Not recorded', item.sourceLocation, item.destinationLocation])),
      }
    case 'Low Stock Report':
      return {
        description: 'Products whose usable stock is at or below their saved reorder point. Expired stock is excluded.',
        columns: ['SKU', 'Product', 'Usable stock', 'Reorder point', 'Shortfall'],
        rows: data.products.filter((item) => usableStock(item) <= item.reorderPoint)
          .map((item) => row(item, [item.sku, item.name, usableStock(item), item.reorderPoint, Math.max(0, item.reorderPoint - usableStock(item))])),
      }
    case 'Expiring Stock Report':
      return {
        description: 'Nonempty batches expiring today or within the next 30 local calendar days. Expired, depleted, and undated batches are excluded.',
        columns: ['Batch', 'Product', 'Quantity', 'Expiry date', 'Days remaining'],
        rows: data.batches.filter((item) => item.quantity > 0 && item.expiresAt && daysUntil(item.expiresAt) >= 0 && daysUntil(item.expiresAt) <= 30)
          .map((item) => row(item, [item.number, productName(item.productId), item.quantity, item.expiresAt, daysUntil(item.expiresAt)])),
      }
    case 'Inventory Discrepancy Report':
      return {
        description: 'Adjustment records with a nonzero variance, including reviewed records. Variance is counted quantity − stock recorded at submission, not current stock.',
        columns: adjustmentColumns,
        rows: adjustmentRows(data.adjustments.filter((item) => item.requestedQty !== item.systemQty)),
      }
    case 'Cycle Count Report':
      return {
        description: 'Adjustment records matching the saved “Cycle count: system N, counted N” reason convention. The API has no dedicated cycle-count source field.',
        columns: adjustmentColumns,
        rows: adjustmentRows(data.adjustments.filter((item) => /^Cycle count: system \d+, counted \d+$/.test(item.reason))),
      }
    case 'Adjustment Report':
      return { description: 'All pending, approved, and rejected adjustment records in the inventory snapshot.', columns: adjustmentColumns, rows: adjustmentRows(data.adjustments) }
    case 'Seasonal Reorder Report':
      return {
        description: `Planning calculation using saved monthly sales and lead time, demand multiplier ${multiplier}× and safety stock ${safetyPercent}%. Recommendations do not change saved reorder points or stock.`,
        columns: ['SKU', 'Product', 'Stock', 'Daily demand', 'Lead time (days)', 'Safety stock', 'Suggested reorder point', 'Shortfall'],
        rows: data.products.map((item) => {
          const result = calculateReorder({ monthlySales: planningBaseline(item).monthlySales, leadTime: item.leadTime, multiplier, safetyPercent })
          const target = Math.ceil(result.reorderPoint)
          return row(item, [item.sku, item.name, item.stock, result.dailyDemand.toFixed(1), item.leadTime, Math.ceil(result.safetyStock), target, Math.max(0, target - usableStock(item))])
        }),
      }
    default:
      throw new Error(`Unknown report: ${type}`)
  }
}
