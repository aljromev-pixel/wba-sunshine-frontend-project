import { apiClient } from './apiClient'

const storageKey = 'wba-pending-inventory-writes'
let pending = []
try { pending = JSON.parse(sessionStorage.getItem(storageKey) || '[]') } catch { pending = [] }
if (!Array.isArray(pending)) pending = []
const persist = () => { try { sessionStorage.setItem(storageKey, JSON.stringify(pending)) } catch { /* Storage is optional within this tab. */ } }

export async function inventoryWrite(path, body) {
  const signature = JSON.stringify([path, body])
  let entry = pending.find(item => item.signature === signature)
  if (!entry) {
    entry = { signature, requestId: crypto.randomUUID() }
    pending.push(entry)
    persist()
  }
  try {
    const response = await apiClient.post(path, { ...body, requestId: entry.requestId })
    pending = pending.filter(item => item !== entry)
    persist()
    return response
  } catch (error) {
    if (error.status >= 400 && error.status < 500) {
      pending = pending.filter(item => item !== entry)
      persist()
    }
    throw error
  }
}

export function clearInventoryWrites() {
  pending = []
  persist()
}
