import type { ReactNode } from 'react'

export function RecordTable({ caption, headers, rows, statusColumn = 1 }: {
  caption: string
  headers: string[]
  statusColumn?: number
  rows: { key: string; cells: ReactNode[]; status?: string }[]
}) {
  return (
    <table className="record-table">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {headers.map((header) => <th key={header} scope="col">{header}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            {row.cells.map((cell, index) => (
              <td key={index} data-status={index === statusColumn ? row.status : undefined} className={index === row.cells.length - 1 ? 'num' : undefined}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
