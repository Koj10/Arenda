<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { MessageCircle, Send, X } from '@lucide/vue'
import { useSupportChatStore } from '@/stores/supportChatStore'

const chat = useSupportChatStore()
const listRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)

watch(
  () => [chat.open, chat.messages.length] as const,
  async ([isOpen]) => {
    if (!isOpen) return
    await nextTick()
    inputRef.value?.focus()
    if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
  },
)

function timeLabel(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void chat.send()
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed z-[200] flex flex-col items-end gap-3"
      style="right: max(0.75rem, env(safe-area-inset-right)); bottom: max(0.75rem, env(safe-area-inset-bottom))"
    >
      <section
        v-if="chat.open"
        class="w-[min(calc(100vw-1.5rem),360px)] h-[min(62vh,480px)] sm:h-[min(70vh,480px)] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden"
        role="dialog"
        aria-label="Чат поддержки"
      >
        <header class="px-4 py-3 border-b border-border flex items-center justify-between gap-3 bg-panel/60">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-white truncate">Поддержка</p>
            <p class="text-[11px] text-slate-500">Напишите — ответим в этом чате</p>
          </div>
          <button
            type="button"
            class="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-card-hover transition-colors"
            aria-label="Закрыть чат"
            @click="chat.close()"
          >
            <X class="w-4 h-4" />
          </button>
        </header>

        <div ref="listRef" class="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
          <p v-if="chat.messages.length === 0" class="text-xs text-slate-500 text-center py-8 px-4 leading-relaxed">
            Опишите вопрос — сообщение уйдёт в поддержку. История видна, пока открыта вкладка.
          </p>
          <article
            v-for="item in chat.messages"
            :key="item.id"
            class="flex"
            :class="item.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[85%] rounded-2xl px-3 py-2"
              :class="item.role === 'user'
                ? 'bg-emerald-brand/20 text-white rounded-br-md'
                : 'bg-panel border border-border text-slate-200 rounded-bl-md'"
            >
              <p class="text-sm whitespace-pre-wrap break-words">{{ item.text }}</p>
              <p class="text-[10px] text-slate-500 mt-1 text-right">
                {{ timeLabel(item.at) }}
                <span v-if="item.status === 'sending'"> · отправка</span>
                <span v-else-if="item.status === 'error'" class="text-rose-400"> · не отправлено</span>
              </p>
            </div>
          </article>
        </div>

        <form class="p-3 border-t border-border flex items-end gap-2" @submit.prevent="chat.send()">
          <textarea
            ref="inputRef"
            v-model="chat.draft"
            rows="1"
            class="panel-input min-h-[40px] max-h-24 resize-none py-2"
            placeholder="Сообщение..."
            @keydown="onKeydown"
          />
          <button
            type="submit"
            class="panel-btn-primary h-10 w-10 p-0 shrink-0 disabled:opacity-40 disabled:pointer-events-none"
            :disabled="chat.sending || !chat.draft.trim()"
            aria-label="Отправить"
          >
            <Send class="w-4 h-4" />
          </button>
        </form>
      </section>

      <button
        type="button"
        class="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-brand text-black shadow-lg shadow-emerald-brand/30 flex items-center justify-center hover:brightness-110 transition-transform"
        :class="chat.open ? 'rotate-0' : ''"
        :aria-label="chat.open ? 'Закрыть чат поддержки' : 'Открыть чат поддержки'"
        @click="chat.toggle()"
      >
        <X v-if="chat.open" class="w-6 h-6" />
        <MessageCircle v-else class="w-6 h-6" />
      </button>
    </div>
  </Teleport>
</template>
