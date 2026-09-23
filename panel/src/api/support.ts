import { apiRequest } from '@/api/http'
import type { SupportMessageOut } from '@/api/types'

export async function sendSupportMessage(message: string) {
  return apiRequest<SupportMessageOut>('/support/message', {
    method: 'POST',
    body: { message },
  })
}

export async function listSupportMessages() {
  return apiRequest<SupportMessageOut[]>('/support/messages')
}

export async function getSupportMessage(messageId: number) {
  return apiRequest<SupportMessageOut>(`/support/messages/${messageId}`)
}
