import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import { centsToEuros } from '../shared/money'
import type { CustomerStatement } from '../shared/reports'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica', color: '#101828' },
  brand: { fontSize: 18, marginBottom: 4 },
  meta: { marginBottom: 4 },
  rule: { marginTop: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#d0d5dd' },
  line: { marginBottom: 6 },
  total: { marginTop: 12, fontSize: 14 },
  footer: { marginTop: 24, color: '#667085', fontSize: 9 },
})

export function StatementDocument({ statement }: { statement: CustomerStatement }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>HAK Wholesales</Text>
        <Text style={styles.meta}>Statement for {statement.shop}</Text>
        <View style={styles.rule} />
        {statement.invoices.map((invoice) => (
          <Text key={invoice.invoiceNo} style={styles.line}>
            {invoice.invoiceNo} · {invoice.date} · total {centsToEuros(invoice.totalCents)} · paid {centsToEuros(invoice.paidCents)} · open {centsToEuros(invoice.openCents)}
          </Text>
        ))}
        <Text style={styles.meta}>Payments received {centsToEuros(statement.paymentsCents)}</Text>
        <Text style={styles.total}>Balance due {centsToEuros(statement.balanceCents)}</Text>
        <Text style={styles.footer}>Internal statement. Not a certified tax document.</Text>
      </Page>
    </Document>
  )
}

export async function downloadStatementPdf(statement: CustomerStatement): Promise<void> {
  const blob = await pdf(<StatementDocument statement={statement} />).toBlob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${statement.shop} statement.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
