import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { PERMISSIONS } from '../utils/permissions'
import { ThemeToggle } from './ThemeToggle'
import { BrandLogo } from './BrandLogo'

const nav = [
  { href: '/dashboard', label: 'Overview', icon: '▦' },
  { href: '/inventory', label: 'Inventory', sidebarLabel: 'Products', icon: '▤', permission: PERMISSIONS.INVENTORY_VIEW },
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
const navGroups = [
  { id: 'inventory', label: 'Inventory', icon: '▤', paths: ['/inventory', '/batches'] },
  { id: 'movements', label: 'Stock movements', icon: '⇄', paths: ['/stock-in', '/stock-out', '/transfers', '/returns'] },
  { id: 'checks', label: 'Stock checks', icon: '✓', paths: ['/cycle-count', '/adjustments'] },
  { id: 'insights', label: 'Insights', icon: '▧', paths: ['/alerts', '/reorder-calculator', '/reports', '/audit-trail'] },
  { id: 'management', label: 'Management', icon: '♙', paths: ['/users', '/trash'] },
]
const isActive = (item, path) => path === item.href || (item.href === '/inventory' && path.startsWith('/inventory/'))
const title = (path) =>
  nav.find((item) => item.href === path)?.label || (path.startsWith('/inventory/') ? 'Product Details' : 'WBA')

export function AppLayout({ path, children }) {
  const { user, can, logout, notice, data, retryInventory, inventoryLoading, backgroundError } = useApp()
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const activeGroup = navGroups.find(group => group.paths.includes(path.startsWith('/inventory/') ? '/inventory' : path))
  const [expandedGroup, setExpandedGroup] = useState(() => activeGroup?.id || 'inventory')
  const toggle = useRef(null)
  const sidebar = useRef(null)
  const visible = mobile ? open : !collapsed
  const allowedNav = nav.filter(item => !item.permission || (Array.isArray(item.permission) ? item.permission.some(can) : can(item.permission)))
  const groups = navGroups.map(group => ({ ...group, items: allowedNav.filter(item => group.paths.includes(item.href)) })).filter(group => group.items.length)
  const close = () => { setOpen(false); toggle.current?.focus() }
  useEffect(() => {
    if (activeGroup) setExpandedGroup(activeGroup.id)
    else if (path === '/dashboard') setExpandedGroup('inventory')
  }, [activeGroup?.id, path])
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
      const controls = [...sidebar.current.querySelectorAll('a, button:not([disabled])')].filter(element => element.getClientRects().length)
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keyboard); toggle.current?.focus() }
  }, [mobile, open])
  const navLink = item => <a key={item.href} className={isActive(item, path) ? 'active' : ''} aria-current={isActive(item, path) ? 'page' : undefined} href={`#${item.href}`} onClick={() => setOpen(false)}><i aria-hidden="true">{item.icon}</i><span>{item.sidebarLabel || item.label}</span></a>
  return (
    <div className={`application ${visible ? 'navigation-visible' : 'navigation-hidden'}`}>
      {mobile && open && <button className="navigation-backdrop" aria-label="Dismiss navigation" tabIndex={-1} onClick={close} />}
      <aside ref={sidebar} id="workspace-navigation" inert={!visible} className={`sidebar ${mobile && open ? 'sidebar-open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <BrandLogo compact href={null} />
          <button type="button" className={`sidebar-toggle sidebar-close ${mobile ? 'is-open' : ''}`} aria-expanded={visible} aria-controls="workspace-navigation" onClick={() => { if (mobile) close(); else { setCollapsed(true); requestAnimationFrame(() => toggle.current?.focus()) } }} aria-label={mobile ? 'Close navigation' : 'Collapse navigation'}>
            <span /><span /><span />
          </button>
        </div>
        <nav aria-label="Workspace modules">
          {navLink(nav[0])}
          {groups.map(group => <div className="sidebar-group" key={group.id}>
            <button type="button" className={`sidebar-group-toggle ${activeGroup?.id === group.id ? 'contains-active' : ''}`} aria-expanded={expandedGroup === group.id} aria-controls={`navigation-${group.id}`} onClick={() => setExpandedGroup(current => current === group.id ? '' : group.id)}>
              <i aria-hidden="true">{group.icon}</i><span>{group.label}</span><span className="sidebar-chevron" aria-hidden="true">⌄</span>
            </button>
            <div className="sidebar-group-links" id={`navigation-${group.id}`} hidden={expandedGroup !== group.id}>{group.items.map(navLink)}</div>
          </div>)}
        </nav>
        <div className="profile">
          <div className="avatar">{user.initials}</div>
          <div>
            <strong title={user.name}>{user.name}</strong>
            <small>
              {user.department} • {user.roleLevel}
            </small>
          </div>
          <button className="text-button" onClick={logout}>Sign out</button>
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
            <p className="breadcrumb">WBA / INVENTORY</p>
            <h1>{title(path)}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <a className="notification-trigger" href="#/notifications" title="Notifications" aria-label={`Notifications, ${data.notificationSummary?.unreadCount || 0} unread`}><span aria-hidden="true">◉</span><span className="notification-count">{data.notificationSummary?.unreadCount > 99 ? '99+' : data.notificationSummary?.unreadCount || 0}</span></a>
            <div className="header-user" role="group" aria-label={`Signed in as ${user.name}`}>
              <span className="profile-trigger">{user.initials}</span>
              <span>
                <strong title={user.name}>{user.name}</strong>
                <small>
                  {user.department} • {user.roleLevel}
                </small>
              </span>
            </div>
          </div>
        </header>
        {data.loadedAt && !['/notifications', '/trash'].includes(path) && <>
          <div className="form-actions inventory-refresh"><small>Inventory updated: {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: data.warehouseTimezone || 'Asia/Manila' }).format(new Date(data.loadedAt))} · {data.warehouseTimezone || 'Asia/Manila'}</small><button type="button" className="inline-button" disabled={inventoryLoading} onClick={retryInventory}>Refresh inventory</button></div>
          <p className="refresh-status" role="status">{backgroundError || 'Live updates pause while editing.'}</p>
        </>}
        {notice && <div className={`toast ${notice.tone}`}>{notice.message}</div>}
        {children}
        </div>
      </main>
    </div>
  )
}
