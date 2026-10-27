import { Document, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import { documentBrand, type DocumentBrand } from '../shared/brand'
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
  brand?: DocumentBrand
}

function pdfStyles(color: string) {
  return StyleSheet.create({
    page: { padding: 0, fontSize: 11, fontFamily: 'Helvetica', color: '#101828' },
    band: { backgroundColor: color, color: '#ffffff', paddingTop: 28, paddingBottom: 22, paddingLeft: 36, paddingRight: 36 },
    lockup: { flexDirection: 'row', alignItems: 'center' },
    logo: { width: 42, height: 42, marginRight: 12, objectFit: 'contain' },
    brand: { fontSize: 18, marginBottom: 2 },
    kicker: { fontSize: 9, color: '#e8eeff' },
    meta: { marginTop: 8, fontSize: 12 },
    body: { paddingTop: 24, paddingLeft: 36, paddingRight: 36 },
    shop: { marginBottom: 4 },
    rule: { marginTop: 12, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#d0d5dd' },
    line: { marginBottom: 6 },
    total: { marginTop: 12, fontSize: 14 },
    foot: { marginTop: 28, backgroundColor: color, color: '#ffffff', paddingTop: 16, paddingBottom: 18, paddingLeft: 36, paddingRight: 36, fontSize: 9 },
  })
}

export function InvoiceDocument({ invoice }: { invoice: InvoicePdfModel }) {
  const brand = invoice.brand ?? documentBrand([])
  const styles = pdfStyles(brand.color)
  const details = [brand.nif ? `NIF ${brand.nif}` : '', brand.address, brand.phone, brand.email].filter(Boolean)
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.band}>
          <View style={styles.lockup}>
            {brand.logo ? <Image src={brand.logo} style={styles.logo} /> : null}
            <View>
              <Text style={styles.brand}>{brand.name}</Text>
              <Text style={styles.kicker}>{brand.kicker}</Text>
            </View>
          </View>
          <Text style={styles.meta}>{invoice.invoiceNo}</Text>
          <Text style={styles.meta}>{invoice.date}</Text>
        </View>
        <View style={styles.body}>
          {details.map((line) => <Text key={line} style={styles.shop}>{line}</Text>)}
          <Text style={styles.shop}>{invoice.shop}</Text>
          <View style={styles.rule} />
          {invoice.lines.map((line, index) => (
            <Text key={`${line.name}-${index}`} style={styles.line}>
              {line.name} · {line.qty} × {centsToEuros(line.unitPriceCents)}
              {line.discountCents > 0 ? ` · discount ${centsToEuros(line.discountCents)}` : ''} · {centsToEuros(line.totalCents)}
            </Text>
          ))}
          <Text style={styles.total}>Total {centsToEuros(invoice.totalCents)}</Text>
        </View>
        <View style={styles.foot}>
          <Text>{invoice.footer || brand.footer}</Text>
        </View>
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
