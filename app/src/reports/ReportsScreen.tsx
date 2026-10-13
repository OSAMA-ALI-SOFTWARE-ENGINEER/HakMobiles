import { useMemo, useState } from 'react'
import type { LocalTables } from '../data/ledger'
import { centsToEuros } from '../shared/money'
import { AGEING_BUCKETS, ageingSheet, analysisSheet, buildReports, customerStatement, sheetToCsv, statementMailUrl, statementShareText, workbookBytes, type SalesGroup } from '../shared/reports'
import { lisbonToday } from '../shared/sales'
import { downloadStatementPdf } from './statementPdf'

const views = ['Profit and loss', 'By product', 'By customer', 'By category', 'By month', 'Ageing'] as const
type View = (typeof views)[number]

function downloadBytes(bytes: Uint8Array, filename: string, type: string) {
  const blob = new Blob([bytes], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function mailHref(shop: string, email: string, text: string): string {
  if (email) return statementMailUrl({ shop, phone: '', email, invoices: [], paymentsCents: 0, balanceCents: 0 })
  return `mailto:?subject=${encodeURIComponent(`${shop} statement`)}&body=${encodeURIComponent(text)}`
}

function Groups({ groups, showProfit }: { groups: SalesGroup[]; showProfit: boolean }) {
  return (
    <table className="report-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Pieces</th>
          <th>Revenue</th>
          {showProfit && <th>Profit</th>}
        </tr>
      </thead>
      <tbody>
        {groups.map((row) => (
          <tr key={row.key}>
            <td>{row.label}</td>
            <td>{row.pieces}</td>
            <td>{centsToEuros(row.revenueCents)}</td>
            {showProfit && <td>{centsToEuros(row.profitCents)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ReportsScreen({ tables, showProfit }: { tables: LocalTables; showProfit: boolean }) {
  const [view, setView] = useState<View>(showProfit ? 'Profit and loss' : 'By product')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const today = lisbonToday()
  const reports = useMemo(() => buildReports(tables, { from, to, today }), [tables, from, to, today])
  const groups = view === 'By customer' ? reports.byCustomer : view === 'By category' ? reports.byCategory : view === 'By month' ? reports.byMonth : reports.byProduct
  const sheet = view === 'Ageing'
    ? ageingSheet(reports.ageing.rows)
    : view === 'Profit and loss'
    ? [
        ['Item', 'Amount'],
        ['Sales', reports.profit.revenueCents / 100],
        ...(showProfit ? [
          ['Cost of goods', reports.profit.cogsCents / 100],
          ['Gross profit', reports.profit.grossProfitCents / 100],
          ['Expenses', reports.profit.expenseCents / 100],
          ['Net profit', reports.profit.netProfitCents / 100],
        ] : []),
      ]
    : analysisSheet(groups, showProfit)

  function exportFile(kind: 'xlsx' | 'csv') {
    const name = `hak-${view.toLowerCase().replaceAll(' ', '-')}`
    if (kind === 'csv') {
      downloadBytes(new TextEncoder().encode(sheetToCsv(sheet)), `${name}.csv`, 'text/csv')
      return
    }
    downloadBytes(workbookBytes(view, sheet), `${name}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p className="lede">Profit, sales and ageing use the same ledger as the dashboard. Leave the dates empty to include every record.</p>
        </div>
        <div className="quick-actions">
          <button type="button" className="btn-ghost" onClick={() => exportFile('csv')}>Export CSV</button>
          <button type="button" className="btn" onClick={() => exportFile('xlsx')}>Export Excel</button>
        </div>
      </div>
      <div className="filters">
        <input aria-label="From" className="control" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input aria-label="To" className="control" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
      <div className="tabs" role="tablist">
        {views.filter((name) => showProfit || name !== 'Profit and loss').map((name) => (
          <button key={name} type="button" role="tab" aria-selected={view === name} className={view === name ? 'active' : ''} onClick={() => setView(name)}>{name}</button>
        ))}
      </div>
      {view === 'Profit and loss' && (
        <>
          <div className="metrics">
            <article className="metric"><span>Sales</span><strong className="money">{centsToEuros(reports.profit.revenueCents)}</strong></article>
            {showProfit && <article className="metric"><span>Cost of goods</span><strong className="money">{centsToEuros(reports.profit.cogsCents)}</strong></article>}
            {showProfit && <article className="metric"><span>Gross profit</span><strong className="money">{centsToEuros(reports.profit.grossProfitCents)}</strong></article>}
            {showProfit && <article className="metric"><span>Expenses</span><strong className="money">{centsToEuros(reports.profit.expenseCents)}</strong></article>}
            {showProfit && <article className="metric accent"><span>Net profit</span><strong className="money">{centsToEuros(reports.profit.netProfitCents)}</strong></article>}
          </div>
          {showProfit && reports.previousProfit && <p className="quiet">Previous period net profit {centsToEuros(reports.previousProfit.netProfitCents)}.</p>}
        </>
      )}
      {view !== 'Profit and loss' && view !== 'Ageing' && <Groups groups={groups} showProfit={showProfit} />}
      {view === 'Ageing' && (
        <>
          <article className="metric"><span>Ageing total</span><strong className="money">{centsToEuros(reports.ageing.totalCents)}</strong></article>
          <table className="report-table">
            <thead>
              <tr>
                <th>Shop</th>
                {AGEING_BUCKETS.map((bucket) => <th key={bucket}>{bucket}</th>)}
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.ageing.rows.map((row) => {
                const statement = customerStatement(tables, row.customerId, today)
                const text = statementShareText(statement)
                return (
                  <tr key={row.customerId}>
                    <td>{row.shop}</td>
                    {AGEING_BUCKETS.map((bucket) => <td key={bucket}>{centsToEuros(row.buckets[bucket])}</td>)}
                    <td>{centsToEuros(row.totalCents)}</td>
                    <td>
                      <button type="button" className="btn-ghost" onClick={() => void downloadStatementPdf(statement)}>Statement</button>
                      <a className="btn-ghost" href={mailHref(statement.shop, statement.email, text)}>Email</a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
