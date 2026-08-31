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
  if (!res.ok) throw new Error(parseApiError(data, `Ошибка ${res.status}`))
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
  if (options.chooseRole) params.set('chooseRole', '1')
  if (options.mode) params.set('mode', options.mode)
  if (session.current_role) params.set('role', session.current_role)

  const { protocol, hostname, port } = window.location
  const panelUrl = port === '3000'
    ? `${protocol}//${hostname}:5173/?${params}`
    : `/panel/?${params}`

  window.location.href = panelUrl
}

function selectedRole(form) {
  return form.querySelector('input[name="role"]:checked')?.value || ''
}

function setRoleError(form, message) {
  const el = form.querySelector('[data-role-error]')
  if (el) el.textContent = message || ''
}

function isValidInn(value) {
  return /^\d{10}$|^\d{12}$/.test(value)
}

async function afterAuth(session, mode, role, inn) {
  let next = session
  if (role === 'landlord' || role === 'tenant') {
    next = await apiPost('/me/select-role', { role }, session.access_token)
    if (role === 'tenant' && inn) {
      await apiPatch(
        '/me/tenant-profile',
        { company_name: session.user?.name || '', inn },
        next.access_token,
      )
    }
    redirectToPanel(next, { chooseRole: false, mode })
    return
  }
  redirectToPanel(next, { chooseRole: true, mode })
}

function initRoleInnToggle(form) {
  const group = form.querySelector('#tenant-inn-group')
  if (!group) return
  const update = () => {
    const tenant = selectedRole(form) === 'tenant'
    group.hidden = !tenant
    const inn = form.querySelector('#inn')
    if (inn) inn.required = tenant
  }
  form.querySelectorAll('input[name="role"]').forEach((input) => {
    input.addEventListener('change', update)
  })
  update()
}

function initLoginForm() {
  const form = document.getElementById('login-form')
  if (!form) return

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    let valid = true
    const email = form.querySelector('#email')
    const password = form.querySelector('#password')
    const role = selectedRole(form)
    showFormError(form, '')
    setRoleError(form, '')
    clearFieldError(email)
    clearFieldError(password)

    if (!role) {
      setRoleError(form, 'Выберите: арендодатель или арендатор')
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
    if (!valid) return

    const btn = form.querySelector('[type="submit"]')
    setButtonLoading(btn, true)
    try {
      const session = await apiPost('/auth/login', {
        email: email.value.trim(),
        password: password.value,
      })
      await afterAuth(session, 'login', role)
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
  initRoleInnToggle(form)

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    let valid = true
    const name = form.querySelector('#name')
    const email = form.querySelector('#email')
    const password = form.querySelector('#password')
    const confirm = form.querySelector('#password-confirm')
    const terms = form.querySelector('#terms')
    const inn = form.querySelector('#inn')
    const role = selectedRole(form)
    showFormError(form, '')
    setRoleError(form, '')

    ;[name, email, password, confirm].forEach(clearFieldError)
    if (inn) clearFieldError(inn)

    if (!role) {
      setRoleError(form, 'Выберите: арендодатель или арендатор')
      valid = false
    }
    if (role === 'tenant') {
      const innValue = inn?.value?.trim() || ''
      if (!isValidInn(innValue)) {
        if (inn) showFieldError(inn, 'ИНН: 10 или 12 цифр')
        valid = false
      }
    }

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
      const session = await apiPost('/auth/register', {
        name: name.value.trim(),
        email: email.value.trim(),
        password: password.value,
        password_confirm: confirm.value,
        terms: true,
      })
      await afterAuth(session, 'register', role, role === 'tenant' ? inn?.value?.trim() : undefined)
    } catch (err) {
      showFormError(form, err.message || 'Не удалось зарегистрироваться')
      setButtonLoading(btn, false)
    }
  })
}

function initForgotPassword() {
  const link = document.querySelector('[data-forgot-password]')
  if (!link) return
  link.addEventListener('click', async (e) => {
    e.preventDefault()
    const emailInput = document.querySelector('#email')
    const email = emailInput?.value?.trim() || prompt('Email для сброса пароля')
    if (!email || !validateEmail(email)) {
      alert('Укажите корректный email')
      return
    }
    try {
      await apiPost('/auth/forgot-password', { email })
      alert('Если аккаунт существует, мы отправим письмо для сброса пароля')
    } catch (err) {
      alert(err.message || 'Не удалось отправить запрос')
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
  initOauth()

  document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
    btn.addEventListener('click', () => togglePassword(btn))
  })

  if (typeof feather !== 'undefined') feather.replace()
})

window.togglePassword = togglePassword
