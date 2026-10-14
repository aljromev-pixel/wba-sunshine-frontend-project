export const PERMISSIONS = {
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_EDIT: 'inventory.edit',
  INVENTORY_DELETE: 'inventory.delete',
  STOCK_IN: 'stock.in',
  STOCK_OUT: 'stock.out',
  TRANSFER_CREATE: 'transfer.create',
  RETURNS_CREATE: 'returns.create',
  FIFO_VIEW: 'fifo.view',
  CYCLE_COUNT: 'cycle_count.create',
  ADJUSTMENT_REQUEST: 'adjustment.request',
  ADJUSTMENT_APPROVE: 'adjustment.approve',
  REORDER_CALCULATE: 'reorder.calculate',
  REPORTS_VIEW: 'reports.view',
  AUDIT_VIEW: 'audit.view',
  USERS_MANAGE: 'users.manage',
  ALERTS_VIEW: 'alerts.view',
}

const all = Object.values(PERMISSIONS)
const warehouseStaff = [
  PERMISSIONS.INVENTORY_VIEW,
  PERMISSIONS.STOCK_IN,
  PERMISSIONS.STOCK_OUT,
  PERMISSIONS.TRANSFER_CREATE,
  PERMISSIONS.RETURNS_CREATE,
  PERMISSIONS.FIFO_VIEW,
  PERMISSIONS.CYCLE_COUNT,
  PERMISSIONS.ADJUSTMENT_REQUEST,
  PERMISSIONS.ALERTS_VIEW,
]
const salesStaff = [PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.STOCK_OUT, PERMISSIONS.ALERTS_VIEW]
const purchasingStaff = [
  PERMISSIONS.INVENTORY_VIEW,
  PERMISSIONS.FIFO_VIEW,
  PERMISSIONS.REORDER_CALCULATE,
  PERMISSIONS.ALERTS_VIEW,
]

export const permissionMatrix = {
  'Warehouse:Staff': warehouseStaff,
  'Warehouse:Supervisor': [
    ...warehouseStaff,
    PERMISSIONS.INVENTORY_EDIT,
    PERMISSIONS.INVENTORY_DELETE,
    PERMISSIONS.ADJUSTMENT_APPROVE,
    PERMISSIONS.AUDIT_VIEW,
  ],
  'Warehouse:Manager': [
    ...warehouseStaff,
    PERMISSIONS.INVENTORY_EDIT,
    PERMISSIONS.INVENTORY_DELETE,
    PERMISSIONS.ADJUSTMENT_APPROVE,
    PERMISSIONS.AUDIT_VIEW,
  ],
  'Sales:Staff': salesStaff,
  'Sales:Supervisor': [...salesStaff, PERMISSIONS.AUDIT_VIEW],
  'Purchasing:Staff': purchasingStaff,
  'Purchasing:Manager': [
    ...purchasingStaff,
    PERMISSIONS.INVENTORY_EDIT,
    PERMISSIONS.ADJUSTMENT_APPROVE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.AUDIT_VIEW,
  ],
  'Administration:Manager': all,
}

export const userPermissions = (user) => permissionMatrix[`${user?.department}:${user?.roleLevel}`] || []
export const can = (user, permission) => userPermissions(user).includes(permission)

export const roleLevelsForDepartment = (department) => Object.keys(permissionMatrix)
  .filter((role) => role.startsWith(`${department}:`))
  .map((role) => role.split(':')[1])
