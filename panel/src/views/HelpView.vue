<script setup lang="ts">
import { computed } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import TenantLayout from '@/components/layout/TenantLayout.vue'
import { useAuthStore } from '@/stores/authStore'
import { SITE } from '@/config/site'
import { HelpCircle, Mail, MessageCircle, BookOpen } from '@lucide/vue'

const auth = useAuthStore()
const Layout = computed(() => (auth.isTenant ? TenantLayout : AppLayout))

const faqs = [
  {
    q: 'Как добавить объект?',
    a: 'Раздел «Объекты» → «Добавить объект». На тарифе Start доступно до 3 помещений.',
  },
  {
    q: 'Где кабинет арендатора?',
    a: 'Арендатор входит тем же сайтом и выбирает роль «Арендатор». Доступ к помещениям идёт по ИНН.',
  },
  {
    q: 'Как сменить тариф?',
    a: 'Настройки → блок «Тариф» или карточка апгрейда в боковом меню. Оплата подключится через API.',
  },
  {
    q: 'Почему не экспортируется отчёт?',
    a: 'Экспорт Excel доступен на Profi и Elite. На Start откроется предложение апгрейда.',
  },
]
</script>

<template>
  <component :is="Layout">
    <div class="panel-page-narrow space-y-6">
      <section class="panel-card p-5 sm:p-6">
        <div class="flex items-center gap-2 mb-2">
          <HelpCircle class="w-4 h-4 text-emerald-brand" />
          <h2 class="text-base font-semibold text-white">Помощь</h2>
        </div>
        <p class="text-sm text-slate-400 leading-relaxed">
          Краткие ответы и контакты. Полная документация появится позже.
        </p>
      </section>

      <section class="panel-card divide-y divide-border overflow-hidden">
        <details v-for="item in faqs" :key="item.q" class="group">
          <summary
            class="px-5 py-4 text-sm font-medium text-white cursor-pointer list-none flex items-center justify-between gap-3 hover:bg-card-hover"
          >
            {{ item.q }}
            <span class="text-slate-600 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
          </summary>
          <p class="px-5 pb-4 text-sm text-slate-400 leading-relaxed">{{ item.a }}</p>
        </details>
      </section>

      <section class="grid sm:grid-cols-2 gap-4">
        <a
          href="mailto:hello@propcount.ru"
          class="panel-card p-5 hover:border-emerald-brand/40 transition-colors block"
        >
          <Mail class="w-5 h-5 text-emerald-brand mb-3" />
          <p class="text-sm font-semibold text-white mb-1">Email</p>
          <p class="text-xs text-slate-400">hello@propcount.ru</p>
        </a>
        <a
          :href="`${SITE.url}/#contact`"
          target="_blank"
          rel="noopener"
          class="panel-card p-5 hover:border-emerald-brand/40 transition-colors block"
        >
          <MessageCircle class="w-5 h-5 text-emerald-brand mb-3" />
          <p class="text-sm font-semibold text-white mb-1">Форма на сайте</p>
          <p class="text-xs text-slate-400">propcount.ru — контакты</p>
        </a>
        <a
          :href="`${SITE.url}/#pricing`"
          target="_blank"
          rel="noopener"
          class="panel-card p-5 hover:border-emerald-brand/40 transition-colors block sm:col-span-2"
        >
          <BookOpen class="w-5 h-5 text-emerald-brand mb-3" />
          <p class="text-sm font-semibold text-white mb-1">Тарифы и возможности</p>
          <p class="text-xs text-slate-400">Сравнение Start, Profi и Elite</p>
        </a>
      </section>
    </div>
  </component>
</template>
