export const accountPortal = user => user?.department === 'Administration' && user?.roleLevel === 'Manager' ? 'admin' : 'staff'
export const dashboardPath = user => `/${accountPortal(user)}/dashboard`
export const signInPath = portal => portal === 'admin' ? '/admin/sign-in' : '/sign-in'
export const savedPortal = () => sessionStorage.getItem('wba-auth-portal') === 'admin' ? 'admin' : 'staff'
