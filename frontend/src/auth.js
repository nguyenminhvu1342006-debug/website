// Remove credentials from the old browser-wide storage. Sessions now belong to a tab.
['accessToken', 'refreshToken', 'userRole'].forEach((key) => localStorage.removeItem(key));

export const roleHome = (role) => ({
  doctor: '/doctor/dashboard', receptionist: '/reception', admin: '/reception', patient: '/dashboard',
}[role] || '/login');

export function logout() {
  ['accessToken', 'refreshToken', 'userRole'].forEach((key) => sessionStorage.removeItem(key));
}
