import type { ReactNode } from 'react'

export type SkeletonKind = 'dashboard' | 'table' | 'board' | 'calendar' | 'list' | 'detail' | 'reports' | 'settings' | 'activity'

export function skeletonKindForPath(path: string): SkeletonKind {
  if (path === '/' || path === '') return 'dashboard'
  if (path.startsWith('/customers/')) return 'detail'
  if (path.startsWith('/pipeline')) return 'board'
  if (path.startsWith('/follow-ups')) return 'list'
  if (path.startsWith('/calendar')) return 'calendar'
  if (path.startsWith('/reports')) return 'reports'
  if (path.startsWith('/settings')) return 'settings'
  if (path.startsWith('/activity')) return 'activity'
  return 'table'
}

function Bone({ className = '' }: { className?: string }) {
  return <span className={`skeleton ${className}`} />
}

function Rows({ count, cols }: { count: number; cols: number }) {
  return (
    <div className="sk-table">
      <div className="sk-row head">{Array.from({ length: cols }, (_, index) => <Bone key={index} className="sk-cell" />)}</div>
      {Array.from({ length: count }, (_, row) => (
        <div className="sk-row" key={row}>{Array.from({ length: cols }, (_, index) => <Bone key={index} className="sk-cell" />)}</div>
      ))}
    </div>
  )
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Rows count={count} cols={2} />
    </div>
  )
}

function Frame({ children }: { children: ReactNode }) {
  return <section className="page skeleton-page" aria-busy="true" aria-label="Loading">{children}</section>
}

export function PageSkeleton({ kind }: { kind: SkeletonKind }) {
  if (kind === 'dashboard') {
    return (
      <Frame>
        <div className="page-head"><Bone className="sk-title" /><Bone className="sk-filter" /></div>
        <Bone className="sk-panel" />
        <div className="metrics">{Array.from({ length: 4 }, (_, index) => <Bone key={index} className="sk-metric" />)}</div>
        <div className="metrics">{Array.from({ length: 3 }, (_, index) => <Bone key={index} className="sk-metric" />)}</div>
        <Bone className="sk-chart" />
      </Frame>
    )
  }
  if (kind === 'board') {
    return (
      <Frame>
        <Bone className="sk-title" />
        <div className="board">{Array.from({ length: 6 }, (_, index) => <Bone key={index} className="sk-column" />)}</div>
      </Frame>
    )
  }
  if (kind === 'calendar') {
    return (
      <Frame>
        <div className="page-head"><Bone className="sk-title" /><Bone className="sk-btn" /></div>
        <div className="sk-week">{Array.from({ length: 7 }, (_, index) => <Bone key={index} className="sk-cell" />)}</div>
        <div className="sk-month">{Array.from({ length: 35 }, (_, index) => <Bone key={index} className="sk-day" />)}</div>
      </Frame>
    )
  }
  if (kind === 'list') {
    return (
      <Frame>
        <div className="page-head"><Bone className="sk-title" /><Bone className="sk-btn" /></div>
        <div className="tabs">{Array.from({ length: 4 }, (_, index) => <Bone key={index} className="sk-tab" />)}</div>
        <Rows count={4} cols={2} />
      </Frame>
    )
  }
  if (kind === 'detail') {
    return (
      <Frame>
        <Bone className="sk-title" />
        <div className="metrics">{Array.from({ length: 4 }, (_, index) => <Bone key={index} className="sk-metric" />)}</div>
        <div className="tabs">{Array.from({ length: 5 }, (_, index) => <Bone key={index} className="sk-tab" />)}</div>
        <Rows count={4} cols={2} />
      </Frame>
    )
  }
  if (kind === 'reports') {
    return (
      <Frame>
        <Bone className="sk-title" />
        <div className="tabs">{Array.from({ length: 6 }, (_, index) => <Bone key={index} className="sk-tab" />)}</div>
        <div className="metrics">{Array.from({ length: 3 }, (_, index) => <Bone key={index} className="sk-metric" />)}</div>
        <Rows count={5} cols={4} />
      </Frame>
    )
  }
  if (kind === 'settings') {
    return (
      <Frame>
        <Bone className="sk-title" />
        {Array.from({ length: 3 }, (_, index) => <Bone key={index} className="sk-panel" />)}
      </Frame>
    )
  }
  if (kind === 'activity') {
    return (
      <Frame>
        <Bone className="sk-title" />
        <Bone className="sk-filter" />
        <Rows count={6} cols={3} />
      </Frame>
    )
  }
  return (
    <Frame>
      <div className="page-head"><Bone className="sk-title" /><Bone className="sk-btn" /></div>
      <div className="filters">{Array.from({ length: 3 }, (_, index) => <Bone key={index} className="sk-filter" />)}</div>
      <Rows count={6} cols={5} />
    </Frame>
  )
}
