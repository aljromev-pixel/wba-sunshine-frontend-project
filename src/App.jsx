import { useEffect, useState } from 'react'
import { AppLayout } from './components/AppLayout'
import { Login } from './components/Login'
import { Landing, SetPassword } from './pages/PublicPages'
import { AsyncButton, FormError, LoadingState } from './components/Shared'
import { useApp } from './context/AppContext'
import { PERMISSIONS } from './utils/permissions'
import { Dashboard } from './pages/Dashboard'
import { Batches, InventoryList, ProductDetails } from './pages/InventoryPages'
import { Adjustments, CycleCount, MovementForm } from './pages/WorkflowPages'
import { AuditTrail, ReorderCalculator, Reports, Users } from './pages/OperationsPages'
import { AlertPage as Alerts } from './pages/AlertPage'
import { TrashPage } from './pages/TrashPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { PreferencesProvider } from './context/PreferencesContext'
import { SettingsPage, HelpCenter } from './pages/SettingsPage'
import { accountPortal, dashboardPath, savedPortal } from './utils/authPortal'

const permissions = {
  '/inventory': PERMISSIONS.INVENTORY_VIEW,
  '/batches': PERMISSIONS.FIFO_VIEW,
  '/stock-in': PERMISSIONS.STOCK_IN,
  '/stock-out': PERMISSIONS.STOCK_OUT,
  '/transfers': PERMISSIONS.TRANSFER_CREATE,
  '/returns': PERMISSIONS.RETURNS_CREATE,
  '/cycle-count': PERMISSIONS.CYCLE_COUNT,
  '/adjustments': [PERMISSIONS.ADJUSTMENT_REQUEST, PERMISSIONS.ADJUSTMENT_APPROVE],
  '/alerts': PERMISSIONS.ALERTS_VIEW,
  '/reorder-calculator': PERMISSIONS.REORDER_CALCULATE,
  '/reports': PERMISSIONS.REPORTS_VIEW,
  '/audit-trail': PERMISSIONS.AUDIT_VIEW,
  '/users': PERMISSIONS.USERS_MANAGE,
  '/trash': [PERMISSIONS.INVENTORY_EDIT, PERMISSIONS.USERS_MANAGE],
}
function NotFound() {
  return (
    <section className="surface empty-state">
      <span>◫</span>
      <h2>Page not found</h2>
      <p>This address does not match an available page.</p>
      <a className="button primary" href="#/dashboard">Return to dashboard</a>
    </section>
  )
}
export default function App() {
  return <PreferencesProvider><AppRoutes /></PreferencesProvider>
}
function AppRoutes() {
  const { user, can, authLoading, authError, inventoryLoading, inventoryError, retryInventory, logout } = useApp()
  const [path, setPath] = useState(() => window.location.hash.slice(1) || '/')
  useEffect(() => {
    const update = () => setPath(window.location.hash.slice(1) || '/')
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  useEffect(() => {
    if (user && !user.mustChangePassword && ['/', '/sign-in', '/admin/sign-in', '/sign-up', '/dashboard'].includes(path)) window.location.hash = dashboardPath(user)
  }, [user, path])
  if (authLoading) return <LoadingState fullPage>Restoring your session…</LoadingState>
  if (!user) {
    if (path === '/' && !authError) return <Landing />
    const portal = path === '/sign-in' ? 'staff' : path.startsWith('/admin/') ? 'admin' : savedPortal()
    return <Login key={portal} portal={portal} />
  }
  if (user.mustChangePassword) return <SetPassword />
  if ((path === '/admin/dashboard' && accountPortal(user) !== 'admin') || (path === '/staff/dashboard' && accountPortal(user) !== 'staff')) {
    return <AppLayout path={path}><section className="surface forbidden"><h2>This dashboard belongs to the other login portal.</h2><a className="button primary" href={`#${dashboardPath(user)}`}>Return to your dashboard</a></section></AppLayout>
  }
  const workspacePath = ['/admin/dashboard', '/staff/dashboard'].includes(path) ? '/dashboard' : path
  const supportRoute = ['/settings', '/help'].includes(path)
  if (!supportRoute && (inventoryLoading || inventoryError)) return <AppLayout path={workspacePath}>
    <section className="surface">
      {inventoryLoading ? <LoadingState /> : <>
        <h2>Unable to load inventory</h2>
        <FormError>{inventoryError}</FormError>
        <div className="form-actions">
          <AsyncButton className="button primary" loading={inventoryLoading} onClick={retryInventory}>Retry inventory loading</AsyncButton>
          <button type="button" className="inline-button" onClick={logout}>Sign out</button>
        </div>
      </>}
    </section>
  </AppLayout>
  const productRoute = /^\/inventory\/[^/]+$/.test(path)
  const basePath = productRoute ? '/inventory' : path
  const needed = permissions[basePath]
  const view =
    needed && !(Array.isArray(needed) ? needed.some(can) : can(needed)) ? (
      <section className="surface forbidden">
        <p className="eyebrow">ACCESS RESTRICTED</p>
        <h2>This module is not part of your assigned workspace.</h2>
        <a className="button primary" href="#/dashboard">
          Return to dashboard
        </a>
      </section>
    ) : workspacePath === '/dashboard' ? (
      <Dashboard />
    ) : path === '/inventory' ? (
      <InventoryList />
    ) : productRoute ? (
      <ProductDetails productId={path.split('/').pop()} />
    ) : path === '/batches' ? (
      <Batches />
    ) : path === '/stock-in' ? (
      <MovementForm key="Stock In" type="Stock In" />
    ) : path === '/stock-out' ? (
      <MovementForm key="Stock Out" type="Stock Out" />
    ) : path === '/transfers' ? (
      <MovementForm key="Transfer" type="Transfer" />
    ) : path === '/returns' ? (
      <MovementForm key="Return" type="Return" />
    ) : path === '/cycle-count' ? (
      <CycleCount />
    ) : path === '/adjustments' ? (
      <Adjustments />
    ) : path === '/alerts' ? (
      <Alerts />
    ) : path === '/reorder-calculator' ? (
      <ReorderCalculator />
    ) : path === '/reports' ? (
      <Reports />
    ) : path === '/audit-trail' ? (
      <AuditTrail />
    ) : path === '/users' ? (
      <Users />
    ) : path === '/trash' ? (
      <TrashPage />
    ) : path === '/settings' ? (
      <SettingsPage />
    ) : path === '/help' ? (
      <HelpCenter />
    ) : path === '/notifications' ? (
      <NotificationsPage />
    ) : (
      <NotFound />
    )
  return <AppLayout path={workspacePath}><div key={path} className="page-transition">{view}</div></AppLayout>
}
