import { useEffect, useRef, useState } from 'react'
import { workspaceService } from '../services/workspaceService'
import { apiErrorMessage } from '../utils/apiErrors'
import { AsyncButton, EmptyState, FormError, LoadingState, StatusBadge, formatDate } from '../components/Shared'
import { useApp } from '../context/AppContext'

export function NotificationsPage() {
  const { data, notify } = useApp()
  const [rows, setRows] = useState([])
  const [unread, setUnread] = useState(data.notificationSummary?.unreadCount || 0)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const version = useRef(0)
  const load = async (nextPage = 1) => {
    const current = ++version.current
    setLoading(true); setError('')
    try {
      const response = await workspaceService.notifications(nextPage)
      if (current !== version.current) return
      setRows(existing => nextPage === 1 ? response.data : [...new Map([...existing, ...response.data].map(record => [record.id, record])).values()])
      setUnread(response.unreadCount)
      setPage(response.meta.current_page); setLastPage(response.meta.last_page)
    } catch (exception) { if (current === version.current) setError(apiErrorMessage(exception)) }
    finally { if (current === version.current) setLoading(false) }
  }
  useEffect(() => { load(); return () => { version.current++ } }, [data.loadedAt])
  const mark = async id => {
    if (busy) return
    setBusy(true); setError('')
    try {
      const response = id ? await workspaceService.readNotification(id) : await workspaceService.readAllNotifications()
      setUnread(response.unreadCount)
      setRows(current => current.map(record => !id || record.id === id ? { ...record, readAt: new Date().toISOString() } : record))
      notify(id ? 'Notification marked as read.' : 'All notifications marked as read.')
    } catch (exception) { setError(apiErrorMessage(exception)) }
    finally { setBusy(false) }
  }
  const destination = link => /^\/(inventory\/\d+|adjustments|alerts)$/.test(link || '') ? `#${link}` : '#/alerts'
  return <section className="page-stack">
    <div className="page-intro"><div><p className="eyebrow">INVENTORY UPDATES</p><h2>Notifications</h2><p>Stock receipts, dispatches, transfers, returns and permitted adjustment updates. Read status is saved to your account.</p></div></div>
    <section className="surface"><div className="filter-bar"><AsyncButton className="inline-button" loading={loading} loadingLabel="Refreshing…" disabled={busy} onClick={() => load()}>Refresh notifications</AsyncButton><AsyncButton className="inline-button" loading={busy} disabled={loading || !unread} onClick={() => mark()}>Mark all as read</AsyncButton></div>
      <FormError>{error}</FormError>{error && <button className="inline-button" disabled={loading || busy} onClick={() => load()}>Retry notifications</button>}
      {loading && !rows.length ? <LoadingState /> : !rows.length && !error ? <EmptyState title="No notifications yet" text="New inventory events will appear here; older activity remains in the movement history." /> : <div className="workspace-records">{rows.map(record => <article className={`workspace-record ${record.readAt ? '' : 'unread-record'}`} key={record.id}><div><StatusBadge>{record.severity}</StatusBadge><h3>{record.title}</h3><p>{record.message}</p><small>{formatDate(record.date, true)} · {record.readAt ? 'Read' : 'Unread'}</small></div><div className="record-actions"><a className="inline-button" href={destination(record.link)}>View details</a>{!record.readAt && <AsyncButton className="inline-button" loading={busy} disabled={loading} onClick={() => mark(record.id)}>Mark as read</AsyncButton>}</div></article>)}</div>}
      {page < lastPage && <AsyncButton className="inline-button" loading={loading} loadingLabel="Loading…" disabled={busy} onClick={() => load(page + 1)}>Load older notifications</AsyncButton>}
    </section>
  </section>
}
