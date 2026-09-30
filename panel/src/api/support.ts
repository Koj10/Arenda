import { apiRequest } from '@/api/http'
import { asList, type SupportMessageOut } from '@/api/types'

export async function sendSupportMessage(message: string) {
  return apiRequest<SupportMessageOut>('/support/message', {
    method: 'POST',
    body: { message },
  })
}

export async function listSupportMessages() {
  return asList<SupportMessageOut>(await apiRequest<unknown>('/support/messages'))
}

export async function getSupportMessage(messageId: number) {
  return apiRequest<SupportMessageOut>(`/support/messages/${messageId}`)
}

export async function markSupportRead() {
  return apiRequest<unknown>('/support/read', { method: 'POST' })
}

export async function getSupportUnreadCount() {
  const raw = await apiRequest<unknown>('/support/unread-count')
  if (typeof raw === 'number') return raw
  if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>
    const value = rec.count ?? rec.unread ?? rec.unread_count ?? rec.total
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return 0
}
