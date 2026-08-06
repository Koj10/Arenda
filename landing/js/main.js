function initHeaderScroll() {
  const header = document.querySelector('.landing-header')
  if (!header) return
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 24)
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
}

function initMobileMenu() {
  const toggle = document.querySelector('[data-menu-toggle]')
  const menu = document.querySelector('[data-mobile-menu]')
  if (!toggle || !menu) return
  toggle.addEventListener('click', () => {
    menu.classList.toggle('open')
    toggle.setAttribute('aria-expanded', menu.classList.contains('open'))
  })
  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => menu.classList.remove('open'))
  })
}

function scrollToId(id) {
  const el = document.getElementById(id)
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return true
}

/** Якоря без #pricing / #features в адресной строке */
function initCleanAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    const href = link.getAttribute('href')
    if (!href || href === '#') return

    link.addEventListener('click', (e) => {
      const id = href.slice(1)
      if (!id || !document.getElementById(id)) return
      e.preventDefault()
      scrollToId(id)
      history.replaceState(null, '', window.location.pathname + window.location.search)
    })
  })

  // Зашли по /#pricing — прокрутить и убрать hash из URL
  const hash = window.location.hash.replace(/^#/, '')
  if (hash && document.getElementById(hash)) {
    requestAnimationFrame(() => {
      scrollToId(hash)
      history.replaceState(null, '', window.location.pathname + window.location.search)
    })
  }
}

function initAOS() {
  if (typeof AOS !== 'undefined') {
    AOS.init({ duration: 700, once: true, offset: 60 })
  }
}

function initFeather() {
  if (typeof feather !== 'undefined') feather.replace()
}

document.addEventListener('DOMContentLoaded', () => {
  initHeaderScroll()
  initMobileMenu()
  initCleanAnchors()
  initAOS()
  initFeather()
})
