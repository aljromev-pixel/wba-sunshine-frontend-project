import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { PERMISSIONS } from '../utils/permissions'
import { workspaceService } from '../services/workspaceService'
import { apiErrorMessage } from '../utils/apiErrors'
import { AsyncButton, ConfirmDialog, EmptyState, FormError, LoadingState, formatDate } from '../components/Shared'

export function TrashPage() {
  const { can, notify } = useApp()
  const [type, setType] = useState('products')
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const requestVersion = useRef(0)
  const load = async (nextPage = 1) => {
    const version = ++requestVersion.current
    setLoading(true); setError('')
    try {
      const response = await workspaceService.trash(type, nextPage)
      if (version !== requestVersion.current) return
      setRows(current => nextPage === 1 ? response.data : [...current, ...response.data])
      setPage(response.current_page); setLastPage(response.last_page)
    } catch (exception) { if (version === requestVersion.current) setError(apiErrorMessage(exception)) }
    finally { if (version === requestVersion.current) setLoading(false) }
  }
  useEffect(() => { setRows([]); load(); return () => { requestVersion.current++ } }, [type])
  const restore = async record => {
    const response = await workspaceService.restore(type, record.id)
    notify(response.message)
    await load()
  }
  return <section className="page-stack">
    <div className="page-intro"><div><p className="eyebrow">RECOVER DELETED RECORDS</p><h2>Trash bin</h2><p>Restore eligible records. Stock movements and audit history are protected. Restored accounts remain disabled until an administrator enables them.</p></div></div>
    <section className="surface">
      <div className="filter-bar"><label>Record type<select value={type} disabled={loading || Boolean(confirmation)} onChange={event => setType(event.target.value)}><option value="products">Products</option><option value="batches">Batches</option>{can(PERMISSIONS.USERS_MANAGE) && <option value="users">Users</option>}</select></label><AsyncButton className="inline-button" loading={loading} loadingLabel="Refreshing…" onClick={() => load()}>Refresh trash</AsyncButton></div>
      <FormError>{error}</FormError>
      {error && <button className="inline-button" disabled={loading} onClick={() => load()}>Retry trash loading</button>}
      {loading && !rows.length ? <LoadingState /> : !rows.length && !error ? <EmptyState title="Trash is empty" text="Deleted eligible records will appear here." /> : <div className="workspace-records">{rows.map(record => <article className="workspace-record" key={record.id}><div><h3>{record.name}</h3><p>{record.reference}</p><small>Deleted {formatDate(record.deletedAt, true)} by {record.deletedBy}</small></div><button className="inline-button" disabled={loading} onClick={() => setConfirmation(record)}>Restore</button></article>)}</div>}
      {page < lastPage && <AsyncButton className="inline-button" loading={loading} loadingLabel="Loading…" onClick={() => load(page + 1)}>Load older deleted records</AsyncButton>}
    </section>
    {confirmation && <ConfirmDialog title="Restore record?" message={`Restore ${confirmation.name}? ${type === 'users' ? 'The account will remain disabled until you enable it in User Management.' : 'It will return to the active inventory list.'}`} confirmLabel="Restore record" onCancel={() => setConfirmation(null)} onConfirm={() => restore(confirmation)} />}
  </section>
}
