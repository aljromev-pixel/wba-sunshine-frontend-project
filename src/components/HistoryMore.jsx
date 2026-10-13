import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { inventoryService } from '../services/inventoryService'
import { apiErrorMessage } from '../utils/apiErrors'
import { AsyncButton, FormError } from './Shared'

export function HistoryMore({ section }) {
  const { data } = useApp()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const info = data.history?.[section]
  if (!info) return null
  const load = async () => {
    if (loading) return
    setLoading(true); setError('')
    try { await inventoryService.loadMoreHistory(section) } catch (exception) { setError(apiErrorMessage(exception)) }
    finally { setLoading(false) }
  }
  return <div><p className="muted">{data[section].length} of {info.total} records loaded.</p>{info.nextPage && <AsyncButton className="inline-button" loading={loading} onClick={load}>Load older records</AsyncButton>}<FormError>{error}</FormError></div>
}
