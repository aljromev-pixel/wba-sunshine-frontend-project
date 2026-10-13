let warehouseTimezone = 'Asia/Manila'
export const setWarehouseTimezone = value => {
  if (value) { new Intl.DateTimeFormat('en', { timeZone: value }); warehouseTimezone = value }
}
export const warehouseDate = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: warehouseTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
  const part = type => parts.find(item => item.type === type).value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export const today = () => warehouseDate()
export const isExpired = (date) => Boolean(date) && date < today()
export const daysUntil = (date) => {
  const calendarDay = (value) => {
    const [year, month, day] = value.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return (calendarDay(date) - calendarDay(today())) / 86400000
}
export const usableStock = product => Number(product?.usableStock ?? product?.stock ?? 0)
export const movementChange = movement => {
  if (movement.type === 'Transfer') return `↔ ${movement.quantity}`
  if (movement.stockBefore != null && movement.stockAfter != null) {
    const delta = movement.stockAfter - movement.stockBefore
    return `${delta > 0 ? '+' : ''}${delta}`
  }
  return `${['Stock In', 'Return', 'Opening Balance'].includes(movement.type) ? '+' : movement.type === 'Stock Out' ? '−' : '±'}${movement.quantity}`
}
export const getStockStatus = (product) =>
  usableStock(product) <= product.reorderPoint
    ? 'Low stock'
    : product.capacity > 0 && product.stock >= product.capacity * 0.9
      ? 'Near capacity'
      : 'In stock'
export const getBatchStatus = (batch) =>
  !batch.quantity
    ? 'Depleted'
    : isExpired(batch.expiresAt)
      ? 'Expired'
      : batch.expiresAt && daysUntil(batch.expiresAt) <= 30
        ? 'Expiring soon'
        : 'Available'
export const fifoBatch = (batches, productId) =>
  batches
    .filter((batch) => batch.productId === productId && batch.quantity > 0 && !isExpired(batch.expiresAt))
    .sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt))[0]
export const calculateReorder = ({ monthlySales, leadTime, safetyPercent, multiplier }) => {
  const dailyDemand = Number(monthlySales) / 30
  const safetyStock = dailyDemand * Number(leadTime) * (Number(safetyPercent) / 100)
  return { dailyDemand, safetyStock, reorderPoint: dailyDemand * Number(multiplier) * Number(leadTime) + safetyStock }
}
export const planningBaseline = (product, targetMonth = today().slice(0, 7)) => {
  const [year, month] = today().split('-').map(Number)
  const cutoffDate = new Date(Date.UTC(year, month - 13, 1))
  const cutoff = `${cutoffDate.getUTCFullYear()}-${String(cutoffDate.getUTCMonth() + 1).padStart(2, '0')}`
  const history = (product.monthlySalesHistory || []).filter(row => row.month >= cutoff && row.month < today().slice(0, 7))
  const monthlySales = history.length ? history.reduce((sum, row) => sum + Number(row.quantity), 0) / history.length : Number(product.monthlySales || 0)
  const multiplier = Number(product.seasonalProfile?.find(row => Number(row.month) === Number(targetMonth.slice(5, 7)))?.multiplier ?? 1)
  const safetyPercent = product.demandPattern === 'Seasonal-Critical' || product.demandPattern === 'Traceable-High Accuracy' ? 15 : 10
  return { monthlySales, multiplier, safetyPercent, months: history.length }
}
export const validateMovement = ({ type, product, quantity, batch }) => {
  if (!product) return 'Choose a product.'
  if (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0) return 'Quantity must be a positive whole number.'
  if (['Stock Out', 'Transfer'].includes(type) && Number(quantity) > product.stock)
    return 'Quantity exceeds available stock.'
  if (batch && isExpired(batch.expiresAt)) return 'Expired batches cannot be used.'
  return null
}
