export const roleHome = (role) => ({
  doctor: '/doctor/dashboard', receptionist: '/reception', admin: '/reception', patient: '/dashboard',
}[role] || '/login');

export function logout() {
  ['accessToken', 'refreshToken', 'userRole'].forEach((key) => localStorage.removeItem(key));
}
