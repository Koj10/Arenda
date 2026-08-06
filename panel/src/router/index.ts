import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { defaultHomeForRole } from '@/types/auth'
import { redirectToLandingAuth, redirectToLandingLogin } from '@/utils/authRedirect'

/** Dummy view — instantly sends user to landing auth pages */
const LandingAuthRedirect = {
  name: 'LandingAuthRedirect',
  setup() {
    return () => null
  },
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LandingAuthRedirect,
      beforeEnter: () => {
        redirectToLandingLogin()
        return false
      },
    },
    {
      path: '/register',
      name: 'register',
      component: LandingAuthRedirect,
      beforeEnter: () => {
        redirectToLandingAuth('register')
        return false
      },
    },
    {
      path: '/choose-role',
      name: 'choose-role',
      component: () => import('@/views/ChooseRoleView.vue'),
      meta: { chooseRole: true },
    },
    { path: '/', redirect: () => defaultHomeForRole(useAuthStore().user?.role ?? 'landlord') },

    // Legacy redirects
    { path: '/objects', redirect: '/landlord/objects' },
    { path: '/tenants', redirect: '/landlord/tenants' },
    { path: '/reports', redirect: '/landlord/reports' },
    { path: '/accounting', redirect: '/landlord/accounting' },

    // Landlord panel
    {
      path: '/landlord/reports',
      name: 'landlord-reports',
      component: () => import('@/views/ReportsView.vue'),
      meta: { requiresAuth: true, role: 'landlord', pageTitle: 'Аналитика', pageSubtitle: 'Отчёты по портфелю и объектам' },
    },
    {
      path: '/landlord/objects',
      name: 'landlord-objects',
      component: () => import('@/views/ObjectsView.vue'),
      meta: { requiresAuth: true, role: 'landlord', pageTitle: 'Объекты', pageSubtitle: 'Реестр недвижимости и помещений' },
    },
    {
      path: '/landlord/tenants',
      name: 'landlord-tenants',
      component: () => import('@/views/TenantsView.vue'),
      meta: { requiresAuth: true, role: 'landlord', pageTitle: 'Арендаторы', pageSubtitle: 'Контракты и арендаторы' },
    },
    {
      path: '/landlord/accounting',
      name: 'landlord-accounting',
      component: () => import('@/views/AccountingView.vue'),
      meta: { requiresAuth: true, role: 'landlord', pageTitle: 'Финансы', pageSubtitle: 'Доходы, расходы и движение средств' },
    },

    // Shared (landlord + tenant)
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { requiresAuth: true, pageTitle: 'Настройки', pageSubtitle: 'Профиль, тариф и уведомления' },
    },
    {
      path: '/help',
      name: 'help',
      component: () => import('@/views/HelpView.vue'),
      meta: { requiresAuth: true, pageTitle: 'Помощь', pageSubtitle: 'FAQ и контакты поддержки' },
    },

    // Tenant portal (read-only)
    {
      path: '/tenant/spaces',
      name: 'tenant-spaces',
      component: () => import('@/views/tenant/TenantSpacesView.vue'),
      meta: { requiresAuth: true, role: 'tenant', pageTitle: 'Мои помещения', pageSubtitle: 'Арендуемые объекты' },
    },
    {
      path: '/tenant/spaces/:leaseId',
      name: 'tenant-space-detail',
      component: () => import('@/views/tenant/TenantSpaceDetailView.vue'),
      meta: { requiresAuth: true, role: 'tenant', pageTitle: 'Помещение', pageSubtitle: 'Детали аренды' },
    },
    {
      path: '/tenant/bills',
      name: 'tenant-bills',
      component: () => import('@/views/tenant/TenantBillsView.vue'),
      meta: { requiresAuth: true, role: 'tenant', pageTitle: 'Счета', pageSubtitle: 'Выставленные счета и оплаты' },
    },
    {
      path: '/tenant/reports',
      name: 'tenant-reports',
      component: () => import('@/views/tenant/TenantReportsView.vue'),
      meta: { requiresAuth: true, role: 'tenant', pageTitle: 'Отчёты', pageSubtitle: 'Финансовые отчёты' },
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  auth.hydrate()

  if (to.query.autologin === '1' && to.query.email) {
    const email = String(to.query.email)
    const name = to.query.name ? String(to.query.name) : undefined
    const chooseRole = to.query.chooseRole === '1'
    const mode = to.query.mode === 'login' ? 'login' : 'register'

    if (chooseRole) {
      auth.beginRoleChoice(email, name ?? email.split('@')[0] ?? 'User', mode)
      return { path: '/choose-role', replace: true }
    }

    auth.login(email, name)
    return { path: defaultHomeForRole(auth.user!.role), replace: true }
  }

  if (to.meta.chooseRole) {
    if (auth.isAuthenticated) {
      return { path: defaultHomeForRole(auth.user!.role) }
    }
    if (!auth.pendingRoleChoice) {
      redirectToLandingLogin()
      return false
    }
    return true
  }

  if (auth.needsRoleChoice && to.path !== '/choose-role') {
    return { path: '/choose-role' }
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    redirectToLandingLogin()
    return false
  }

  const requiredRole = to.meta.role as 'landlord' | 'tenant' | undefined
  if (requiredRole && auth.user?.role !== requiredRole) {
    return { path: defaultHomeForRole(auth.user!.role) }
  }
})

export default router
