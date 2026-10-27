export const BRAND_PRESETS = [
  { id: 'indigo', label: 'Indigo', color: '#465fff' },
  { id: 'teal', label: 'Teal', color: '#0F766E' },
  { id: 'navy', label: 'Navy', color: '#1e3a8a' },
  { id: 'green', label: 'Green', color: '#027a48' },
  { id: 'slate', label: 'Slate', color: '#344054' },
  { id: 'wine', label: 'Wine', color: '#9f1239' },
] as const

export type BrandPresetId = (typeof BRAND_PRESETS)[number]['id']

const DEFAULT_FOOTER = 'Internal invoice. Not a certified tax document.'
const DEFAULT_STATEMENT = 'Internal statement. Not a certified tax document.'

export interface DocumentBrand {
  name: string
  nif: string
  address: string
  phone: string
  email: string
  logo: string
  color: string
  preset: BrandPresetId
  kicker: string
  footer: string
  statementFooter: string
}

function textSetting(settings: Record<string, unknown>[], key: string, fallback: string): string {
  const raw = settings.find((row) => row.key === key)?.value
  if (typeof raw !== 'string') return fallback
  const trimmed = raw.trim()
  if (trimmed === '') return fallback
  if (trimmed.startsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (typeof parsed === 'string' && parsed.trim() !== '') return parsed
    } catch {
      return trimmed
    }
  }
  return trimmed
}

export function brandPreset(id: string): (typeof BRAND_PRESETS)[number] {
  return BRAND_PRESETS.find((preset) => preset.id === id) ?? BRAND_PRESETS[0]
}

export function documentBrand(settings: Record<string, unknown>[]): DocumentBrand {
  const design = settings.find((row) => row.key === 'document_design')?.value
  let stored: { logo?: unknown; color?: unknown; kicker?: unknown; statementFooter?: unknown } = {}
  if (typeof design === 'string' && design.trim().startsWith('{')) {
    try { stored = JSON.parse(design) as typeof stored } catch { stored = {} }
  } else if (design && typeof design === 'object') {
    stored = design as typeof stored
  }
  const preset = brandPreset(typeof stored.color === 'string' ? stored.color : 'indigo')
  const logo = typeof stored.logo === 'string' && stored.logo.startsWith('data:image/') ? stored.logo : ''
  const kicker = typeof stored.kicker === 'string' && stored.kicker.trim() !== '' ? stored.kicker.trim() : 'Internal invoice'
  const statementFooter = typeof stored.statementFooter === 'string' && stored.statementFooter.trim() !== '' ? stored.statementFooter.trim() : DEFAULT_STATEMENT
  return {
    name: textSetting(settings, 'company_name', 'HAK Wholesales'),
    nif: textSetting(settings, 'company_nif', ''),
    address: textSetting(settings, 'company_address', ''),
    phone: textSetting(settings, 'company_phone', ''),
    email: textSetting(settings, 'company_email', ''),
    logo,
    color: preset.color,
    preset: preset.id,
    kicker,
    footer: textSetting(settings, 'invoice_footer', DEFAULT_FOOTER),
    statementFooter,
  }
}
