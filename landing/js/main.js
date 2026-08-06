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
  initAOS()
  initFeather()
})
