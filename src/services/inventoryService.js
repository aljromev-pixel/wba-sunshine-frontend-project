import { fifoBatch, setWarehouseTimezone } from '../utils/inventoryLogic'
import { apiClient } from './apiClient'
import { inventoryWrite, clearInventoryWrites } from './writeRequests'

const clone = (value) => JSON.parse(JSON.stringify(value))
const emptyState = { products: [], batches: [], transactions: [], adjustments: [], audit: [], alerts: [] }
let state = clone(emptyState)
let listeners = []
let loadErrorListeners = []
let generation = 0
let loadSequence = 0
let reportHistoryLoading
const emit = () => listeners.forEach((listener) => listener(clone(state)))
const normalizeIds = (inventory) => ({
  ...inventory,
  products: inventory.products.map((item) => ({ ...item, id: String(item.id) })),
  batches: inventory.batches.map((item) => ({ ...item, id: String(item.id), productId: String(item.productId) })),
  transactions: inventory.transactions.map((item) => ({ ...item, id: String(item.id), productId: String(item.productId) })),
  adjustments: inventory.adjustments.map((item) => ({
    ...item,
    id: String(item.id),
    productId: String(item.productId),
    requestedById: String(item.requestedById),
  })),
  audit: inventory.audit.map((item) => ({ ...item, id: String(item.id) })),
})
const applyState = (nextState) => {
  setWarehouseTimezone(nextState.warehouseTimezone)
  state = { ...emptyState, ...nextState }
  emit()
}

export const inventoryService = {
  subscribeLoadError(listener) {
    loadErrorListeners = [...loadErrorListeners, listener]
    return () => { loadErrorListeners = loadErrorListeners.filter((item) => item !== listener) }
  },
  subscribe(listener) {
    listeners = [...listeners, listener]
    listener(clone(state))
    return () => {
      listeners = listeners.filter((item) => item !== listener)
    }
  },
  snapshot: () => clone(state),
  product: (id) => clone(state.products.find((item) => item.id === id)),
  fifo: (productId) => clone(fifoBatch(state.batches, productId)),
  alerts: () => clone(state.alerts),
  async load() {
    const currentGeneration = generation
    const sequence = ++loadSequence
    const inventory = await apiClient.get('/v1/inventory')
    if (currentGeneration === generation && sequence === loadSequence) applyState(normalizeIds(inventory))
    return clone(state)
  },
  async refreshAfterWrite() {
    const currentGeneration = generation
    try {
      await this.load()
    } catch (exception) {
      if (currentGeneration === generation) loadErrorListeners.forEach((listener) => listener(exception))
    }
  },
  async loadMoreHistory(section) {
    const info = state.history?.[section]
    if (!info?.nextPage) return
    const currentGeneration = generation
    const currentLoad = loadSequence
    const response = await apiClient.get(`/v1/inventory/history/${section}?page=${info.nextPage}&throughId=${info.throughId}`)
    if (currentGeneration !== generation || currentLoad !== loadSequence) return
    const next = normalizeIds({ ...state, [section]: [...state[section], ...response.data] })
    next[section] = [...new Map(next[section].map(item => [item.id, item])).values()]
    next.history = { ...state.history, [section]: { ...info, nextPage: response.meta.current_page < response.meta.last_page ? response.meta.current_page + 1 : null } }
    applyState(next)
  },
  loadReportHistory() {
    if (!reportHistoryLoading) {
      const currentGeneration = generation
      reportHistoryLoading = (async () => {
        for (const section of ['transactions', 'adjustments']) {
          while (currentGeneration === generation && state.history?.[section]?.nextPage) await this.loadMoreHistory(section)
        }
      })().finally(() => { if (currentGeneration === generation) reportHistoryLoading = undefined })
    }
    return reportHistoryLoading
  },
  async productHistory(id) {
    const response = await apiClient.get(`/v1/inventory/history/transactions?throughId=${state.history.transactions.throughId}&productId=${id}`)
    return normalizeIds({ ...state, transactions: response.data }).transactions
  },
  async move({ type, productId, quantity, batchId, reference, destinationLocation, returnCondition, location, batchNumber, expiresAt }) {
    const response = await inventoryWrite('/v1/inventory/movements', {
      type,
      productId: Number(productId),
      batchId: batchId === 'new' ? null : Number(batchId),
      quantity: Number(quantity),
      reference,
      ...(type === 'Transfer' ? { destinationLocation } : {}),
      ...(type === 'Return' ? { returnCondition } : {}),
      ...(type === 'Stock In' && batchId === 'new' ? { location, batchNumber: batchNumber || undefined, expiresAt: expiresAt || null } : {}),
    })
    await this.refreshAfterWrite()
    return response.data
  },
  async submitAdjustment({ productId, requestedQty, reason, batchCounts, expectedStockVersion }) {
    const response = await inventoryWrite('/v1/inventory/adjustments', {
      productId: Number(productId),
      requestedQty: Number(requestedQty),
      reason,
      ...(batchCounts ? { batchCounts } : {}),
      ...(expectedStockVersion === undefined ? {} : { expectedStockVersion }),
    })
    await this.refreshAfterWrite()
    return response.data
  },
  async reviewAdjustment(id, approved) {
    const response = await apiClient.post(`/v1/inventory/adjustments/${id}/review`, { approved })
    await this.refreshAfterWrite()
    return response.data
  },
  async createProduct(product) {
    const response = await apiClient.post('/v1/products', product)
    await this.refreshAfterWrite()
    return response.data
  },
  async updateProduct(id, product) {
    const response = await apiClient.put(`/v1/products/${id}`, product)
    await this.refreshAfterWrite()
    return response.data
  },
  async deleteProduct(id) {
    await apiClient.delete(`/v1/products/${id}`)
    await this.refreshAfterWrite()
  },
  async createBatch(batch) {
    const response = await apiClient.post('/v1/batches', batch)
    await this.refreshAfterWrite()
    return response.data
  },
  async updateBatch(id, batch) {
    const response = await apiClient.put(`/v1/batches/${id}`, batch)
    await this.refreshAfterWrite()
    return response.data
  },
  async deleteBatch(id) {
    await apiClient.delete(`/v1/batches/${id}`)
    await this.refreshAfterWrite()
  },
  reset() {
    generation += 1
    reportHistoryLoading = undefined
    clearInventoryWrites()
    applyState(emptyState)
  },
}
