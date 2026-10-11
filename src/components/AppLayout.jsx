import { useState } from 'react'
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
  { href: '/reorder-calculator', label: 'Reorder Calculator', icon: '⌁', permission: PERMISSIONS.REORDER_CALCULATE },
  { href: '/reports', label: 'Reports', icon: '▧', permission: PERMISSIONS.REPORTS_VIEW },
  { href: '/audit-trail', label: 'Audit Trail', icon: '◷', permission: PERMISSIONS.AUDIT_VIEW },
  { href: '/users', label: 'User Management', icon: '♙', permission: PERMISSIONS.USERS_MANAGE },
]
const title = (path) =>
  nav.find((item) => item.href === path)?.label || (path.startsWith('/inventory/') ? 'Product Details' : 'Sunshine')

export function AppLayout({ path, children }) {
  const { user, can, logout, notice } = useApp()
  const [open, setOpen] = useState(false)
  const go = (href) => {
    window.location.hash = href
    setOpen(false)
  }
  return (
    <div className="application">
      <button className="mobile-menu" aria-label="Open navigation" onClick={() => setOpen(true)}>
        ☰
      </button>
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <span className="brand-wordmark" aria-label="Sunshine">
            Sun<span>shine</span>
          </span>
          <span>
            <small>WALANGBROWNOUT APPLIANCES</small>
          </span>
          <button className="close-menu" onClick={() => setOpen(false)} aria-label="Close navigation">
            ×
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
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="breadcrumb">SUNSHINE / INVENTORY WORKSPACE</p>
            <h1>{title(path)}</h1>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <button className="header-user" onClick={() => go('/dashboard')} aria-label="Open dashboard">
              <span className="profile-trigger">{user.initials}</span>
              <span>
                <strong>{user.name}</strong>
                <small>
                  {user.department} • {user.roleLevel}
                </small>
              </span>
            </button>
          </div>
        </header>
        {notice && <div className={`toast ${notice.tone}`}>{notice.message}</div>}
        {children}
      </main>
    </div>
  )
}
