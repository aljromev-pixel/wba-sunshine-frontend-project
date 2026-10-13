// Local end-to-end QA uses a disposable SQLite database, never the team's database.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
assert.ok(process.env.QA_BACKEND_PATH, 'Set QA_BACKEND_PATH to the Laravel checkout.')
const backend = resolve(process.env.QA_BACKEND_PATH)
assert.ok(existsSync(join(backend, 'artisan')), 'Laravel checkout required.')
assert.ok(!existsSync(join(backend, 'bootstrap/cache/config.php')), 'Clear cached Laravel configuration before isolated QA.')
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE || 'playwright')
const temporary = mkdtempSync(join(tmpdir(), 'sunshine-qa-'))
const database = join(temporary, 'qa.sqlite')
writeFileSync(database, '')
const password = randomBytes(24).toString('hex')
const env = {
  ...process.env, APP_ENV: 'testing', APP_DEBUG: 'false',
  APP_KEY: `base64:${randomBytes(32).toString('base64')}`,
  DB_CONNECTION: 'sqlite', DB_DATABASE: database, DB_URL: '',
  CACHE_STORE: 'array', SESSION_DRIVER: 'array', QUEUE_CONNECTION: 'sync',
  CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:5199',
  BCRYPT_ROUNDS: '4', QA_PASSWORD: password, QA_BACKEND_PATH: backend,
}
execFileSync('php', ['artisan', 'migrate', '--force', '--no-interaction'], { cwd: backend, env, stdio: 'pipe' })
const fixture = join(temporary, 'fixtures.php')
writeFileSync(fixture, `<?php
require getenv('QA_BACKEND_PATH').'/vendor/autoload.php';
$app = require getenv('QA_BACKEND_PATH').'/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
foreach (['Warehouse' => ['Staff', 'Supervisor', 'Manager'], 'Sales' => ['Staff', 'Supervisor'], 'Purchasing' => ['Staff', 'Manager'], 'Administration' => ['Manager']] as $department => $levels) {
    foreach ($levels as $level) {
        App\\Models\\User::factory()->create(['name' => $department.' '.$level, 'email' => strtolower($department.'.'.$level).'@example.test', 'department' => $department, 'role_level' => $level, 'password' => Illuminate\\Support\\Facades\\Hash::make(getenv('QA_PASSWORD'))]);
    }
}
App\\Models\\User::factory()->create(['name' => 'Administration Reviewer', 'email' => 'administration.reviewer@example.test', 'department' => 'Administration', 'role_level' => 'Manager', 'password' => Illuminate\\Support\\Facades\\Hash::make(getenv('QA_PASSWORD'))]);
`)
execFileSync('php', [fixture], { cwd: backend, env, stdio: 'pipe' })
const apiBase = 'http://127.0.0.1:5198/api/v1'
const php = spawn('php', ['-S', '127.0.0.1:5198', join(backend, 'vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php')], { cwd: join(backend, 'public'), env, stdio: 'ignore' })
php.on('error', error => console.error(error.message))
process.env.VITE_API_BASE_URL = 'http://127.0.0.1:5198/api'
const vite = await createServer({ root, server: { host: '127.0.0.1', port: 5199, strictPort: true } })
let browser
const errors = []
async function api(token, path, method = 'GET', body) {
  if (method === 'POST' && path === '/inventory/adjustments' && !body.batchCounts) {
    const snapshot = (await api(token, '/inventory')).data
    const product = snapshot.products.find(item => item.id === body.productId)
    const batches = snapshot.batches.filter(item => item.productId === body.productId)
    body = { ...body, expectedStockVersion: product.stockVersion, batchCounts: batches.length ? batches.map((batch, index) => ({ batchId: batch.id, quantity: index === 0 ? body.requestedQty : 0 })) : [{ batchId: 0, quantity: body.requestedQty }] }
  }
  const response = await fetch(`${apiBase}${path}`, { method, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: response.status, data: response.status === 204 ? null : await response.json() }
}
try {
  for (let i = 0; i < 40; i++) {
    try { await fetch('http://127.0.0.1:5198/up'); break } catch { await new Promise(r => setTimeout(r, 100)) }
  }
  await vite.listen()
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => errors.push(error.message))
  assert.equal((await api(null, '/auth/register', 'POST', {})).status, 404)
  await page.goto('http://127.0.0.1:5199/#/admin/sign-in')
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor()
  await page.locator('input[name="email"]').fill('administration.manager@example.test')
  await page.locator('input[name="password"]').fill('invalid')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.locator('input[name="email"][aria-invalid="true"]').waitFor()
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('heading', { name: 'A complete view of inventory control.' }).waitFor()
  await page.goto('http://127.0.0.1:5199/#/inventory')
  await page.getByRole('button', { name: 'Add product', exact: true }).waitFor()
  const adminToken = await page.evaluate(() => sessionStorage.getItem('wba-auth-token'))
  const createdAccount = await api(adminToken, '/users', 'POST', { name: 'QA Registered', lastName: 'Member', email: 'qa.registered@example.test', department: 'Sales', roleLevel: 'Staff', password })
  assert.equal(createdAccount.status, 201)
  const registered = createdAccount.data.data
  assert.equal(registered.firstName, 'QA Registered')
  assert.equal(registered.lastName, 'Member')
  assert.equal(registered.mustChangePassword, true)
  const employee = await browser.newPage({ viewport: { width: 390, height: 900 } })
  employee.setDefaultTimeout(15000)
  employee.on('pageerror', error => errors.push(error.message))
  await employee.goto('http://127.0.0.1:5199/#/sign-in')
  await employee.locator('input[name="email"]').fill(registered.email)
  await employee.locator('input[name="password"]').fill(password)
  await employee.getByRole('button', { name: 'Sign in', exact: true }).click()
  await employee.getByRole('heading', { name: 'Set your own password' }).waitFor()
  const temporaryToken = await employee.evaluate(() => sessionStorage.getItem('wba-auth-token'))
  assert.equal((await api(temporaryToken, '/inventory')).status, 403)
  for (const [name, value] of Object.entries({ current_password: password, password: `${password}-private`, password_confirmation: `${password}-private` })) await employee.locator(`input[name="${name}"]`).fill(value)
  await employee.getByRole('button', { name: 'Save password and continue' }).click()
  await employee.getByRole('heading', { name: 'Reliable answers for every customer.', exact: true }).waitFor()
  const privateToken = await employee.evaluate(() => sessionStorage.getItem('wba-auth-token'))
  assert.equal((await api(temporaryToken, '/auth/me')).status, 401)
  await employee.reload()
  await employee.getByRole('heading', { name: 'Reliable answers for every customer.', exact: true }).waitFor()
  await employee.close()
  await page.reload()
  await page.getByRole('button', { name: 'Add product', exact: true }).waitFor()
  await page.goto('http://127.0.0.1:5199/#/users')
  await page.getByRole('row').filter({ hasText: 'QA Registered Member' }).getByRole('button', { name: 'Edit', exact: true }).click()
  assert.equal(await page.locator('input[name="name"]').inputValue(), 'QA Registered')
  assert.equal(await page.locator('input[name="lastName"]').inputValue(), 'Member')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.goto('http://127.0.0.1:5199/#/audit-trail')
  const registrationAudit = page.getByRole('row').filter({ hasText: 'User created' }).filter({ hasText: 'QA Registered Member' })
  await registrationAudit.waitFor()
  assert.match(await registrationAudit.innerText(), /QA Registered Member/)
  await page.reload()
  await registrationAudit.waitFor()
  await page.getByRole('row').filter({ hasText: 'Password changed' }).filter({ hasText: 'QA Registered Member' }).waitFor()
  await page.goto('http://127.0.0.1:5199/#/users')
  await page.getByRole('row').filter({ hasText: 'QA Registered Member' }).getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('select[name="isActive"]').selectOption('false')
  await page.getByRole('button', { name: 'Save user', exact: true }).click()
  await page.getByRole('row').filter({ hasText: 'QA Registered Member' }).getByRole('cell', { name: 'Disabled', exact: true }).waitFor()
  assert.equal((await api(privateToken, '/inventory')).status, 401)
  assert.equal((await api(null, '/auth/login', 'POST', { email: registered.email, password: `${password}-private` })).status, 422)
  await page.goto('http://127.0.0.1:5199/#/audit-trail')
  await page.getByRole('row').filter({ hasText: 'User disabled' }).filter({ hasText: 'QA Registered Member' }).waitFor()
  await page.goto('http://127.0.0.1:5199/#/inventory')
  console.log('Administrator-created account, mandatory private password, revoked temporary session, persisted names and creation audit passed.')
  await page.getByRole('button', { name: 'Add product', exact: true }).click()
  for (const [name, value] of Object.entries({ sku: 'QA-LIVE', name: 'QA Live Product', category: 'Smart Home' })) await page.locator(`input[name="${name}"]`).fill(value)
  await page.getByRole('button', { name: 'Create product', exact: true }).click()
  await page.getByRole('cell', { name: /QA Live Product/ }).waitFor()
  const token = await page.evaluate(() => sessionStorage.getItem('wba-auth-token'))
  let inventory = (await api(token, '/inventory')).data
  const product = inventory.products.find(item => item.sku === 'QA-LIVE')
  assert.ok(product)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('input[name="name"]').fill('QA Updated Product')
  await page.locator('input[name="leadTime"]').fill('7')
  await page.getByLabel('Demand classification', { exact: true }).selectOption('Seasonal-Critical')
  await page.getByRole('button', { name: 'Add sales month', exact: true }).click()
  const lastCompletedMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)).toISOString().slice(0, 7)
  await page.getByLabel('Sales month 1', { exact: true }).fill(lastCompletedMonth)
  await page.getByLabel('Sales units 1', { exact: true }).fill('60')
  await page.getByRole('button', { name: 'Add season rule', exact: true }).click()
  await page.getByLabel('Season month 1', { exact: true }).selectOption('6')
  await page.getByLabel('Multiplier 1', { exact: true }).fill('2')
  await page.getByRole('button', { name: 'Save product', exact: true }).click()
  await page.getByRole('cell', { name: /QA Updated Product/ }).waitFor()
  await page.reload()
  await page.getByRole('cell', { name: /QA Updated Product/ }).waitFor()
  await page.goto('http://127.0.0.1:5199/#/reorder-calculator')
  await page.getByLabel('Planning month', { exact: true }).fill(`${new Date().getUTCFullYear()}-06`)
  assert.equal(await page.getByLabel('Average monthly sales', { exact: true }).inputValue(), '60')
  assert.equal(await page.getByLabel('Seasonal demand multiplier', { exact: true }).inputValue(), '2')
  await page.getByLabel('Average monthly sales', { exact: true }).fill('-1')
  await page.getByRole('alert').filter({ hasText: 'nonnegative demand' }).waitFor()
  console.log('PASS: saved demand classification, completed monthly history, calendar seasonal rules, and invalid planning inputs.')
  await page.goto('http://127.0.0.1:5199/#/batches')
  await page.getByRole('button', { name: 'Add batch', exact: true }).click()
  await page.locator('input[name="number"]').fill('QA-LIVE-BATCH')
  await page.locator('input[name="quantity"]').fill('10')
  await page.getByRole('button', { name: 'Create batch', exact: true }).click()
  await page.getByRole('cell', { name: /QA-LIVE-BATCH/ }).waitFor()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('input[name="number"]').fill('QA-UPDATED-BATCH')
  await page.getByRole('button', { name: 'Save batch', exact: true }).click()
  await page.getByRole('cell', { name: /QA-UPDATED-BATCH/ }).waitFor()
  inventory = (await api(token, '/inventory')).data
  const batch = inventory.batches[0]
  assert.equal(inventory.products[0].stock, 10)
  for (const [path, button, quantity] of [['stock-in', 'Record stock in', 2], ['stock-out', 'Complete stock out', 1], ['transfers', 'Record transfer', 1], ['returns', 'Process return', 1]]) {
    await page.goto(`http://127.0.0.1:5199/#/${path}`)
    await page.locator('select[name="productId"]').selectOption(String(product.id))
    await page.locator('select[name="batchId"]').selectOption(String(batch.id))
    await page.locator('input[name="quantity"]').fill(String(quantity))
    await page.locator('input[name="reference"]').fill(`QA ${path}`)
    if (path === 'transfers') await page.locator('input[name="destinationLocation"]').fill('QA Rack B')
    if (path === 'returns') await page.locator('select[name="returnCondition"]').selectOption('Resaleable')
    await page.getByRole('button', { name: button, exact: true }).click()
    await page.locator('select[name="productId"]').waitFor()
    await page.waitForFunction(() => document.querySelector('select[name="productId"]').value === '')
  }
  assert.equal((await api(token, '/inventory')).data.transactions.length, 5)
  assert.equal((await api(token, '/inventory')).data.products[0].stock, 12)
  await page.goto('http://127.0.0.1:5199/#/cycle-count')
  const countSnapshot = (await api(token, '/inventory')).data
  for (const entry of countSnapshot.batches) await page.getByLabel(`${entry.number} · ${entry.location}`, { exact: true }).fill(entry.id === batch.id ? '8' : '1')
  await page.getByRole('button', { name: 'Submit count result' }).click()
  await page.locator('.success-note').waitFor()
  const adjustment = (await api(token, '/inventory')).data.adjustments[0]
  for (const approved of [true,false]) assert.equal((await api(token, `/inventory/adjustments/${adjustment.id}/review`, 'POST', { approved })).status, 422)
  assert.equal((await api(token, '/inventory/movements', 'POST', { type:'Stock Out', productId:product.id, batchId:batch.id, quantity:999, reference:'QA invalid quantity' })).status,422)
  const roles = [['Warehouse','Staff',false],['Warehouse','Supervisor',true],['Warehouse','Manager',true],['Sales','Staff',false],['Sales','Supervisor',false],['Purchasing','Staff',false],['Purchasing','Manager',true],['Administration','Manager',true]]
  for (const [department, level, reviewer] of roles) {
    const credentials = { email: department === 'Administration' ? 'administration.reviewer@example.test' : `${department}.${level}@example.test`.toLowerCase(), password }
    const wrongPortal = department === 'Administration' ? '/auth/login' : '/auth/admin/login'
    assert.equal((await api(null, wrongPortal, 'POST', credentials)).status, 403)
    const login = await api(null, department === 'Administration' ? '/auth/admin/login' : '/auth/login', 'POST', { email: department === 'Administration' ? 'administration.reviewer@example.test' : `${department}.${level}@example.test`.toLowerCase(), password })
    assert.equal(login.status, 200)
    assert.equal((await api(login.data.token, department === 'Administration' ? '/staff/overview' : '/admin/overview')).status, 403)
    for (const approved of [true, false]) {
      const pending = await api(token, '/inventory/adjustments', 'POST', { productId: product.id, requestedQty: 9, reason: 'QA review matrix' })
      const reviewed = await api(login.data.token, `/inventory/adjustments/${pending.data.data.id}/review`, 'POST', { approved })
      assert.equal(reviewed.status, reviewer ? 200 : 403)
    }

    const manage = department === 'Administration' || (department === 'Warehouse' && level !== 'Staff')
    const payload = { sku: `QA-${department}-${level}`, name: 'Role matrix product', category: 'QA', stock: 0, reorderPoint: 0, leadTime: 0, unit: 'units', monthlySales: 0 }
    const created = await api(login.data.token, '/products', 'POST', payload)
    assert.equal(created.status, manage ? 201 : 403)
    const targetId = manage ? created.data.data.id : product.id
    assert.equal((await api(login.data.token, `/products/${targetId}`, 'PUT', payload)).status, manage ? 200 : 403)
    const createdBatch = await api(login.data.token, '/batches', 'POST', { productId: targetId, number: `QA-${department}-${level}`, quantity: 0, receivedAt: '2026-10-11' })
    assert.equal(createdBatch.status, manage ? 201 : 403)
    const targetBatch = manage ? createdBatch.data.data.id : batch.id
    assert.equal((await api(login.data.token, `/batches/${targetBatch}`, 'PUT', { number: `QA-edited-${department}-${level}`, receivedAt: '2026-10-11' })).status, manage ? 200 : 403)
    assert.equal((await api(login.data.token, `/batches/${targetBatch}`, 'DELETE')).status, manage ? 204 : 403)
    assert.equal((await api(login.data.token, `/products/${targetId}`, 'DELETE')).status, manage ? 204 : 403)
    for (const type of ['Stock In','Stock Out','Transfer','Return']) {
      const allowed = department === 'Warehouse' || department === 'Administration' || (department === 'Sales' && type === 'Stock Out')
      assert.equal((await api(login.data.token, '/inventory/movements', 'POST', { type, productId: product.id, batchId: batch.id, quantity: 1, reference: 'QA matrix', ...(type === 'Transfer' ? { destinationLocation: 'QA Rack B' } : {}), ...(type === 'Return' ? { returnCondition: 'Resaleable' } : {}) })).status, allowed ? 201 : 403)
    }
    assert.equal((await api(login.data.token, '/inventory/adjustments', 'POST', { productId: product.id, requestedQty: 9, reason: 'QA request matrix' })).status, ['Warehouse','Administration'].includes(department) ? 201 : 403)
    if (department !== 'Administration') assert.equal((await api(login.data.token, '/users')).status, 403)
  }
  await page.goto('http://127.0.0.1:5199/#/users')
  await page.getByRole('button', { name: 'Add user', exact: true }).click()
  for (const [name, value] of Object.entries({ name: 'QA Temporary', lastName: 'User', email: 'qa.temp@example.test', password })) await page.locator(`input[name="${name}"]`).fill(value)
  await page.getByRole('button', { name: 'Create user', exact: true }).click()
  const row = page.getByRole('row').filter({ hasText: 'QA Temporary User' })
  await row.waitFor()
  await row.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('input[name="name"]').fill('QA Edited')
  await page.locator('select[name="department"]').selectOption('Sales')
  await page.locator('select[name="roleLevel"]').selectOption('Supervisor')
  await page.getByRole('button', { name: 'Save user', exact: true }).click()
  const edited = page.getByRole('row').filter({ hasText: 'QA Edited User' })
  await edited.waitFor()
  const updatedUser = (await api(token, '/users')).data.data.find(item=>item.email==='qa.temp@example.test')
  assert.equal(updatedUser.department,'Sales')
  assert.equal(updatedUser.roleLevel,'Supervisor')
  await edited.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete user', exact: true }).click()
  await edited.waitFor({ state: 'detached' })
  // Successful deletes use clean records; history deletion restrictions are checked separately.
  const clean = await api(token, '/products', 'POST', { sku: 'QA-DELETE', name: 'Delete QA', category: 'QA', stock: 0, reorderPoint: 0, leadTime: 0, unit: 'units', monthlySales: 0 })
  assert.equal(clean.status, 201)
  const empty = await api(token, '/batches', 'POST', { productId: clean.data.data.id, number: 'QA-EMPTY', quantity: 0, receivedAt: '2026-10-11' })
  assert.equal(empty.status, 201)
  assert.equal((await api(token, `/batches/${empty.data.data.id}`, 'DELETE')).status, 204)
  assert.equal((await api(token, `/products/${clean.data.data.id}`, 'DELETE')).status, 204)
  assert.equal((await api(token, `/products/${product.id}`, 'DELETE')).status, 422)
  assert.equal((await api(token, `/batches/${batch.id}`, 'DELETE')).status, 422)
  assert.equal((await api(token, '/products/99999', 'PUT', {})).status, 404)
  await page.goto('http://127.0.0.1:5199/#/trash')
  await page.getByRole('heading', { name: 'Delete QA', exact: true }).waitFor()
  await page.locator('.workspace-record').filter({ has: page.getByRole('heading', { name: 'Delete QA', exact: true }) }).getByRole('button', { name: 'Restore', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Restore record', exact: true }).click()
  await page.getByRole('heading', { name: 'Delete QA', exact: true }).waitFor({ state: 'detached' })
  assert.ok((await api(token, '/inventory')).data.products.some(item => item.id === clean.data.data.id))
  await page.getByLabel('Record type').selectOption('users')
  await page.getByRole('heading', { name: 'QA Edited User', exact: true }).waitFor()
  await page.locator('.workspace-record').filter({ has: page.getByRole('heading', { name: 'QA Edited User', exact: true }) }).getByRole('button', { name: 'Restore', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Restore record', exact: true }).click()
  await page.getByRole('heading', { name: 'QA Edited User', exact: true }).waitFor({ state: 'detached' })
  assert.equal((await api(token, '/users')).data.data.find(item => item.id === updatedUser.id).isActive, false)
  await page.goto('http://127.0.0.1:5199/#/notifications')
  await page.getByRole('button', { name: 'Mark all as read', exact: true }).click()
  await page.getByLabel('Notifications, 0 unread', { exact: true }).waitFor()
  await page.reload();await page.getByRole('heading', { name: 'Notifications', exact: true, level: 2 }).waitFor()
  assert.equal((await api(token, '/notifications')).data.unreadCount, 0)
  console.log('PASS: real trash restoration, restored account stays disabled, and notification read state persists after reload.')
  const loggedOut = page.waitForResponse(response => response.url().endsWith('/auth/logout'))
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  assert.equal((await loggedOut).status(), 204)
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor()
  assert.equal((await api(token, '/auth/me')).status, 401)
  assert.deepEqual(errors, [])
  console.log('PASS: real Laravel login, session restore, product/batch/user CRUD, all movement types, cycle count, review role matrix, self-review, history restrictions, 404, logout and token revocation.')
} finally {
  if (browser) await browser.close()
  await vite.close()
  php.kill()
  console.log('Disposable QA fixtures retained in the system temporary directory; team database was not used.')
}
