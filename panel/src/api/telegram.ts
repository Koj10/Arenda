/** Сообщение в Telegram-бот поддержки. Реализация API будет подключена отдельно. */
export async function sendSupportToTelegram(_payload: {
  text: string
  name?: string | null
  email?: string | null
  role?: string | null
}): Promise<void> {
  await Promise.resolve()
}
