import { Document, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import { documentBrand, type DocumentBrand } from '../shared/brand'
import { centsToEuros } from '../shared/money'
import type { CustomerStatement } from '../shared/reports'

function pdfStyles(color: string) {
  return StyleSheet.create({
    page: { padding: 0, fontSize: 11, fontFamily: 'Helvetica', color: '#101828' },
    band: { backgroundColor: color, color: '#ffffff', paddingTop: 28, paddingBottom: 22, paddingLeft: 36, paddingRight: 36 },
    lockup: { flexDirection: 'row', alignItems: 'center' },
    logo: { width: 42, height: 42, marginRight: 12, objectFit: 'contain' },
    brand: { fontSize: 18, marginBottom: 2 },
    kicker: { fontSize: 9, color: '#e8eeff' },
    body: { paddingTop: 24, paddingLeft: 36, paddingRight: 36 },
    meta: { marginBottom: 4 },
    rule: { marginTop: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#d0d5dd' },
    line: { marginBottom: 6 },
    total: { marginTop: 12, fontSize: 14 },
    foot: { marginTop: 28, backgroundColor: color, color: '#ffffff', paddingTop: 16, paddingBottom: 18, paddingLeft: 36, paddingRight: 36, fontSize: 9 },
  })
}

export function StatementDocument({ statement, brand }: { statement: CustomerStatement; brand?: DocumentBrand }) {
  const look = brand ?? documentBrand([])
  const styles = pdfStyles(look.color)
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.band}>
          <View style={styles.lockup}>
            {look.logo ? <Image src={look.logo} style={styles.logo} /> : null}
            <View>
              <Text style={styles.brand}>{look.name}</Text>
              <Text style={styles.kicker}>Statement</Text>
            </View>
          </View>
        </View>
        <View style={styles.body}>
          <Text style={styles.meta}>Statement for {statement.shop}</Text>
          <View style={styles.rule} />
          {statement.invoices.map((invoice) => (
            <Text key={invoice.invoiceNo} style={styles.line}>
              {invoice.invoiceNo} · {invoice.date} · total {centsToEuros(invoice.totalCents)} · paid {centsToEuros(invoice.paidCents)} · open {centsToEuros(invoice.openCents)}
            </Text>
          ))}
          <Text style={styles.meta}>Payments received {centsToEuros(statement.paymentsCents)}</Text>
          <Text style={styles.total}>Balance due {centsToEuros(statement.balanceCents)}</Text>
        </View>
        <View style={styles.foot}>
          <Text>{look.statementFooter}</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function downloadStatementPdf(statement: CustomerStatement, brand?: DocumentBrand): Promise<void> {
  const blob = await pdf(<StatementDocument statement={statement} brand={brand} />).toBlob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${statement.shop} statement.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
