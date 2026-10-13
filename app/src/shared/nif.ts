export function isValidPortugueseNif(value: string): boolean {
  if (!/^\d{9}$/.test(value)) return false
  const digits = value.split('').map(Number)
  const sum = digits.slice(0, 8).reduce((total, digit, index) => total + digit * (9 - index), 0)
  const remainder = 11 - (sum % 11)
  const check = remainder >= 10 ? 0 : remainder
  return digits[8] === check
}

export function whatsAppLink(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const international = digits.startsWith('351') ? digits : `351${digits}`
  return `https://wa.me/${international}`
}
