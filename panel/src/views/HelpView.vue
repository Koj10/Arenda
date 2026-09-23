<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import TenantLayout from '@/components/layout/TenantLayout.vue'
import { useAuthStore } from '@/stores/authStore'
import { SITE } from '@/config/site'
import { HelpCircle, Mail, MessageCircle, BookOpen, Send } from '@lucide/vue'
import { formatApiError } from '@/api/http'
import { listSupportMessages, sendSupportMessage } from '@/api/support'
import type { SupportMessageOut } from '@/api/types'
import { formatDateRu } from '@/utils/dates'

const auth = useAuthStore()
const Layout = computed(() => (auth.isTenant ? TenantLayout : AppLayout))
const draft = ref('')
const sending = ref(false)
const error = ref('')
const messages = ref<SupportMessageOut[]>([])

async function loadMessages() {
  try {
    messages.value = await listSupportMessages()
  } catch {
    messages.value = []
  }
}

async function submit() {
  const text = draft.value.trim()
  if (!text) return
  sending.value = true
  error.value = ''
  try {
    await sendSupportMessage(text)
    draft.value = ''
    await loadMessages()
  } catch (err) {
    error.value = formatApiError(err, 'Не удалось отправить сообщение')
  } finally {
    sending.value = false
  }
}

onMounted(() => {
  void loadMessages()
})

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

      <section class="panel-card p-5 sm:p-6">
        <h2 class="text-base font-semibold text-white mb-2">Написать в поддержку</h2>
        <p class="text-sm text-slate-400 mb-4">Сообщение уходит в API и сохраняется в истории переписки.</p>
        <textarea v-model="draft" rows="4" class="panel-input mb-3" placeholder="Опишите вопрос" />
        <p v-if="error" class="text-xs text-rose-400 mb-3">{{ error }}</p>
        <button type="button" class="panel-btn-primary" :disabled="sending || !draft.trim()" @click="submit">
          <Send class="w-4 h-4" />
          {{ sending ? 'Отправка...' : 'Отправить' }}
        </button>
        <div v-if="messages.length" class="mt-5 space-y-3">
          <article
            v-for="item in messages"
            :key="item.id"
            class="rounded-xl border border-border bg-panel/30 p-4"
          >
            <p class="text-xs text-slate-500 mb-1">{{ formatDateRu(item.created_at) }} · {{ item.status }}</p>
            <p class="text-sm text-slate-200 whitespace-pre-wrap">{{ item.message }}</p>
            <p v-if="item.response" class="text-sm text-emerald-brand mt-2 whitespace-pre-wrap">{{ item.response }}</p>
          </article>
        </div>
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
          :href="`${SITE.url}/privacy`"
          target="_blank"
          rel="noopener"
          class="panel-card p-5 hover:border-emerald-brand/40 transition-colors block"
        >
          <BookOpen class="w-5 h-5 text-emerald-brand mb-3" />
          <p class="text-sm font-semibold text-white mb-1">Правовые документы</p>
          <p class="text-xs text-slate-400">Политика конфиденциальности и условия</p>
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
