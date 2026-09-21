export interface BankRequisites {
  recipient: string
  inn: string
  kpp: string
  bankName: string
  bik: string
  account: string
  corrAccount: string
  notes: string
}

export function emptyBankRequisites(): BankRequisites {
  return {
    recipient: '',
    inn: '',
    kpp: '',
    bankName: '',
    bik: '',
    account: '',
    corrAccount: '',
    notes: '',
  }
}

export function requisitesHaveContent(data: BankRequisites | null | undefined): boolean {
  if (!data) return false
  return Boolean(
    data.recipient.trim()
    || data.inn.trim()
    || data.account.trim()
    || data.bik.trim()
    || data.bankName.trim(),
  )
}

export const BANK_REQUISITES_FIELD_LABELS: { key: keyof BankRequisites; label: string }[] = [
  { key: 'recipient', label: 'Получатель' },
  { key: 'inn', label: 'ИНН' },
  { key: 'kpp', label: 'КПП' },
  { key: 'bankName', label: 'Банк' },
  { key: 'bik', label: 'БИК' },
  { key: 'account', label: 'Расчётный счёт' },
  { key: 'corrAccount', label: 'Корр. счёт' },
  { key: 'notes', label: 'Комментарий' },
]
