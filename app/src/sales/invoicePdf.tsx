import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import { centsToEuros } from '../shared/money'

export interface InvoicePdfLine {
  name: string
  qty: number
  unitPriceCents: number
  discountCents: number
  totalCents: number
}

export interface InvoicePdfModel {
  invoiceNo: string
  date: string
  shop: string
  lines: InvoicePdfLine[]
  totalCents: number
  footer?: string
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica', color: '#101828' },
  brand: { fontSize: 18, marginBottom: 4 },
  meta: { marginBottom: 4 },
  rule: { marginTop: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#d0d5dd' },
  line: { marginBottom: 6 },
  total: { marginTop: 12, fontSize: 14 },
  footer: { marginTop: 24, color: '#667085', fontSize: 9 },
})

export function InvoiceDocument({ invoice }: { invoice: InvoicePdfModel }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>HAK Wholesales</Text>
        <Text style={styles.meta}>Invoice {invoice.invoiceNo}</Text>
        <Text style={styles.meta}>{invoice.date}</Text>
        <Text style={styles.meta}>{invoice.shop}</Text>
        <View style={styles.rule} />
        {invoice.lines.map((line, index) => (
          <Text key={`${line.name}-${index}`} style={styles.line}>
            {line.name} · {line.qty} × {centsToEuros(line.unitPriceCents)}
            {line.discountCents > 0 ? ` · discount ${centsToEuros(line.discountCents)}` : ''} · {centsToEuros(line.totalCents)}
          </Text>
        ))}
        <Text style={styles.total}>Total {centsToEuros(invoice.totalCents)}</Text>
        <Text style={styles.footer}>{invoice.footer || 'Internal invoice. Not a certified tax document.'}</Text>
      </Page>
    </Document>
  )
}

export async function downloadInvoicePdf(invoice: InvoicePdfModel): Promise<void> {
  const blob = await pdf(<InvoiceDocument invoice={invoice} />).toBlob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${invoice.invoiceNo}.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
