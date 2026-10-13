import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReport, filterReportDates, reportCsv, REPORT_TYPES } from '../src/utils/reports.js'

test('report dates are inclusive warehouse calendar dates without changing source records', () => {
  const snapshot = { transactions: [{ id: 1, date: '2030-01-14T16:01:00Z' }, { id: 2, date: '2030-01-15T16:00:00Z' }], adjustments: [{ id: 3, date: '2030-01-15' }] }
  const filtered = filterReportDates(snapshot, '2030-01-15', '2030-01-15')
  assert.deepEqual(filtered.transactions.map(item => item.id), [1])
  assert.equal(filtered.adjustments.length, 1)
  assert.equal(snapshot.transactions.length, 2)
})

test('CSV escapes quotes and spreadsheet formulas while preserving numeric variances', () => {
  const csv = reportCsv({ columns: ['Product', 'Variance'], rows: [{ values: ['=SUM(1,2)', -3] }, { values: ['Air "quality"', 0] }] })
  assert.ok(csv.includes('"\'=SUM(1,2)"'))
  assert.ok(csv.includes('"Air ""quality"""'))
  assert.ok(csv.includes('"-3"'))
})

const data = {
  products: [
    { id: '1', sku: 'A', name: 'Alpha', stock: 5, reorderPoint: 10, capacity: null, monthlySales: 60, leadTime: 7 },
    { id: '2', sku: 'B', name: 'Beta', stock: 10, reorderPoint: 10, capacity: 100, monthlySales: 30, leadTime: 3 },
    { id: '3', sku: 'C', name: 'Gamma', stock: 20, reorderPoint: 10, capacity: 100, monthlySales: 0, leadTime: 0 },
  ],
  batches: [],
  transactions: [{ id: 'm1', reference: 'SO-1', productId: 1, type: 'Stock Out', quantity: 3, date: '2030-01-15T12:00:00Z', status: 'Completed', stockBefore: 8, stockAfter: 5, sourceLocation: 'Main warehouse', destinationLocation: null }],
  adjustments: [
    { id: 'a1', productId: 1, systemQty: 10, requestedQty: 8, reason: 'Cycle count: system 10, counted 8', status: 'Approved' },
    { id: 'a2', productId: 1, systemQty: 10, requestedQty: 10, reason: 'Cycle count: system 10, counted 10', status: 'Pending' },
    { id: 'a3', productId: 2, systemQty: 10, requestedQty: 12, reason: 'Returned units', status: 'Rejected' },
  ],
}

test('inventory and movement reports retain API values, references and product identity', () => {
  assert.deepEqual(buildReport('Inventory Summary', data).rows[0].values, ['A', 'Alpha', 5, 10, 'Low stock'])
  assert.deepEqual(buildReport('Stock Movement Report', data).rows[0].values, ['m1', 'SO-1', 'Alpha', 'Stock Out', 3, '2030-01-15T12:00:00Z', 'Completed', 8, 5, 'Main warehouse', null])
  const refreshed = { ...data, products: data.products.map((product) => ({ ...product, stock: 99 })) }
  assert.equal(buildReport('Inventory Summary', refreshed).rows[0].values[2], 99)
})

test('low stock includes the threshold and computes nonnegative shortfall', () => {
  assert.deepEqual(buildReport('Low Stock Report', data).rows.map((row) => [row.id, row.values[4]]), [['1', 5], ['2', 0]])
})

test('discrepancies use recorded stock, cycle count follows its saved reason convention, adjustments include all statuses', () => {
  const discrepancies = buildReport('Inventory Discrepancy Report', data).rows
  assert.deepEqual(discrepancies.map((row) => row.id), ['a1', 'a3'])
  assert.equal(discrepancies[0].values[4], -2)
  assert.equal(discrepancies[1].values[4], 2)
  assert.deepEqual(buildReport('Cycle Count Report', data).rows.map((row) => row.id), ['a1', 'a2'])
  assert.deepEqual(buildReport('Adjustment Report', data).rows.map((row) => row.values[6]), ['Approved', 'Pending', 'Rejected'])
})

test('expiring report includes today and day 30 but excludes expired, distant, depleted and undated batches', () => {
  const RealDate = Date
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [new RealDate('2030-01-15T04:00:00Z').getTime()])) }
  }
  try {
    const batches = ['2030-01-14', '2030-01-15', '2030-02-14', '2030-02-15', null, '2030-01-16']
      .map((expiresAt, index) => ({ id: String(index), productId: '1', number: `B-${index}`, quantity: index === 5 ? 0 : 4, expiresAt }))
    const report = buildReport('Expiring Stock Report', { ...data, batches })
    assert.deepEqual(report.rows.map((row) => [row.id, row.values[4]]), [['1', 0], ['2', 30]])
  } finally { globalThis.Date = RealDate }
})

test('reorder recommendations use explicit assumptions without modifying API records', () => {
  const before = JSON.stringify(data)
  const report = buildReport('Seasonal Reorder Report', data, { multiplier: 2, safetyPercent: 10 })
  assert.deepEqual(report.rows[0].values, ['A', 'Alpha', 5, '2.0', 7, 2, 30, 25])
  assert.match(report.description, /multiplier 2× and safety stock 10%/)
  assert.equal(JSON.stringify(data), before)
})

test('all reports handle an empty API snapshot and unknown reports fail explicitly', () => {
  const empty = { products: [], batches: [], transactions: [], adjustments: [] }
  for (const type of REPORT_TYPES) assert.deepEqual(buildReport(type, empty).rows, [])
  assert.throws(() => buildReport('Unsupported', data), /Unknown report/)
})
