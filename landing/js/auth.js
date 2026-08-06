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

function simulateSubmit(btn, onSuccess) {
  btn.disabled = true
  btn.innerHTML =
    '<svg class="spin" width="20" height="20" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>'

  setTimeout(() => {
    btn.classList.add('btn-success')
    btn.textContent = '✓'
    setTimeout(onSuccess, 800)
  }, 1200)
}

/** Панель на другом порту (5173) — localStorage не шарится, передаём через URL */
function redirectToPanel(email, name, options = {}) {
  const params = new URLSearchParams({ autologin: '1', email })
  if (name) params.set('name', name)
  if (options.chooseRole) params.set('chooseRole', '1')
  if (options.mode) params.set('mode', options.mode)

  const panelPort = '5173'
  const panelUrl =
    window.location.port === '3000' || window.location.port === ''
      ? `${window.location.protocol}//${window.location.hostname}:${panelPort}/?${params}`
      : `../panel/?${params}`

  window.location.href = panelUrl
}

function initLoginForm() {
  const form = document.getElementById('login-form')
  if (!form) return

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    let valid = true
    const email = form.querySelector('#email')
    const password = form.querySelector('#password')

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
    simulateSubmit(btn, () => redirectToPanel(email.value, undefined, { chooseRole: true, mode: 'login' }))
  })
}

function initRegisterForm() {
  const form = document.getElementById('register-form')
  if (!form) return

  initPasswordStrength()

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    let valid = true
    const name = form.querySelector('#name')
    const email = form.querySelector('#email')
    const password = form.querySelector('#password')
    const confirm = form.querySelector('#password-confirm')
    const terms = form.querySelector('#terms')

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
      alert('Примите условия использования')
      valid = false
    }
    if (!valid) return

    const btn = form.querySelector('[type="submit"]')
    simulateSubmit(btn, () =>
      redirectToPanel(email.value, name.value.trim(), { chooseRole: true, mode: 'register' }),
    )
  })
}

document.addEventListener('DOMContentLoaded', () => {
  initLoginForm()
  initRegisterForm()

  document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
    btn.addEventListener('click', () => togglePassword(btn))
  })

  if (typeof feather !== 'undefined') feather.replace()
})

window.togglePassword = togglePassword
