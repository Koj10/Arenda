/** Landing auth lives on port 3000; panel on 5173. */

function landingUrl(page: 'login.html' | 'register.html'): string {
  const { protocol, hostname, port } = window.location
  if (port === '5173' || port === '') {
    return `${protocol}//${hostname}:3000/${page}`
  }
  return `../landing/${page}`
}

export function getLandingLoginUrl(): string {
  return landingUrl('login.html')
}

export function getLandingRegisterUrl(): string {
  return landingUrl('register.html')
}

export function redirectToLandingLogin(): void {
  window.location.href = getLandingLoginUrl()
}

export function redirectToLandingRegister(): void {
  window.location.href = getLandingRegisterUrl()
}

export function redirectToLandingAuth(mode: 'login' | 'register' = 'login'): void {
  window.location.href = mode === 'register' ? getLandingRegisterUrl() : getLandingLoginUrl()
}
