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

async function apiPost(path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(parseApiError(data, `Ошибка ${res.status}`))
    err.status = res.status
    err.body = data
    throw err
  }
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
  if (!res.ok) {
    const err = new Error(parseApiError(data, `Ошибка ${res.status}`))
    err.status = res.status
    err.body = data
    throw err
  }
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

const PENDING_VERIFY_KEY = 'propcount-await-verify'

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

function setAwaitingVerify(email) {
  sessionStorage.setItem(PENDING_VERIFY_KEY, email)
}

function clearAwaitingVerify() {
  sessionStorage.removeItem(PENDING_VERIFY_KEY)
}

function isAwaitingVerify(email) {
  return sessionStorage.getItem(PENDING_VERIFY_KEY) === email
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
          <div class="field-group" data-code-modal-code-wrap>
            <div class="field-control">
              <i data-feather="key" class="field-icon"></i>
              <input
                name="code"
                type="text"
                class="field-input"
                placeholder="Код из письма"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="64"
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
  const codeWrap = root.querySelector('[data-code-modal-code-wrap]')
  const passwords = root.querySelector('[data-code-modal-passwords]')
  const resend = root.querySelector('[data-code-modal-resend]')
  const submit = root.querySelector('[data-code-modal-submit]')
  const codeInput = form.querySelector('input[name="code"]')
  const passwordInput = form.querySelector('input[name="password"]')
  const confirmInput = form.querySelector('input[name="password_confirm"]')
  const email = codeModalState.email
  const isReset = codeModalState.mode === 'reset'
  const isPasswordStep = isReset && codeModalState.step === 'password'

  codeWrap.hidden = isPasswordStep
  passwords.hidden = !isPasswordStep
  if (resend) resend.hidden = isPasswordStep
  if (codeInput) codeInput.required = !isPasswordStep
  if (passwordInput) passwordInput.required = isPasswordStep
  if (confirmInput) confirmInput.required = isPasswordStep

  if (!isReset) {
    title.textContent = 'Подтвердите почту'
    subtitle.innerHTML = email
      ? `Мы отправили код на <strong>${escapeHtml(email)}</strong>. Введите его, чтобы завершить регистрацию.`
      : 'Введите код из письма, чтобы завершить регистрацию.'
    submit.textContent = 'Подтвердить'
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
    if (step === 'code') codeModalState.resetToken = ''
  } else if (pendingPassword) {
    codeModalState.pendingPassword = pendingPassword
  }

  const root = document.getElementById('auth-code-modal')
  const form = document.getElementById('auth-code-form')
  const hint = root.querySelector('[data-resend-ok]')

  form.reset()
  showFormError(form, '')
  form.querySelectorAll('input').forEach(clearFieldError)
  if (hint) {
    hint.hidden = true
    hint.textContent = ''
  }

  applyAuthModalLayout()

  root.classList.add('is-open')
  root.setAttribute('aria-hidden', 'false')
  document.body.classList.add('auth-modal-open')
  setTimeout(() => {
    const focusName = codeModalState.step === 'password' ? 'password' : 'code'
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
  codeModalState.step = 'code'
}

async function onCodeModalSubmit(e) {
  e.preventDefault()
  const form = e.currentTarget
  const codeInput = form.querySelector('input[name="code"]')
  const passwordInput = form.querySelector('input[name="password"]')
  const confirmInput = form.querySelector('input[name="password_confirm"]')
  const btn = form.querySelector('[type="submit"]')
  const code = (codeInput.value || '').trim() || codeModalState.resetToken
  const isReset = codeModalState.mode === 'reset'

  showFormError(form, '')
  ;[codeInput, passwordInput, confirmInput].filter(Boolean).forEach(clearFieldError)

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
  if (!isReset && code.length < 4) {
    showFieldError(codeInput, 'Введите код из письма')
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

    const verified = await apiPost('/auth/verify-email', {
      email: codeModalState.email,
      code,
    })
    let session = verified?.access_token ? verified : codeModalState.pendingSession
    if (!session?.access_token && codeModalState.pendingPassword) {
      session = await apiPost('/auth/login', {
        email: codeModalState.email,
        password: codeModalState.pendingPassword,
      })
    }
    if (!session?.access_token) throw new Error('Не удалось подтвердить почту')
    clearAwaitingVerify()
    codeModalState.pendingPassword = ''
    afterAuth(session, 'register')
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
      try {
        await apiPost('/auth/resend-verification', { email: codeModalState.email })
      } catch (err) {
        if (err.status !== 404) throw err
      }
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
    try {
      const emailValue = email.value.trim()
      const session = await apiPost('/auth/login', {
        email: emailValue,
        password: password.value,
      })
      if (isAwaitingVerify(emailValue)) {
        openCodeModal({
          mode: 'register',
          email: emailValue,
          pendingSession: session,
          pendingPassword: password.value,
        })
        setButtonLoading(btn, false)
        return
      }
      afterAuth(session, 'login')
    } catch (err) {
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
    openCodeModal({
      mode: 'register',
      email: emailValue,
      pendingPassword: password.value,
    })
    try {
      await apiPost('/auth/register', {
        name: name.value.trim(),
        email: emailValue,
        password: password.value,
        password_confirm: confirm.value,
        terms: true,
      })
      setAwaitingVerify(emailValue)
      setButtonLoading(btn, false)
    } catch (err) {
      showFormError(document.getElementById('auth-code-form') || form, err.message || 'Не удалось зарегистрироваться')
      setButtonLoading(btn, false)
    }
  })
}

function initForgotPassword() {
  const link = document.querySelector('[data-forgot-password]')
  if (link) {
    link.addEventListener('click', async (e) => {
      e.preventDefault()
      if (link.dataset.busy) return
      const form = document.getElementById('login-form')
      const emailInput = document.querySelector('#email')
      const email = emailInput?.value?.trim() || ''
      if (emailInput) clearFieldError(emailInput)
      if (form) showFormError(form, '')
      if (!email || !validateEmail(email)) {
        window.location.href = '/forgot-password'
        return
      }
      link.dataset.busy = '1'
      try {
        await startPasswordRecovery(email, form)
      } finally {
        delete link.dataset.busy
      }
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
    if (code.length < 4) {
      showFieldError(codeField, 'Введите код из письма')
      return
    }
    const btn = form.querySelector('[type="submit"]')
    setButtonLoading(btn, true)
    try {
      const session = await apiPost('/auth/verify-email', { email, code })
      if (!session?.access_token) throw new Error('Не удалось подтвердить почту')
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
      try {
        await apiPost('/auth/resend-verification', { email })
      } catch (err) {
        if (err.status !== 404) throw err
      }
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
  const preset = queryParam('email')
  if (preset && emailField && !emailField.value) emailField.value = preset

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = emailField.value.trim()
    const codeInput = form.querySelector('input[name="code"]')
    const password = form.querySelector('input[name="password"]')
    const confirm = form.querySelector('input[name="password_confirm"]')
    showFormError(form, '')
    ;[emailField, codeInput, password, confirm].forEach(clearFieldError)
    let valid = true
    if (!validateEmail(email)) {
      showFieldError(emailField, 'Введите корректный email')
      valid = false
    }
    if ((codeInput.value || '').trim().length < 4) {
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
      await apiPost('/auth/reset-password', {
        token: codeInput.value.trim(),
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
