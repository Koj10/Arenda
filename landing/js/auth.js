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

function initPasswordStrength() {
  const passwordInput = document.getElementById('password')
  const bar = document.querySelector('.strength-bar')
  const fill = document.querySelector('.strength-fill')
  const label = document.querySelector('.strength-label')
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

function throwApiError(res, data) {
  const fallback = res.status === 409
    ? 'Этот email уже зарегистрирован. Войдите или восстановите пароль.'
    : `Ошибка ${res.status}`
  const err = new Error(parseApiError(data, fallback))
  err.status = res.status
  err.body = data
  throw err
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
  if (!res.ok) throwApiError(res, data)
  return data
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
  if (!res.ok) throwApiError(res, data)
  return data
}

function queryParam(name) {
  return new URLSearchParams(window.location.search).get(name) || ''
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
  const role = options.role || session.current_role || ''
  const chooseRole = options.chooseRole === false ? false : options.chooseRole === true ? true : !role
  const params = new URLSearchParams({ autologin: '1', email: user.email || '' })
  if (user.name) params.set('name', user.name)
  if (session.access_token) params.set('access_token', session.access_token)
  if (session.refresh_token) params.set('refresh_token', session.refresh_token)
  if (chooseRole) params.set('chooseRole', '1')
  else if (role) params.set('role', role)
  if (options.mode) params.set('mode', options.mode)

  const { protocol, hostname, port } = window.location
  const panelUrl = port === '3000'
    ? `${protocol}//${hostname}:5173/?${params}`
    : `/panel/?${params}`

  window.location.href = panelUrl
}

function afterAuth(session, mode) {
  const role = session.current_role || ''
  redirectToPanel(session, { mode, role, chooseRole: !role })
}

const PENDING_VERIFY_KEY = 'propcount-await-verify'
const UNVERIFIED_KEY = 'propcount-unverified-emails'

const codeModalState = {
  mode: 'register',
  step: 'code',
  email: '',
  pendingSession: null,
  pendingPassword: '',
  resetToken: '',
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function unverifiedEmails() {
  try {
    const raw = JSON.parse(localStorage.getItem(UNVERIFIED_KEY) || '[]')
    return Array.isArray(raw) ? raw.map(normalizeEmail).filter(Boolean) : []
  } catch {
    return []
  }
}

function markUnverified(email) {
  const value = normalizeEmail(email)
  if (!value) return
  sessionStorage.setItem(PENDING_VERIFY_KEY, value)
  localStorage.setItem(UNVERIFIED_KEY, JSON.stringify([...new Set([...unverifiedEmails(), value])]))
}

function clearUnverified(email) {
  const value = normalizeEmail(email)
  if (sessionStorage.getItem(PENDING_VERIFY_KEY) === value) sessionStorage.removeItem(PENDING_VERIFY_KEY)
  localStorage.setItem(UNVERIFIED_KEY, JSON.stringify(unverifiedEmails().filter((item) => item !== value)))
}

function isUnverified(email) {
  const value = normalizeEmail(email)
  if (!value) return false
  return sessionStorage.getItem(PENDING_VERIFY_KEY) === value || unverifiedEmails().includes(value)
}

function isVerifyCode(value) {
  return /^\d{6}$/.test(String(value || '').trim())
}

async function confirmEmail(email, code) {
  return apiPost('/auth/verify-email', { email: normalizeEmail(email), code: String(code).trim() })
}

async function resendVerification(email) {
  await apiPost('/auth/resend-verification', { email: normalizeEmail(email) })
}

function bindCodeModal(root) {
  if (!root || root.dataset.bound === '1') return
  root.dataset.bound = '1'

  const form = document.getElementById('auth-code-form')
  const passwordInput = document.getElementById('auth-code-password')
  const fill = root.querySelector('[data-code-modal-passwords] .strength-fill')
  const bar = root.querySelector('[data-code-modal-passwords] .strength-bar')
  const label = root.querySelector('[data-code-modal-passwords] .strength-label')

  root.querySelectorAll('[data-code-modal-close]').forEach((el) => {
    el.addEventListener('click', closeCodeModal)
  })

  passwordInput?.addEventListener('input', () => {
    const value = passwordInput.value
    const { label: text, class: cls } = getPasswordStrength(value)
    if (fill) fill.className = 'strength-fill ' + (cls || '')
    if (bar) bar.classList.toggle('is-active', Boolean(value))
    if (label) label.textContent = value ? text : ''
  })

  form.addEventListener('submit', onCodeModalSubmit)
  root.querySelector('[data-resend-code]')?.addEventListener('click', onResendCode)
}

function ensureCodeModal() {
  if (!document.getElementById('auth-code-modal')) {
    document.body.insertAdjacentHTML('beforeend', `
    <div id="auth-code-modal" class="auth-modal" aria-hidden="true">
      <div class="auth-modal-backdrop" data-code-modal-close></div>
      <div class="auth-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-code-title">
        <button type="button" class="auth-modal-close" data-code-modal-close aria-label="Закрыть">×</button>
        <h2 id="auth-code-title" class="auth-modal-title">Код подтверждения</h2>
        <p class="auth-modal-subtitle" data-code-modal-subtitle></p>
        <form id="auth-code-form" novalidate class="auth-form">
          <div class="field-group" data-code-modal-email-wrap hidden>
            <div class="field-control">
              <i data-feather="mail" class="field-icon"></i>
              <input name="email" type="email" class="field-input" placeholder="Email" autocomplete="email" />
            </div>
            <p class="field-error"></p>
          </div>
          <div class="field-group" data-code-modal-code-wrap hidden>
            <div class="field-control">
              <i data-feather="key" class="field-icon"></i>
              <input
                name="code"
                type="text"
                class="field-input"
                placeholder="Код из письма"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="6"
              />
            </div>
            <p class="field-error"></p>
          </div>
          <div class="auth-modal-passwords" data-code-modal-passwords hidden>
            <div class="field-group">
              <div class="field-control">
                <i data-feather="lock" class="field-icon"></i>
                <input id="auth-code-password" name="password" type="password" class="field-input" placeholder="Новый пароль" autocomplete="new-password" />
                <button type="button" data-toggle-password class="field-toggle" aria-label="Показать пароль">
                  <i data-feather="eye"></i>
                </button>
              </div>
              <div class="strength-bar"><div class="strength-fill"></div></div>
              <p class="strength-label"></p>
              <p class="field-error"></p>
            </div>
            <div class="field-group">
              <div class="field-control">
                <i data-feather="lock" class="field-icon"></i>
                <input name="password_confirm" type="password" class="field-input" placeholder="Подтверждение пароля" autocomplete="new-password" />
              </div>
              <p class="field-error"></p>
            </div>
          </div>
          <button type="submit" class="btn-primary" data-code-modal-submit>Подтвердить</button>
        </form>
        <p class="auth-footer-text" data-code-modal-resend>
          Не пришло письмо?
          <button type="button" class="auth-link auth-link--bold auth-text-btn" data-resend-code>Отправить снова</button>
        </p>
        <p class="field-hint" data-resend-ok hidden></p>
      </div>
    </div>
    `)
    if (typeof feather !== 'undefined') feather.replace()
  }
  bindCodeModal(document.getElementById('auth-code-modal'))
}

function applyAuthModalLayout() {
  const root = document.getElementById('auth-code-modal')
  const form = document.getElementById('auth-code-form')
  if (!root || !form) return

  const title = document.getElementById('auth-code-title')
  const subtitle = root.querySelector('[data-code-modal-subtitle]')
  const emailWrap = root.querySelector('[data-code-modal-email-wrap]')
  const codeWrap = root.querySelector('[data-code-modal-code-wrap]')
  const passwords = root.querySelector('[data-code-modal-passwords]')
  const resend = root.querySelector('[data-code-modal-resend]')
  const submit = root.querySelector('[data-code-modal-submit]')
  const emailInput = form.querySelector('input[name="email"]')
  const codeInput = form.querySelector('input[name="code"]')
  const passwordInput = form.querySelector('input[name="password"]')
  const confirmInput = form.querySelector('input[name="password_confirm"]')
  const email = codeModalState.email
  const isReset = codeModalState.mode === 'reset'
  const step = codeModalState.step
  const isEmailStep = isReset && step === 'email'
  const isCodeStep = !isReset || step === 'code'
  const isPasswordStep = isReset && step === 'password'

  if (emailWrap) emailWrap.hidden = !isEmailStep
  if (codeWrap) codeWrap.hidden = !isCodeStep
  if (passwords) passwords.hidden = !isPasswordStep
  if (resend) resend.hidden = !isCodeStep
  if (emailInput) emailInput.required = isEmailStep
  if (codeInput) codeInput.required = isCodeStep
  if (passwordInput) passwordInput.required = isPasswordStep
  if (confirmInput) confirmInput.required = isPasswordStep

  if (!isReset) {
    title.textContent = 'Подтвердите почту'
    subtitle.innerHTML = email
      ? `Мы отправили код на <strong>${escapeHtml(email)}</strong>. Введите его, чтобы завершить регистрацию.`
      : 'Введите код из письма, чтобы завершить регистрацию.'
    submit.textContent = 'Подтвердить'
  } else if (isEmailStep) {
    title.textContent = 'Восстановление пароля'
    subtitle.textContent = 'Укажите email — отправим код для смены пароля.'
    submit.textContent = 'Отправить код'
  } else if (isPasswordStep) {
    title.textContent = 'Новый пароль'
    subtitle.textContent = 'Придумайте новый пароль для входа.'
    submit.textContent = 'Сохранить пароль'
  } else {
    title.textContent = 'Код подтверждения'
    subtitle.innerHTML = email
      ? `Мы отправили код на <strong>${escapeHtml(email)}</strong>. Введите его, чтобы продолжить.`
      : 'Введите код из письма.'
    submit.textContent = 'Продолжить'
  }
  delete submit.dataset.label
}

function openCodeModal({ mode, email, pendingSession = null, pendingPassword = '', step = 'code' }) {
  ensureCodeModal()
  codeModalState.mode = mode
  codeModalState.step = step
  codeModalState.email = email || ''
  codeModalState.pendingSession = pendingSession || null
  if (mode === 'reset') {
    codeModalState.pendingPassword = ''
    if (step !== 'password') codeModalState.resetToken = ''
  } else if (pendingPassword) {
    codeModalState.pendingPassword = pendingPassword
  }

  const root = document.getElementById('auth-code-modal')
  const form = document.getElementById('auth-code-form')
  const hint = root.querySelector('[data-resend-ok]')
  const emailInput = form.querySelector('input[name="email"]')

  form.reset()
  showFormError(form, '')
  form.querySelectorAll('input').forEach(clearFieldError)
  if (emailInput) emailInput.value = email || ''
  if (hint) {
    hint.hidden = true
    hint.textContent = ''
  }

  applyAuthModalLayout()

  root.classList.add('is-open')
  root.setAttribute('aria-hidden', 'false')
  document.body.classList.add('auth-modal-open')
  setTimeout(() => {
    const focusName = codeModalState.step === 'password'
      ? 'password'
      : codeModalState.step === 'email'
        ? 'email'
        : 'code'
    form.querySelector(`input[name="${focusName}"]`)?.focus()
  }, 50)
}

function closeCodeModal() {
  const root = document.getElementById('auth-code-modal')
  if (!root) return
  root.classList.remove('is-open')
  root.setAttribute('aria-hidden', 'true')
  document.body.classList.remove('auth-modal-open')
  codeModalState.pendingSession = null
  codeModalState.resetToken = ''
  codeModalState.step = 'email'
}

async function onCodeModalSubmit(e) {
  e.preventDefault()
  const form = e.currentTarget
  const emailInput = form.querySelector('input[name="email"]')
  const codeInput = form.querySelector('input[name="code"]')
  const passwordInput = form.querySelector('input[name="password"]')
  const confirmInput = form.querySelector('input[name="password_confirm"]')
  const btn = form.querySelector('[type="submit"]')
  const code = (codeInput.value || '').trim() || codeModalState.resetToken
  const isReset = codeModalState.mode === 'reset'

  showFormError(form, '')
  ;[emailInput, codeInput, passwordInput, confirmInput].filter(Boolean).forEach(clearFieldError)

  if (isReset && codeModalState.step === 'email') {
    const emailValue = (emailInput?.value || '').trim()
    if (!validateEmail(emailValue)) {
      showFieldError(emailInput, 'Введите корректный email')
      return
    }
    setButtonLoading(btn, true)
    try {
      await apiPost('/auth/forgot-password', { email: emailValue })
      codeModalState.email = emailValue
      codeModalState.step = 'code'
      if (codeInput) codeInput.value = ''
      showFormError(form, '')
      setButtonLoading(btn, false)
      delete btn.dataset.label
      applyAuthModalLayout()
      setTimeout(() => codeInput?.focus(), 50)
    } catch (err) {
      showFormError(form, err.message || 'Не удалось отправить код')
      setButtonLoading(btn, false)
    }
    return
  }

  if (isReset && codeModalState.step === 'code') {
    if (code.length < 4) {
      showFieldError(codeInput, 'Введите код из письма')
      return
    }
    codeModalState.resetToken = code
    codeModalState.step = 'password'
    showFormError(form, '')
    if (passwordInput) passwordInput.value = ''
    if (confirmInput) confirmInput.value = ''
    applyAuthModalLayout()
    setTimeout(() => passwordInput?.focus(), 50)
    return
  }

  let valid = true
  if (!isReset && !isVerifyCode(code)) {
    showFieldError(codeInput, 'Введите 6-значный код из письма')
    valid = false
  }
  if (isReset && codeModalState.step === 'password') {
    if (!passwordInput.value || passwordInput.value.length < 8) {
      showFieldError(passwordInput, 'Минимум 8 символов')
      valid = false
    }
    if (passwordInput.value !== confirmInput.value) {
      showFieldError(confirmInput, 'Пароли не совпадают')
      valid = false
    }
  }
  if (!valid) return

  setButtonLoading(btn, true)
  try {
    if (isReset) {
      await apiPost('/auth/reset-password', {
        token: codeModalState.resetToken,
        password: passwordInput.value,
        password_confirm: confirmInput.value,
      })
      closeCodeModal()
      window.location.href = '/login'
      return
    }

    const verified = await confirmEmail(codeModalState.email, code)
    if (!verified?.access_token) throw new Error('Не удалось подтвердить почту')
    clearUnverified(codeModalState.email)
    codeModalState.pendingPassword = ''
    afterAuth(verified, 'register')
  } catch (err) {
    showFormError(form, err.message || 'Неверный код')
    setButtonLoading(btn, false)
  }
}

async function onResendCode() {
  const hint = document.querySelector('#auth-code-modal [data-resend-ok]')
  const form = document.getElementById('auth-code-form')
  showFormError(form, '')
  if (!validateEmail(codeModalState.email)) {
    showFormError(form, 'Сначала укажите email')
    return
  }
  try {
    if (codeModalState.mode === 'reset') {
      await apiPost('/auth/forgot-password', { email: codeModalState.email })
    } else {
      await resendVerification(codeModalState.email)
    }
    if (hint) {
      hint.hidden = false
      hint.textContent = 'Код отправлен. Проверьте почту.'
    }
  } catch (err) {
    showFormError(form, err.message || 'Не удалось отправить код')
  }
}

async function startPasswordRecovery(email, formForError) {
  if (!email || !validateEmail(email)) {
    if (formForError) {
      const input = formForError.querySelector('#email') || formForError.querySelector('input[name="email"]') || formForError.querySelector('input[type="email"]')
      if (input) showFieldError(input, 'Введите корректный email')
      else showFormError(formForError, 'Введите корректный email')
    }
    return false
  }
  try {
    await apiPost('/auth/forgot-password', { email })
  } catch (err) {
    if (formForError) showFormError(formForError, err.message || 'Не удалось отправить код')
    return false
  }
  openCodeModal({ mode: 'reset', email, step: 'code' })
  return true
}

function initLoginForm() {
  const form = document.getElementById('login-form')
  if (!form) return

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    let valid = true
    const email = form.querySelector('#email')
    const password = form.querySelector('#password')
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
    const emailValue = email.value.trim()
    try {
      const session = await apiPost('/auth/login', {
        email: emailValue,
        password: password.value,
      })
      if (isUnverified(emailValue)) {
        openCodeModal({
          mode: 'register',
          email: emailValue,
          pendingPassword: password.value,
        })
        setButtonLoading(btn, false)
        return
      }
      afterAuth(session, 'login')
    } catch (err) {
      if (err.status === 403) {
        markUnverified(emailValue)
        openCodeModal({
          mode: 'register',
          email: emailValue,
          pendingPassword: password.value,
        })
        setButtonLoading(btn, false)
        return
      }
      showFormError(form, err.message || 'Не удалось войти')
      setButtonLoading(btn, false)
    }
  })
}

function initRegisterForm() {
  const form = document.getElementById('register-form')
  if (!form) return

  initPasswordStrength()

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    let valid = true
    const name = form.querySelector('#name')
    const email = form.querySelector('#email')
    const password = form.querySelector('#password')
    const confirm = form.querySelector('#password-confirm')
    const terms = form.querySelector('#terms')
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
    const emailValue = email.value.trim()
    try {
      await apiPost('/auth/register', {
        name: name.value.trim(),
        email: emailValue,
        password: password.value,
        password_confirm: confirm.value,
        terms: true,
      })
      markUnverified(emailValue)
      openCodeModal({
        mode: 'register',
        step: 'code',
        email: emailValue,
        pendingPassword: password.value,
      })
      setButtonLoading(btn, false)
    } catch (err) {
      if (err.status === 409) {
        showFieldError(email, 'Такая почта уже зарегистрирована')
        showFormError(form, 'Аккаунт с этим email уже существует. Войдите или восстановите пароль.')
      } else {
        showFormError(form, err.message || 'Не удалось зарегистрироваться')
      }
      setButtonLoading(btn, false)
    }
  })
}

function initForgotPassword() {
  const link = document.querySelector('[data-forgot-password]')
  if (link) {
    link.addEventListener('click', (e) => {
      e.preventDefault()
      const emailInput = document.querySelector('#email')
      const email = emailInput?.value?.trim() || ''
      if (emailInput) clearFieldError(emailInput)
      const form = document.getElementById('login-form')
      if (form) showFormError(form, '')
      openCodeModal({
        mode: 'reset',
        step: 'email',
        email: validateEmail(email) ? email : '',
      })
    })
  }

  const forgotForm = document.getElementById('forgot-password-form')
  if (!forgotForm) return
  const preset = queryParam('email')
  const emailField = forgotForm.querySelector('input[name="email"]')
  if (preset && emailField && !emailField.value) emailField.value = preset

  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const emailInput = forgotForm.querySelector('input[name="email"]')
    showFormError(forgotForm, '')
    clearFieldError(emailInput)
    const email = emailInput.value.trim()
    if (!validateEmail(email)) {
      showFieldError(emailInput, 'Введите корректный email')
      return
    }
    const btn = forgotForm.querySelector('[type="submit"]')
    setButtonLoading(btn, true)
    try {
      await startPasswordRecovery(email, forgotForm)
    } catch (err) {
      showFormError(forgotForm, err.message || 'Не удалось отправить код')
    } finally {
      setButtonLoading(btn, false)
    }
  })
}

function initVerifyEmailForm() {
  const form = document.getElementById('verify-email-form')
  if (!form) return
  const emailField = form.querySelector('input[name="email"]')
  const codeField = form.querySelector('input[name="code"]')
  const preset = queryParam('email')
  if (preset && emailField && !emailField.value) emailField.value = preset

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = emailField.value.trim()
    const code = codeField.value.trim()
    showFormError(form, '')
    clearFieldError(emailField)
    clearFieldError(codeField)
    if (!validateEmail(email)) {
      showFieldError(emailField, 'Введите корректный email')
      return
    }
    if (!isVerifyCode(code)) {
      showFieldError(codeField, 'Введите 6-значный код из письма')
      return
    }
    const btn = form.querySelector('[type="submit"]')
    setButtonLoading(btn, true)
    try {
      const session = await confirmEmail(email, code)
      if (!session?.access_token) throw new Error('Не удалось подтвердить почту')
      clearUnverified(email)
      afterAuth(session, 'register')
    } catch (err) {
      showFormError(form, err.message || 'Неверный код')
      setButtonLoading(btn, false)
    }
  })

  form.querySelector('[data-resend-code]')?.addEventListener('click', async () => {
    const email = emailField.value.trim()
    if (!validateEmail(email)) {
      showFieldError(emailField, 'Введите корректный email')
      return
    }
    const hint = form.querySelector('[data-resend-ok]')
    try {
      await resendVerification(email)
      if (hint) {
        hint.hidden = false
        hint.textContent = 'Код отправлен повторно. Проверьте почту.'
      }
    } catch (err) {
      showFormError(form, err.message || 'Не удалось отправить код')
    }
  })
}

function initResetPasswordForm() {
  const form = document.getElementById('reset-password-form')
  if (!form) return
  const emailField = form.querySelector('input[name="email"]')
  const codeInput = form.querySelector('input[name="code"]')
  const subtitle = form.closest('.auth-card')?.querySelector('.auth-subtitle')
  const presetEmail = queryParam('email')
  const presetToken = queryParam('token')
  if (presetEmail && emailField && !emailField.value) emailField.value = presetEmail
  if (presetToken && codeInput && !codeInput.value) {
    codeInput.value = presetToken
    codeInput.removeAttribute('maxlength')
    emailField?.closest('.field-group')?.setAttribute('hidden', '')
    codeInput.closest('.field-group')?.setAttribute('hidden', '')
    if (subtitle) subtitle.textContent = 'Задайте новый пароль по ссылке из письма.'
  }
  initPasswordStrength()

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = (emailField?.value || '').trim()
    const password = form.querySelector('input[name="password"]')
    const confirm = form.querySelector('input[name="password_confirm"]')
    const token = (codeInput.value || '').trim() || presetToken
    showFormError(form, '')
    ;[emailField, codeInput, password, confirm].filter(Boolean).forEach(clearFieldError)
    let valid = true
    if (!token || token.length < 4) {
      showFieldError(codeInput, 'Введите код из письма или откройте ссылку из письма')
      valid = false
    }
    if (!presetToken && !validateEmail(email)) {
      showFieldError(emailField, 'Введите корректный email')
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
      await apiPost('/auth/reset-password', {
        token,
        password: password.value,
        password_confirm: confirm.value,
      })
      window.location.href = '/login'
    } catch (err) {
      showFormError(form, err.message || 'Не удалось сохранить пароль')
      setButtonLoading(btn, false)
    }
  })
}

function initInviteForm() {
  const form = document.getElementById('invite-form')
  if (!form) return
  const token = queryParam('token')
  initPasswordStrength()
  if (!token) {
    showFormError(form, 'В ссылке нет токена приглашения. Откройте письмо ещё раз.')
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const password = form.querySelector('input[name="password"]')
    const confirm = form.querySelector('input[name="password_confirm"]')
    showFormError(form, '')
    ;[password, confirm].forEach(clearFieldError)
    if (!token) {
      showFormError(form, 'Недействительная ссылка приглашения')
      return
    }
    let valid = true
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
      const session = await apiPost('/auth/tenant-invitation/accept', {
        token,
        password: password.value,
        password_confirm: confirm.value,
      })
      afterAuth(session, 'login')
    } catch (err) {
      showFormError(form, err.message || 'Не удалось принять приглашение')
      setButtonLoading(btn, false)
    }
  })
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
  initLoginForm()
  initRegisterForm()
  initForgotPassword()
  initVerifyEmailForm()
  initResetPasswordForm()
  initInviteForm()
  initOauth()
  ensureCodeModal()

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-toggle-password]')
    if (!btn) return
    e.preventDefault()
    togglePassword(btn)
  })

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    if (document.getElementById('auth-code-modal')?.classList.contains('is-open')) closeCodeModal()
  })

  if (typeof feather !== 'undefined') feather.replace()
})

window.togglePassword = togglePassword
