import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { LocalTables } from '../data/ledger'
import { centsToEuros } from '../shared/money'
import { calendarEvents, dayBook } from '../shared/dashboard'
import { lisbonToday } from '../shared/sales'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function shiftMonth(cursor: string, delta: number, min: string, max: string) {
  const year = Number(cursor.slice(0, 4))
  const month = Number(cursor.slice(5, 7))
  const next = new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 7)
  if (next < min || next > max) return cursor
  return next
}

export function CalendarScreen({ tables }: { tables: LocalTables }) {
  const today = lisbonToday()
  const currentYear = Number(today.slice(0, 4))
  const minMonth = `${currentYear - 1}-01`
  const maxMonth = `${currentYear}-12`
  const [mode, setMode] = useState<'Year' | 'Month' | 'Day'>('Month')
  const [year, setYear] = useState(currentYear)
  const [cursor, setCursor] = useState(today.slice(0, 7))
  const [day, setDay] = useState(today)
  const events = calendarEvents(tables, year, today)
  const monthIndex = Number(cursor.slice(5, 7)) - 1
  const monthYear = Number(cursor.slice(0, 4))
  const book = dayBook(tables, day)
  const openDay = (date: string) => {
    setDay(date)
    setMode('Day')
  }

  return (
    <section className="page insight-page">
      <div className="page-head">
        <div>
          <h1>Calendar</h1>
          <p className="lede">Follow-ups, invoices, and the ledger for this year and the year before.</p>
        </div>
        <div className="tabs">
          {(['Year', 'Month', 'Day'] as const).map((name) => (
            <button key={name} type="button" className={mode === name ? 'active' : ''} aria-pressed={mode === name} onClick={() => setMode(name)}>{name}</button>
          ))}
        </div>
      </div>
      {mode === 'Year' && (
        <>
          <div className="page-head">
            <h2>{year}</h2>
            <label className="control-line">Year
              <select aria-label="Calendar year" className="control" value={year} onChange={(event) => setYear(Number(event.target.value))}>
                <option value={currentYear}>{currentYear}</option>
                <option value={currentYear - 1}>{currentYear - 1}</option>
              </select>
            </label>
          </div>
          <div className="year-grid">
            {MONTHS.map((label, index) => {
              const month = `${year}-${String(index + 1).padStart(2, '0')}`
              const count = events.filter((event) => event.date.startsWith(month)).length
              return (
                <button key={label} type="button" className="panel" onClick={() => { setCursor(month); setMode('Month') }}>
                  <h3>{label}</h3>
                  <p className="quiet">{count === 0 ? 'No events' : `${count} events`}</p>
                </button>
              )
            })}
          </div>
        </>
      )}
      {mode === 'Month' && (
        <section className="panel">
          <div className="page-head">
            <h2>{MONTHS[monthIndex]} {monthYear}</h2>
            <div className="quick-actions">
              <button type="button" className="btn-ghost" onClick={() => setCursor(shiftMonth(cursor, -1, minMonth, maxMonth))}>Previous month</button>
              <button type="button" className="btn-ghost" onClick={() => setCursor(shiftMonth(cursor, 1, minMonth, maxMonth))}>Next month</button>
            </div>
          </div>
          <div className="month-days">
            {Array.from({ length: daysInMonth(monthYear, monthIndex + 1) }, (_, offset) => {
              const date = `${cursor}-${String(offset + 1).padStart(2, '0')}`
              const items = calendarEvents(tables, monthYear, today).filter((event) => event.date === date)
              return (
                <div key={date} className="day-cell" data-date={date} data-today={date === today ? 'true' : undefined}>
                  <button type="button" className="btn-ghost" onClick={() => openDay(date)}>{offset + 1}</button>
                  {items.map((item) => <Link key={item.label} to={item.href}>{item.label}</Link>)}
                </div>
              )
            })}
          </div>
        </section>
      )}
      {mode === 'Day' && (
        <section className="panel" aria-label="Day">
          <h2>{day}</h2>
          <p className="lede">Sales {centsToEuros(book.salesCents)}</p>
          <h3>Sales</h3>
          <ul className="record-list">
            {book.sales.length === 0 && <li>No sales</li>}
            {book.sales.map((row) => <li key={row.id}><Link to={row.href}>{row.label}</Link></li>)}
          </ul>
          <h3>Expenses</h3>
          <ul className="record-list">
            {book.expenses.length === 0 && <li>No expenses</li>}
            {book.expenses.map((row) => <li key={row.id}>{row.label}</li>)}
          </ul>
          <h3>Customer payments</h3>
          <ul className="record-list">
            {book.customerPayments.length === 0 && <li>No customer payments</li>}
            {book.customerPayments.map((row) => <li key={row.id}>{row.label}</li>)}
          </ul>
          <h3>Supplier payments</h3>
          <ul className="record-list">
            {book.supplierPayments.length === 0 && <li>No supplier payments</li>}
            {book.supplierPayments.map((row) => <li key={row.id}>{row.label}</li>)}
          </ul>
          <h3>Follow-ups</h3>
          <ul className="record-list">
            {book.followUps.length === 0 && <li>No follow-ups</li>}
            {book.followUps.map((row) => <li key={row.id}><Link to={row.href}>{row.label}</Link></li>)}
          </ul>
        </section>
      )}
    </section>
  )
}
