/** Landing auth on :3000, panel on :5173 in local dev; same origin in production. */
import { DEV_PORTS } from '@/config/site'

function isDevPanel(): boolean {
  return window.location.port === DEV_PORTS.panel
}

function landingUrl(page: 'login' | 'register'): string {
  const { protocol, hostname, port } = window.location

  // Local panel → landing :3000
  if (port === DEV_PORTS.panel) {
    return `${protocol}//${hostname}:${DEV_PORTS.landing}/${page}`
  }

  // Production: same origin (propcount.ru, :3001, IP, etc.)
  return `/${page}`
}

export function getLandingLoginUrl(): string {
  return landingUrl('login')
}

export function getLandingRegisterUrl(): string {
  return landingUrl('register')
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

export function isDevPanelHost(): boolean {
  return isDevPanel()
}
