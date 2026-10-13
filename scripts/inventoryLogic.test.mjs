import assert from 'node:assert/strict'
import test from 'node:test'
import { daysUntil, getBatchStatus, getStockStatus, today, setWarehouseTimezone, usableStock, movementChange, planningBaseline } from '../src/utils/inventoryLogic.js'

test('expiry uses the warehouse calendar date and the rolling 30-day boundary', () => {
  const RealDate = Date
  const fixed = new RealDate('2030-01-14T16:30:00Z')
  setWarehouseTimezone('Asia/Manila')
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [fixed.getTime()])) }
  }
  try {
    assert.equal(today(), '2030-01-15')
    assert.equal(daysUntil('2030-02-14'), 30)
    assert.equal(daysUntil('2030-02-15'), 31)
    const batch = (expiresAt, quantity = 1) => getBatchStatus({ expiresAt, quantity })
    assert.equal(batch('2030-01-14'), 'Expired')
    assert.equal(batch('2030-01-15'), 'Expiring soon')
    assert.equal(batch('2030-02-14'), 'Expiring soon')
    assert.equal(batch('2030-02-15'), 'Available')
    assert.equal(batch(null), 'Available')
    assert.equal(batch('2030-01-14', 0), 'Depleted')
  } finally { globalThis.Date = RealDate }
})

test('calendar day differences remain whole days across daylight saving changes', () => {
  const RealDate = Date
  const fixed = new RealDate('2030-03-09T04:00:00Z')
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [fixed.getTime()])) }
  }
  try { assert.equal(daysUntil('2030-03-11'), 2) }
  finally { globalThis.Date = RealDate }
})

test('products with no configured capacity do not show a capacity warning', () => {
  for (const capacity of [null, undefined, 0]) {
    assert.equal(getStockStatus({ stock: 10, reorderPoint: 2, capacity }), 'In stock')
  }
  assert.equal(getStockStatus({ stock: 9, reorderPoint: 2, capacity: 10 }), 'Near capacity')
  assert.equal(getStockStatus({ stock: 1, reorderPoint: 2, capacity: 10 }), 'Low stock')
})

test('availability and movement signs preserve warehouse meaning', () => {
  assert.equal(usableStock({ stock: 10, usableStock: 3 }), 3)
  assert.equal(getStockStatus({ stock: 10, usableStock: 3, reorderPoint: 4 }), 'Low stock')
  assert.equal(movementChange({ type: 'Transfer', quantity: 2, stockBefore: 10, stockAfter: 10 }), '↔ 2')
  assert.equal(movementChange({ type: 'Adjustment', quantity: 3, stockBefore: 7, stockAfter: 10 }), '+3')
  assert.equal(movementChange({ type: 'Adjustment', quantity: 3, stockBefore: 10, stockAfter: 7 }), '-3')
  assert.equal(movementChange({ type: 'Opening Balance', quantity: 10 }), '+10')
  assert.equal(movementChange({ type: 'Adjustment', quantity: 3 }), '±3')
})

test('planning uses completed historical months and saved calendar season rules', () => {
  const RealDate = Date
  const fixed = new RealDate('2030-01-15T12:00:00Z')
  globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [fixed.getTime()])) } }
  try {
    const result = planningBaseline({ monthlySales: 999, demandPattern: 'Seasonal-Critical', monthlySalesHistory: [{ month: '2029-11', quantity: 60 }, { month: '2029-12', quantity: 0 }, { month: '2030-01', quantity: 999 }, { month: '2028-01', quantity: 500 }], seasonalProfile: [{ month: 6, multiplier: 2 }] }, '2030-06')
    assert.deepEqual(result, { monthlySales: 30, multiplier: 2, safetyPercent: 15, months: 2 })
    assert.equal(planningBaseline({ monthlySales: 80 }).monthlySales, 80)
  } finally { globalThis.Date = RealDate }
})
