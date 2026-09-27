function initParticles() {
  const el = document.getElementById('particles-auth')
  if (!el || typeof tsParticles === 'undefined') return

  tsParticles.load('particles-auth', {
    fullScreen: { enable: false },
    background: { color: 'transparent' },
    particles: {
      number: { value: 40, density: { enable: true, area: 800 } },
      color: { value: ['#14b8a6', '#f59e0b', '#64748b'] },
      opacity: { value: { min: 0.1, max: 0.35 } },
      size: { value: { min: 1, max: 3 } },
      move: { enable: true, speed: 0.6, direction: 'none', random: true },
      links: { enable: true, distance: 120, opacity: 0.12, color: '#14b8a6' },
    },
    detectRetina: true,
  })
}

function togglePassword(btn) {
  const input = btn.closest('.field-control')?.querySelector('input')
    || btn.closest('.field-group')?.querySelector('input')
  if (!input) return
  const isPassword = input.type === 'password'
  input.type = isPassword ? 'text' : 'password'
  if (typeof feather !== 'undefined') {
    btn.innerHTML = `<i data-feather="${isPassword ? 'eye-off' : 'eye'}"></i>`
    feather.replace()
  }
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getPasswordStrength(password) {
  if (!password) return { level: 0, label: '' }
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (score <= 2) return { level: 1, label: 'Слабый', class: 'strength-weak' }
  if (score <= 4) return { level: 2, label: 'Средний', class: 'strength-medium' }
  return { level: 3, label: 'Сильный', class: 'strength-strong' }
}

function showFieldError(input, message) {
  input.classList.add('error')
  input.closest('.field-control')?.classList.add('is-error')
  const err = input.closest('.field-group')?.querySelector('.field-error')
  if (err) err.textContent = message
}

function clearFieldError(input) {
  input.classList.remove('error')
  input.closest('.field-control')?.classList.remove('is-error')
  const err = input.closest('.field-group')?.querySelector('.field-error')
  if (err) err.textContent = ''
}

function initPasswordStrength(root = document) {
  const passwordInput = root.querySelector('#password') || root.querySelector('[name="password"]')
  const bar = root.querySelector('.strength-bar')
  const fill = root.querySelector('.strength-fill')
  const label = root.querySelector('.strength-label')
  if (!passwordInput || !fill) return

  passwordInput.addEventListener('input', () => {
    const value = passwordInput.value
    const { label: text, class: cls } = getPasswordStrength(value)
    fill.className = 'strength-fill ' + (cls || '')
    if (bar) bar.classList.toggle('is-active', Boolean(value))
    if (label) label.textContent = value ? text : ''
  })
}

function apiBase() {
  const raw = window.PROPCOUNT_API
  if (raw == null || raw === '') return ''
  return String(raw).replace(/\/$/, '')
}

function parseApiError(payload, fallback) {
  if (!payload) return fallback
  if (typeof payload === 'string') return payload
  const detail = payload.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((item) => item?.msg || '').filter(Boolean).join('. ') || fallback
  }
  return payload.message || fallback
}

function ApiClientError(message, status, body) {
  const err = new Error(message)
  err.status = status
  err.body = body
  return err
}

function validationLocs(body) {
  const detail = body && typeof body === 'object' ? body.detail : null
  if (!Array.isArray(detail)) return []
  return detail.flatMap((item) => (Array.isArray(item?.loc) ? item.loc.map(String) : []))
}

function isMissingField(body, field) {
  return validationLocs(body).includes(field)
}

function isUnverifiedError(message) {
  return /подтвержд|verify|verif|не подтвержд|email not confirmed|confirm your email|код с почт/i.test(message || '')
}

function isAuthSession(data) {
  return Boolean(data && typeof data === 'object' && data.access_token && data.user)
}

function pendingEmailKey() {
  return 'propcount-pending-email'
}

function savePendingEmail(email) {
  sessionStorage.setItem(pendingEmailKey(), email)
}

function readPendingEmail() {
  const params = new URLSearchParams(window.location.search)
  return (params.get('email') || sessionStorage.getItem(pendingEmailKey()) || '').trim()
}

function normalizeCode(value) {
  return String(value || '').replace(/\s+/g, '').trim()
}

async function apiPost(path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw ApiClientError(parseApiError(data, `Ошибка ${res.status}`), res.status, data)
  return data
}

async function apiPostFirstPath(paths, body) {
  let last = null
  for (const path of paths) {
    try {
      return await apiPost(path, body)
    } catch (err) {
      last = err
      if (err.status === 404 || err.status === 405) continue
      throw err
    }
  }
  throw last || ApiClientError('Не удалось выполнить запрос', 0, null)
}

function verifyEmail(email, code) {
  return apiPostFirstPath(
    ['/auth/verify-email', '/auth/confirm-email', '/auth/verify'],
    { email, code },
  )
}

function resendCode(email) {
  return apiPostFirstPath(
    ['/auth/resend-code', '/auth/resend-verification', '/auth/verify-email/resend'],
    { email },
  )
}

async function resetPassword(email, code, password, passwordConfirm) {
  const base = { password, password_confirm: passwordConfirm }
  try {
    return await apiPost('/auth/reset-password', { ...base, email, code, token: code })
  } catch (err) {
    if (err.status !== 422) throw err
    if (isMissingField(err.body, 'token') && !isMissingField(err.body, 'code')) {
      return apiPost('/auth/reset-password', { ...base, token: code })
    }
    if (isMissingField(err.body, 'code')) {
      return apiPost('/auth/reset-password', { ...base, email, code })
    }
    try {
      return await apiPost('/auth/reset-password', { ...base, token: code })
    } catch (retry) {
      if (retry.status !== 422) throw retry
      return apiPost('/auth/reset-password', { ...base, email, code })
    }
  }
}

async function apiPatch(path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(parseApiError(data, `Ошибка ${res.status}`))
  return data
}

function setButtonLoading(btn, loading) {
  if (!btn.dataset.label) btn.dataset.label = btn.textContent
  btn.disabled = loading
  btn.innerHTML = loading
    ? '<svg class="spin" width="20" height="20" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>'
    : btn.dataset.label
}

function showFormError(form, message) {
  let el = form.querySelector('[data-form-error]')
  if (!el) {
    el = document.createElement('p')
    el.dataset.formError = '1'
    el.className = 'field-error'
    el.style.display = 'block'
    form.querySelector('[type="submit"]')?.before(el)
  }
  el.textContent = message || ''
}

/** Панель: локально :5173, в проде — /panel/ на том же origin */
function redirectToPanel(session, options = {}) {
  const user = session.user || {}
  const params = new URLSearchParams({ autologin: '1', email: user.email || '' })
  if (user.name) params.set('name', user.name)
  if (session.access_token) params.set('access_token', session.access_token)
  if (session.refresh_token) params.set('refresh_token', session.refresh_token)
  params.set('chooseRole', '1')
  if (options.mode) params.set('mode', options.mode)

  const { protocol, hostname, port } = window.location
  const panelUrl = port === '3000'
    ? `${protocol}//${hostname}:5173/?${params}`
    : `/panel/?${params}`

  window.location.href = panelUrl
}

function afterAuth(session, mode) {
  redirectToPanel(session, { mode })
}

function showAuthPanel(name) {
  const panels = document.querySelectorAll('[data-auth-panel]')
  if (!panels.length) return false
  let found = false
  panels.forEach((el) => {
    const match = el.dataset.authPanel === name
    if (match) found = true
    el.hidden = !match
  })
  if (found && typeof feather !== 'undefined') feather.replace()
  return found
}

function fillFormEmail(form, email) {
  const input = form?.querySelector('[name="email"]') || form?.querySelector('#email')
  if (input && email) input.value = email
}

function openVerifyStep(email) {
  savePendingEmail(email)
  const form = document.getElementById('verify-email-form')
  fillFormEmail(form, email)
  if (showAuthPanel('verify')) {
    form?.querySelector('[name="code"]')?.focus()
    return true
  }
  window.location.href = `/verify-email.html?email=${encodeURIComponent(email)}`
  return false
}

function openResetStep(email) {
  savePendingEmail(email)
  const form = document.getElementById('reset-password-form')
  fillFormEmail(form, email)
  if (showAuthPanel('reset')) {
    form?.querySelector('[name="code"]')?.focus()
    return true
  }
  window.location.href = `/reset-password.html?email=${encodeURIComponent(email)}`
  return false
}

function initAuthPanelNav() {
  document.querySelectorAll('[data-auth-back]').forEach((btn) => {
    btn.addEventListener('click', () => showAuthPanel(btn.getAttribute('data-auth-back')))
  })
}

function initLoginForm() {
  const form = document.getElementById('login-form')
  if (!form) return

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    let valid = true
    const email = form.querySelector('[name="email"]')
    const password = form.querySelector('[name="password"]')
    showFormError(form, '')
    clearFieldError(email)
    clearFieldError(password)

    if (!validateEmail(email.value)) {
      showFieldError(email, 'Введите корректный email')
      valid = false
    }
    if (password.value.length < 8) {
      showFieldError(password, 'Минимум 8 символов')
      valid = false
    }
    if (!valid) return

    const btn = form.querySelector('[type="submit"]')
    setButtonLoading(btn, true)
    try {
      const session = await apiPost('/auth/login', {
        email: email.value.trim(),
        password: password.value,
      })
      afterAuth(session, 'login')
    } catch (err) {
      const message = err.message || 'Не удалось войти'
      if (isUnverifiedError(message)) {
        openVerifyStep(email.value.trim())
        setButtonLoading(btn, false)
        return
      }
      showFormError(form, message)
      setButtonLoading(btn, false)
    }
  })
}

function initRegisterForm() {
  const form = document.getElementById('register-form')
  if (!form) return

  initPasswordStrength(form)

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    let valid = true
    const name = form.querySelector('[name="name"]')
    const email = form.querySelector('[name="email"]')
    const password = form.querySelector('[name="password"]')
    const confirm = form.querySelector('[name="password_confirm"]')
    const terms = form.querySelector('[name="terms"]')
    showFormError(form, '')

    ;[name, email, password, confirm].forEach(clearFieldError)

    if (name.value.trim().length < 2) {
      showFieldError(name, 'Введите полное имя')
      valid = false
    }
    if (!validateEmail(email.value)) {
      showFieldError(email, 'Введите корректный email')
      valid = false
    }
    if (password.value.length < 8) {
      showFieldError(password, 'Минимум 8 символов')
      valid = false
    }
    if (password.value !== confirm.value) {
      showFieldError(confirm, 'Пароли не совпадают')
      valid = false
    }
    if (!terms.checked) {
      showFormError(form, 'Примите условия использования')
      valid = false
    }
    if (!valid) return

    const btn = form.querySelector('[type="submit"]')
    setButtonLoading(btn, true)
    try {
      await apiPost('/auth/register', {
        name: name.value.trim(),
        email: email.value.trim(),
        password: password.value,
        password_confirm: confirm.value,
        terms: true,
      })
      openVerifyStep(email.value.trim())
      setButtonLoading(btn, false)
    } catch (err) {
      const message = err.message || 'Не удалось зарегистрироваться'
      if (isUnverifiedError(message)) {
        openVerifyStep(email.value.trim())
        setButtonLoading(btn, false)
        return
      }
      showFormError(form, message)
      setButtonLoading(btn, false)
    }
  })
}

function startResendCooldown(button, seconds) {
  if (!button) return
  let left = seconds
  const label = button.dataset.label || button.textContent
  button.dataset.label = label
  button.disabled = true
  const tick = () => {
    if (left <= 0) {
      button.disabled = false
      button.textContent = label
      return
    }
    button.textContent = `Отправить снова (${left} с)`
    left -= 1
    window.setTimeout(tick, 1000)
  }
  tick()
}

function initVerifyEmailForm() {
  const form = document.getElementById('verify-email-form')
  if (!form) return

  const emailInput = form.querySelector('[name="email"]') || form.querySelector('#email')
  const codeInput = form.querySelector('[name="code"]') || form.querySelector('#code')
  const resendBtn = document.querySelector('[data-resend-code]')
  const email = readPendingEmail()
  fillFormEmail(form, email)
  const params = new URLSearchParams(window.location.search)
  const presetCode = normalizeCode(params.get('code') || '')
  if (codeInput && presetCode) codeInput.value = presetCode

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    showFormError(form, '')
    const mail = (emailInput?.value || '').trim()
    const code = normalizeCode(codeInput?.value)
    let valid = true
    if (emailInput) clearFieldError(emailInput)
    if (codeInput) clearFieldError(codeInput)
    if (!validateEmail(mail)) {
      if (emailInput) showFieldError(emailInput, 'Введите корректный email')
      valid = false
    }
    if (code.length < 4) {
      if (codeInput) showFieldError(codeInput, 'Введите код из письма')
      valid = false
    }
    if (!valid) return

    const btn = form.querySelector('[type="submit"]')
    setButtonLoading(btn, true)
    try {
      const data = await verifyEmail(mail, code)
      savePendingEmail(mail)
      if (isAuthSession(data)) {
        afterAuth(data, 'register')
        return
      }
      if (showAuthPanel('login')) {
        const banner = document.querySelector('[data-auth-banner]')
        if (banner) banner.textContent = 'Почта подтверждена. Войдите в аккаунт.'
        setButtonLoading(btn, false)
        return
      }
      window.location.href = '/login.html?verified=1'
    } catch (err) {
      showFormError(form, err.message || 'Неверный или просроченный код')
      setButtonLoading(btn, false)
    }
  })

  resendBtn?.addEventListener('click', async () => {
    const mail = (emailInput?.value || '').trim()
    showFormError(form, '')
    if (!validateEmail(mail)) {
      if (emailInput) showFieldError(emailInput, 'Введите корректный email')
      return
    }
    resendBtn.disabled = true
    try {
      await resendCode(mail)
      const hint = form.querySelector('[data-resend-ok]')
      if (hint) {
        hint.hidden = false
        hint.textContent = 'Новый код отправлен на почту'
      }
      startResendCooldown(resendBtn, 45)
    } catch (err) {
      showFormError(form, err.message || 'Не удалось отправить код повторно')
      resendBtn.disabled = false
    }
  })
}

function initForgotPasswordForm() {
  const form = document.getElementById('forgot-password-form')
  const trigger = document.querySelector('[data-forgot-password]')
  if (trigger) {
    trigger.addEventListener('click', (e) => {
      e.preventDefault()
      const loginEmail = document.querySelector('#login-form [name="email"]')?.value?.trim()
      fillFormEmail(form, loginEmail || readPendingEmail())
      if (!showAuthPanel('forgot')) {
        window.location.href = '/forgot-password.html'
      }
    })
  }
  if (!form) return

  const emailInput = form.querySelector('[name="email"]') || form.querySelector('#email')
  fillFormEmail(form, readPendingEmail())

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    showFormError(form, '')
    const email = (emailInput?.value || '').trim()
    clearFieldError(emailInput)
    if (!validateEmail(email)) {
      showFieldError(emailInput, 'Введите корректный email')
      return
    }
    const btn = form.querySelector('[type="submit"]')
    setButtonLoading(btn, true)
    try {
      await apiPost('/auth/forgot-password', { email })
      openResetStep(email)
      setButtonLoading(btn, false)
    } catch (err) {
      showFormError(form, err.message || 'Не удалось отправить код')
      setButtonLoading(btn, false)
    }
  })
}

function initResetPasswordForm() {
  const form = document.getElementById('reset-password-form')
  if (!form) return

  initPasswordStrength(form)
  const emailInput = form.querySelector('[name="email"]') || form.querySelector('#email')
  const codeInput = form.querySelector('[name="code"]') || form.querySelector('#code')
  const password = form.querySelector('[name="password"]') || form.querySelector('#password')
  const confirm = form.querySelector('[name="password_confirm"]') || form.querySelector('#password-confirm')
  const params = new URLSearchParams(window.location.search)
  fillFormEmail(form, readPendingEmail())
  const presetCode = normalizeCode(params.get('code') || params.get('token') || '')
  if (codeInput && presetCode) codeInput.value = presetCode

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    showFormError(form, '')
    ;[emailInput, codeInput, password, confirm].forEach(clearFieldError)
    let valid = true
    const mail = (emailInput?.value || '').trim()
    const code = normalizeCode(codeInput?.value)
    if (!validateEmail(mail)) {
      showFieldError(emailInput, 'Введите корректный email')
      valid = false
    }
    if (code.length < 4) {
      showFieldError(codeInput, 'Введите код из письма')
      valid = false
    }
    if (password.value.length < 8) {
      showFieldError(password, 'Минимум 8 символов')
      valid = false
    }
    if (password.value !== confirm.value) {
      showFieldError(confirm, 'Пароли не совпадают')
      valid = false
    }
    if (!valid) return

    const btn = form.querySelector('[type="submit"]')
    setButtonLoading(btn, true)
    try {
      await resetPassword(mail, code, password.value, confirm.value)
      if (showAuthPanel('login')) {
        const banner = document.querySelector('[data-auth-banner]')
        if (banner) banner.textContent = 'Пароль обновлён. Войдите с новым паролем.'
        setButtonLoading(btn, false)
        return
      }
      window.location.href = '/login.html?reset=1'
    } catch (err) {
      showFormError(form, err.message || 'Не удалось сменить пароль')
      setButtonLoading(btn, false)
    }
  })
}

function initAuthBanners() {
  const params = new URLSearchParams(window.location.search)
  const banner = document.querySelector('[data-auth-banner]')
  if (!banner) return
  if (params.get('verified') === '1') banner.textContent = 'Почта подтверждена. Войдите в аккаунт.'
  else if (params.get('reset') === '1') banner.textContent = 'Пароль обновлён. Войдите с новым паролем.'
  else banner.remove()
}

function initOauth() {
  document.querySelectorAll('[data-oauth]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const provider = btn.getAttribute('data-oauth')
      if (provider === 'google' || provider === 'apple') {
        window.location.href = `${apiBase()}/auth/${provider}`
      }
    })
  })
}

document.addEventListener('DOMContentLoaded', () => {
  initAuthBanners()
  initAuthPanelNav()
  initLoginForm()
  initRegisterForm()
  initVerifyEmailForm()
  initForgotPasswordForm()
  initResetPasswordForm()
  initOauth()

  document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
    btn.addEventListener('click', () => togglePassword(btn))
  })

  if (typeof feather !== 'undefined') feather.replace()
})

window.togglePassword = togglePassword
