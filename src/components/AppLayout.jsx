import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { PERMISSIONS } from '../utils/permissions'
import { ThemeToggle } from './ThemeToggle'

const nav = [
  { href: '/dashboard', label: 'Overview', icon: '▦' },
  { href: '/inventory', label: 'Inventory', icon: '▤', permission: PERMISSIONS.INVENTORY_VIEW },
  { href: '/batches', label: 'Batches & FIFO', icon: '◫', permission: PERMISSIONS.FIFO_VIEW },
  { href: '/stock-in', label: 'Stock In', icon: '↓', permission: PERMISSIONS.STOCK_IN },
  { href: '/stock-out', label: 'Stock Out', icon: '↑', permission: PERMISSIONS.STOCK_OUT },
  { href: '/transfers', label: 'Transfers', icon: '⇄', permission: PERMISSIONS.TRANSFER_CREATE },
  { href: '/returns', label: 'Returns', icon: '↩', permission: PERMISSIONS.RETURNS_CREATE },
  { href: '/cycle-count', label: 'Cycle Count', icon: '✓', permission: PERMISSIONS.CYCLE_COUNT },
  { href: '/adjustments', label: 'Adjustments', icon: '±', permission: [PERMISSIONS.ADJUSTMENT_REQUEST, PERMISSIONS.ADJUSTMENT_APPROVE] },
  { href: '/alerts', label: 'Alerts', icon: '!', permission: PERMISSIONS.ALERTS_VIEW },
  { href: '/notifications', label: 'Notifications', icon: '◉' },
  { href: '/reorder-calculator', label: 'Reorder Calculator', icon: '⌁', permission: PERMISSIONS.REORDER_CALCULATE },
  { href: '/reports', label: 'Reports', icon: '▧', permission: PERMISSIONS.REPORTS_VIEW },
  { href: '/audit-trail', label: 'Audit Trail', icon: '◷', permission: PERMISSIONS.AUDIT_VIEW },
  { href: '/users', label: 'User Management', icon: '♙', permission: PERMISSIONS.USERS_MANAGE },
  { href: '/trash', label: 'Trash bin', icon: '▱', permission: [PERMISSIONS.INVENTORY_EDIT, PERMISSIONS.USERS_MANAGE] },
]
const title = (path) =>
  nav.find((item) => item.href === path)?.label || (path.startsWith('/inventory/') ? 'Product Details' : 'Sunshine')

export function AppLayout({ path, children }) {
  const { user, can, logout, notice, data, retryInventory, inventoryLoading, backgroundError } = useApp()
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const toggle = useRef(null)
  const sidebar = useRef(null)
  const visible = mobile ? open : !collapsed
  const close = () => { setOpen(false); toggle.current?.focus() }
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const resize = () => { setMobile(media.matches); setOpen(false) }
    media.addEventListener('change', resize)
    return () => media.removeEventListener('change', resize)
  }, [])
  useEffect(() => {
    if (!mobile || !open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sidebar.current.querySelector('button').focus()
    const keyboard = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); toggle.current?.focus() }
      if (event.key !== 'Tab') return
      const controls = [...sidebar.current.querySelectorAll('a, button:not([disabled])')]
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keyboard); toggle.current?.focus() }
  }, [mobile, open])
  const go = (href) => {
    window.location.hash = href
    setOpen(false)
  }
  return (
    <div className={`application ${visible ? 'navigation-visible' : 'navigation-hidden'}`}>
      {mobile && open && <button className="navigation-backdrop" aria-label="Dismiss navigation" tabIndex={-1} onClick={close} />}
      <aside ref={sidebar} id="workspace-navigation" inert={!visible} className={`sidebar ${mobile && open ? 'sidebar-open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <span className="brand-wordmark" aria-label="Sunshine">
            Sun<span>shine</span>
          </span>
          <span>
            <small>WALANGBROWNOUT APPLIANCES</small>
          </span>
          <button type="button" className={`sidebar-toggle sidebar-close ${mobile ? 'is-open' : ''}`} aria-expanded={visible} aria-controls="workspace-navigation" onClick={() => { if (mobile) close(); else { setCollapsed(true); requestAnimationFrame(() => toggle.current?.focus()) } }} aria-label={mobile ? 'Close navigation' : 'Collapse navigation'}>
            <span /><span /><span />
          </button>
        </div>
        <nav>
          {nav
            .filter((item) => !item.permission || (Array.isArray(item.permission) ? item.permission.some(can) : can(item.permission)))
            .map((item) => (
              <a
                key={item.href}
                className={
                  path === item.href || (item.href === '/inventory' && path.startsWith('/inventory/')) ? 'active' : ''
                }
                href={`#${item.href}`}
                onClick={() => setOpen(false)}
              >
                <i>{item.icon}</i>
                {item.label}
              </a>
            ))}
        </nav>
        <div className="profile">
          <div className="avatar">{user.initials}</div>
          <div>
            <strong>{user.name}</strong>
            <small>
              {user.department} • {user.roleLevel}
            </small>
          </div>
          <button className="text-button" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main-content" inert={mobile && open}>
        <div className="workspace-content">
        <header className="topbar">
          <div className="workspace-heading">
            {!visible && <button ref={toggle} type="button" className={`sidebar-toggle ${visible ? 'is-open' : ''}`} aria-label={mobile ? 'Open navigation' : visible ? 'Collapse navigation' : 'Expand navigation'} aria-expanded={visible} aria-controls="workspace-navigation" onClick={() => mobile ? setOpen(value => !value) : setCollapsed(value => !value)}>
              <span /><span /><span />
            </button>}
            <div className="workspace-title">
            <p className="breadcrumb">SUNSHINE / WORKSPACE</p>
            <h1>{title(path)}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <a className="notification-trigger" href="#/notifications" aria-label={`Notifications, ${data.notificationSummary?.unreadCount || 0} unread`}><span aria-hidden="true">◉</span><span className="notification-count">{data.notificationSummary?.unreadCount > 99 ? '99+' : data.notificationSummary?.unreadCount || 0}</span></a>
            <button className="header-user" onClick={() => go('/dashboard')} aria-label="Open dashboard">
              <span className="profile-trigger">{user.initials}</span>
              <span>
                <strong title={user.name}>{user.name}</strong>
                <small>
                  {user.department} • {user.roleLevel}
                </small>
              </span>
            </button>
          </div>
        </header>
        {data.loadedAt && <div className="form-actions inventory-refresh"><small>Inventory snapshot: {new Date(data.loadedAt).toLocaleString(undefined, { timeZone: data.warehouseTimezone || 'Asia/Manila' })} · {data.warehouseTimezone || 'Asia/Manila'}</small><button type="button" className="inline-button" disabled={inventoryLoading} onClick={retryInventory}>Refresh inventory</button></div>}
        {data.loadedAt && <p className="refresh-status" role="status">{backgroundError || 'Updates every 30 seconds while visible; paused when a form or dialog is open.'}</p>}
        {notice && <div className={`toast ${notice.tone}`}>{notice.message}</div>}
        {children}
        </div>
      </main>
    </div>
  )
}
