import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { v7 as uuidv7 } from 'uuid'
import { saveLocal } from '../db/browser'
import type { LocalTables } from '../data/ledger'
import { PIPELINE_STAGES, followUpBucket, shopFigures } from '../shared/crm'
import { whatsAppLink, isValidPortugueseNif } from '../shared/nif'
import { archiveBlock } from '../shared/records'
import { shopLabel } from '../shared/labels'
import { centsToEuros, centsToInput, parseEuros } from '../shared/money'
import { customerStatement, statementMailUrl, statementWhatsAppUrl } from '../shared/reports'
import { lisbonToday } from '../shared/sales'
import { downloadStatementPdf } from '../reports/statementPdf'
import { Popup } from '../ui/Popup'
import { ArchiveDialog, RowActions } from '../ui/RecordActions'
import { offerUndo } from '../ui/undo'

function todayStamp() {
  return new Date().toISOString().slice(0, 10)
}

export function Customer360({ tables, canManage, isSuperAdmin = false, onSaved }: { tables: LocalTables; canManage: boolean; isSuperAdmin?: boolean; onSaved: () => Promise<void> }) {
  const { id = '' } = useParams()
  const shop = tables.customers.find((row) => row.id === id)
  const [tab, setTab] = useState<'Sales' | 'Payments' | 'Activities' | 'Follow-ups' | 'Notes'>('Activities')
  const [notes, setNotes] = useState(String(shop?.notes ?? ''))
  useEffect(() => { setNotes(String(shop?.notes ?? '')) }, [id, shop?.notes])
  const [error, setError] = useState('')
  const [activityOpen, setActivityOpen] = useState(false)
  const [followOpen, setFollowOpen] = useState(false)
  const [activityId, setActivityId] = useState('')
  const [followId, setFollowId] = useState('')
  const [activityBody, setActivityBody] = useState('')
  const [followTitle, setFollowTitle] = useState('')
  const [followDue, setFollowDue] = useState(todayStamp())
  const [archiveActivity, setArchiveActivity] = useState('')
  const [activityPreview, setActivityPreview] = useState('')
  const [archiveFollow, setArchiveFollow] = useState('')
  const [shopOpen, setShopOpen] = useState(false)
  const [shopArchive, setShopArchive] = useState(false)
  const [shopError, setShopError] = useState('')
  if (!shop) return <section className="page"><h1>Shop not found</h1></section>
  const stage = PIPELINE_STAGES.find((item) => item.id === String(shop.status ?? 'lead'))?.label ?? 'Lead'
  const place = String(shop.city ?? '').trim()

  const figures = shopFigures({
    customerId: id,
    sales: tables.sales.map((row) => ({ id: String(row.id), customer_id: String(row.customer_id), date: row.date == null ? null : String(row.date) })),
    lines: tables.sale_lines.map((row) => ({ sale_id: String(row.sale_id), qty: Number(row.qty), unit_price: Number(row.unit_price), discount: Number(row.discount ?? 0) })),
    payments: tables.customer_payments.map((row) => ({ customer_id: String(row.customer_id), amount: Number(row.amount) })),
  })
  const phone = String(shop.phone ?? shop.whatsapp ?? '')
  const statement = customerStatement(tables, id, lisbonToday())
  const activities = tables.customer_activities.filter((row) => row.customer_id === id)
  const followUps = tables.follow_ups.filter((row) => row.customer_id === id)
  const sales = tables.sales.filter((row) => row.customer_id === id)

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>{String(shop.shop_name)}</h1>
          <p className="lede">{place || stage}</p>
        </div>
        <div className="quick-actions">
          {phone && <a className="btn-ghost" href={`tel:${phone}`}>Call</a>}
          {phone && <a className="btn-ghost" href={whatsAppLink(phone)} target="_blank" rel="noreferrer">WhatsApp</a>}
          {phone && <a className="btn-ghost" href={statementWhatsAppUrl(statement)} target="_blank" rel="noreferrer">WhatsApp statement</a>}
          {typeof shop.email === 'string' && shop.email !== '' && <a className="btn-ghost" href={statementMailUrl(statement)}>Email statement</a>}
          <button type="button" className="btn-ghost" onClick={() => void downloadStatementPdf(statement)}>Statement</button>
          {canManage && <button type="button" className="btn-ghost" onClick={() => { setShopError(''); setShopOpen(true) }}>Edit shop</button>}
          {canManage && <button type="button" className="btn-ghost" onClick={() => {
            const block = archiveBlock({ blocked: figures.owedCents > 0, isSuperAdmin, message: 'This shop still has an open invoice.' })
            if (block) { setShopError(block); return }
            setShopArchive(true)
          }}>Archive shop</button>}
          <Link className="btn" to={`/sales?new=1&customer=${id}`}>New sale</Link>
          <Link className="btn-ghost" to={`/payments?new=1&customer=${id}`}>Record payment</Link>
        </div>
      </div>
      {shopError && <p className="warn">{shopError}</p>}
      <Popup title="Edit shop" open={shopOpen} onClose={() => setShopOpen(false)}>
        <form className="form-grid" onSubmit={async (event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          const nif = String(data.get('nif') ?? '').trim()
          if (nif !== '' && !isValidPortugueseNif(nif)) { setShopError('Enter a valid Portuguese NIF.'); return }
          const limitRaw = String(data.get('credit_limit') ?? '').trim()
          const creditLimit = limitRaw === '' ? null : parseEuros(limitRaw)
          if (limitRaw !== '' && creditLimit == null) { setShopError('Enter the credit limit in euros, for example 50,00.'); return }
          await saveLocal('customers', {
            ...shop,
            shop_name: data.get('shop_name'),
            phone: data.get('phone'),
            nif: nif || null,
            credit_limit: creditLimit,
            deleted_at: null,
          })
          setShopError('')
          setShopOpen(false)
          await onSaved()
        }}>
          <label className="control-line">Shop name
            <input name="shop_name" aria-label="Shop name" required className="control" defaultValue={String(shop.shop_name ?? '')} />
          </label>
          <label className="control-line">Phone
            <input name="phone" aria-label="Phone" className="control" defaultValue={String(shop.phone ?? '')} />
          </label>
          <label className="control-line">NIF
            <input name="nif" aria-label="NIF" className="control" defaultValue={String(shop.nif ?? '')} />
          </label>
          <label className="control-line">Credit limit
            <input name="credit_limit" aria-label="Credit limit" className="control" defaultValue={shop.credit_limit == null || shop.credit_limit === '' ? '' : centsToInput(Number(shop.credit_limit))} />
          </label>
          {shopError && <p className="warn">{shopError}</p>}
          <button className="btn">Save changes</button>
        </form>
      </Popup>
      <ArchiveDialog open={shopArchive} title="Archive shop" needsReason={false} onClose={() => setShopArchive(false)} onConfirm={async () => {
        await saveLocal('customers', { ...shop, deleted_at: new Date().toISOString() })
        offerUndo('Shop archived', async () => {
          await saveLocal('customers', { ...shop, deleted_at: null })
          await onSaved()
        })
        setShopArchive(false)
        await onSaved()
      }} />
      <div className="metrics">
        <article className="metric"><span>Bought</span><strong className="money">{centsToEuros(figures.boughtCents)}</strong></article>
        <article className="metric"><span>Paid</span><strong className="money">{centsToEuros(figures.paidCents)}</strong></article>
        <article className="metric"><span>Owed</span><strong className="money">{centsToEuros(figures.owedCents)}</strong></article>
        <article className="metric"><span>Orders</span><strong>{figures.orders}</strong></article>
        <article className="metric"><span>Last order</span><strong>{figures.lastOrder || '—'}</strong></article>
      </div>
      {canManage && (
        <label className="control-line">Status
          <select aria-label="Shop status" className="control" value={String(shop.status ?? 'lead')} onChange={async (event) => {
            await saveLocal('customers', { ...shop, status: event.target.value })
            await onSaved()
          }}>
            {PIPELINE_STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
          </select>
        </label>
      )}
      <div className="tabs">
        {(['Sales', 'Payments', 'Activities', 'Follow-ups', 'Notes'] as const).map((name) => (
          <button key={name} type="button" className={tab === name ? 'active' : ''} aria-pressed={tab === name} onClick={() => setTab(name)}>{name}</button>
        ))}
      </div>
      {tab === 'Sales' && <ul className="record-list">{sales.length === 0 && <li>No sales yet.</li>}{sales.map((sale) => <li key={String(sale.id)}><Link to={`/sales?invoice=${String(sale.id)}`}>{String(sale.invoice_no)}</Link> · {String(sale.date ?? '').slice(0, 10)}</li>)}</ul>}
      {tab === 'Payments' && <ul className="record-list">{tables.customer_payments.filter((row) => row.customer_id === id).length === 0 && <li>No payments yet.</li>}{tables.customer_payments.filter((row) => row.customer_id === id).map((row) => <li key={String(row.id)}>{centsToEuros(Number(row.amount))} · {String(row.created_at ?? '').slice(0, 10)}</li>)}</ul>}
      {tab === 'Notes' && (
        <form className="form-grid" onSubmit={async (event) => {
          event.preventDefault()
          await saveLocal('customers', { ...shop, notes })
          await onSaved()
        }}>
          <label className="control-line">Notes
            <textarea aria-label="Notes" className="control" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <button className="btn">Save notes</button>
        </form>
      )}
      {tab === 'Activities' && (
        <>
          {canManage && <button type="button" className="btn" onClick={() => { setActivityId(''); setActivityBody(''); setActivityOpen(true) }}>New activity</button>}
          {canManage && (
            <Popup title={activityId ? 'Edit activity' : 'New activity'} open={activityOpen} onClose={() => setActivityOpen(false)}>
            <form className="form-grid" onSubmit={async (event) => {
              event.preventDefault()
              const form = event.currentTarget
              const data = new FormData(form)
              const body = String(data.get('body') ?? '').trim()
              if (!body) { setError('Write what happened.'); return }
              const existing = tables.customer_activities.find((row) => row.id === activityId)
              await saveLocal('customer_activities', { ...(existing ?? {}), id: activityId || uuidv7(), customer_id: id, type: data.get('type'), body, happened_at: existing?.happened_at ?? new Date().toISOString(), deleted_at: null })
              setActivityId('')
              setActivityBody('')
              setError('')
              setActivityOpen(false)
              await onSaved()
            }}>
              <label className="control-line">Activity type
                <select name="type" aria-label="Activity type" className="control" defaultValue={String(tables.customer_activities.find((row) => row.id === activityId)?.type ?? 'call')}><option value="call">Call</option><option value="visit">Visit</option><option value="whatsapp">WhatsApp</option><option value="note">Note</option></select>
              </label>
              <label className="control-line">What happened
                <input name="body" aria-label="Activity note" placeholder="What happened" className="control" value={activityBody} onChange={(event) => setActivityBody(event.target.value)} />
              </label>
              {error && <p className="error">{error}</p>}
              <button className="btn">{activityId ? 'Save changes' : 'Log activity'}</button>
            </form>
            </Popup>
          )}
          <ul className="record-list">{activities.map((row) => (
            <li key={String(row.id)}>
              <span>{String(row.type)} · {String(row.body)}</span>
              {canManage && <RowActions canWrite onPreview={() => setActivityPreview(String(row.id))} onEdit={() => { setActivityId(String(row.id)); setActivityBody(String(row.body ?? '')); setActivityOpen(true) }} onArchive={() => setArchiveActivity(String(row.id))} />}
            </li>
          ))}          </ul>
          <Popup title="Activity" open={activities.some((row) => row.id === activityPreview)} onClose={() => setActivityPreview('')}>
            {activities.filter((row) => row.id === activityPreview).map((row) => (
              <p className="lede" key={String(row.id)}>{String(row.type)} · {String(row.body)}</p>
            ))}
          </Popup>
          <ArchiveDialog open={archiveActivity !== ''} title="Archive activity" needsReason={false} onClose={() => setArchiveActivity('')} onConfirm={async () => {
            const row = tables.customer_activities.find((item) => item.id === archiveActivity)
            if (row) {
              await saveLocal('customer_activities', { ...row, deleted_at: new Date().toISOString() })
              offerUndo('Activity archived', async () => {
                await saveLocal('customer_activities', { ...row, deleted_at: null })
                await onSaved()
              })
            }
            setArchiveActivity('')
            await onSaved()
          }} />
        </>
      )}
      {tab === 'Follow-ups' && (
        <>
          {canManage && <button type="button" className="btn" onClick={() => { setFollowId(''); setFollowTitle(''); setFollowDue(todayStamp()); setFollowOpen(true) }}>New follow-up</button>}
          {canManage && (
            <Popup title={followId ? 'Edit follow-up' : 'New follow-up'} open={followOpen} onClose={() => setFollowOpen(false)}>
            <form className="form-grid" onSubmit={async (event) => {
              event.preventDefault()
              const form = event.currentTarget
              const data = new FormData(form)
              const title = String(data.get('title') ?? '').trim()
              if (!title) { setError('Give the follow-up a title.'); return }
              const existing = tables.follow_ups.find((row) => row.id === followId)
              await saveLocal('follow_ups', { ...(existing ?? {}), id: followId || uuidv7(), customer_id: id, title, type: existing?.type ?? 'call', due_at: data.get('due_at'), done_at: existing?.done_at ?? null, deleted_at: null })
              setFollowId('')
              setFollowTitle('')
              setError('')
              setFollowOpen(false)
              await onSaved()
            }}>
              <label className="control-line">Title
                <input name="title" aria-label="Follow-up title" placeholder="Title" required className="control" value={followTitle} onChange={(event) => setFollowTitle(event.target.value)} />
              </label>
              <label className="control-line">Due date
                <input name="due_at" aria-label="Due date" type="date" required className="control" value={followDue} onChange={(event) => setFollowDue(event.target.value)} />
              </label>
              <button className="btn">{followId ? 'Save changes' : 'Add follow-up'}</button>
            </form>
            </Popup>
          )}
          <ul className="record-list">{followUps.map((row) => (
            <li key={String(row.id)}>
              <span>{String(row.title)} · {String(row.due_at).slice(0, 10)}{row.done_at ? ' · Done' : ''}</span>
              {canManage && (
                <span className="quick-actions">
                  <button type="button" className="btn-ghost" onClick={() => { setFollowId(String(row.id)); setFollowTitle(String(row.title ?? '')); setFollowDue(String(row.due_at).slice(0, 10)); setFollowOpen(true) }}>Edit</button>
                  {!row.done_at && <button type="button" className="btn-ghost" onClick={() => void saveLocal('follow_ups', { ...row, done_at: new Date().toISOString() }).then(onSaved)}>Complete</button>}
                  <button type="button" className="btn-ghost" onClick={() => setArchiveFollow(String(row.id))}>Archive</button>
                </span>
              )}
            </li>
          ))}</ul>
          <ArchiveDialog open={archiveFollow !== ''} title="Archive follow-up" needsReason={false} onClose={() => setArchiveFollow('')} onConfirm={async () => {
            const row = tables.follow_ups.find((item) => item.id === archiveFollow)
            if (row) {
              await saveLocal('follow_ups', { ...row, deleted_at: new Date().toISOString() })
              offerUndo('Follow-up archived', async () => {
                await saveLocal('follow_ups', { ...row, deleted_at: null })
                await onSaved()
              })
            }
            setArchiveFollow('')
            await onSaved()
          }} />
        </>
      )}
    </section>
  )
}

export function Pipeline({ tables, canManage, onSaved }: { tables: LocalTables; canManage: boolean; onSaved: () => Promise<void> }) {
  const [dragging, setDragging] = useState('')

  async function move(customerId: string, status: string) {
    const shop = tables.customers.find((row) => row.id === customerId)
    if (!shop || !canManage) return
    await saveLocal('customers', { ...shop, status })
    await saveLocal('customer_activities', { id: uuidv7(), customer_id: customerId, type: 'note', body: `Moved to ${status.replace(/_/g, ' ')}`, happened_at: new Date().toISOString() })
    await onSaved()
  }

  return (
    <section className="page">
      <div className="page-head"><h1>Pipeline</h1></div>
      {tables.customers.length === 0 && <p className="quiet">No shops yet. <Link to="/customers?new=1">Add a shop</Link></p>}
      <div className="board">
        {PIPELINE_STAGES.map((stage) => {
          const shops = tables.customers.filter((row) => String(row.status ?? 'lead') === stage.id)
          return (
            <div key={stage.id} className="column" onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragging) void move(dragging, stage.id) }}>
              <h2>{stage.label} <span className="column-count">{shops.length}</span></h2>
              {shops.length === 0 && <p className="hint">Drag a shop here</p>}
              {shops.map((row) => (
                <article key={String(row.id)} className="shop-card" draggable={canManage} onDragStart={() => setDragging(String(row.id))}>
                  <Link to={`/customers/${String(row.id)}`}>{String(row.shop_name)}</Link>
                  {row.phone ? <p>{String(row.phone)}</p> : null}
                  {row.city ? <p>{String(row.city)}</p> : null}
                  {(() => {
                    const next = tables.follow_ups.filter((item) => item.customer_id === row.id && !item.done_at).sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)))[0]
                    return next ? <p>Next: {String(next.title)} · {String(next.due_at).slice(0, 10)}</p> : null
                  })()}
                </article>
              ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function FollowUps({ tables, canManage, onSaved }: { tables: LocalTables; canManage: boolean; onSaved: () => Promise<void> }) {
  const [bucket, setBucket] = useState<'Today' | 'Overdue' | 'Upcoming' | 'Done'>('Today')
  const [creating, setCreating] = useState(false)
  const [followParams, setFollowParams] = useSearchParams()
  useEffect(() => {
    if (followParams.get('new') !== '1') return
    setCreating(true)
    setFollowParams({}, { replace: true })
  }, [followParams, setFollowParams])
  const [editingId, setEditingId] = useState('')
  const [title, setTitle] = useState('')
  const [due, setDue] = useState(todayStamp())
  const [archiveId, setArchiveId] = useState('')
  const today = todayStamp()
  const rows = tables.follow_ups.filter((row) => followUpBucket(String(row.due_at), row.done_at ? String(row.done_at) : null, today) === bucket)
  const editing = tables.follow_ups.find((row) => row.id === editingId)

  return (
    <section className="page">
      <div className="page-head"><h1>Follow-ups</h1>{canManage && <button type="button" className="btn" onClick={() => { setTitle(''); setDue(todayStamp()); setCreating(true) }}>New follow-up</button>}</div>
      <div className="tabs">
        {(['Today', 'Overdue', 'Upcoming', 'Done'] as const).map((name) => (
          <button key={name} type="button" className={bucket === name ? 'active' : ''} aria-pressed={bucket === name} onClick={() => setBucket(name)}>{name}</button>
        ))}
      </div>
      <ul className="record-list">
        {rows.length === 0 && <li>{bucket === 'Today' ? 'Nothing due today' : `Nothing ${bucket.toLowerCase()}`}</li>}
        {rows.map((row) => {
          const shop = tables.customers.find((customer) => customer.id === row.customer_id)
          return (
            <li key={String(row.id)}>
              <span>{String(row.title)} · {shopLabel(shop?.shop_name)} · {String(row.due_at).slice(0, 10)}</span>
              <span className="quick-actions">
                {canManage && !row.done_at && (
                  <button type="button" className="btn-ghost" onClick={async () => {
                    const note = 'Completed'
                    await saveLocal('follow_ups', { ...row, done_at: new Date().toISOString() })
                    await saveLocal('customer_activities', { id: uuidv7(), customer_id: row.customer_id, type: 'note', body: `${String(row.title)}: ${note}`, happened_at: new Date().toISOString() })
                    await onSaved()
                  }}>Complete</button>
                )}
                <RowActions canWrite={canManage} onEdit={() => { setEditingId(String(row.id)); setTitle(String(row.title ?? '')); setDue(String(row.due_at).slice(0, 10)) }} onArchive={() => setArchiveId(String(row.id))} />
              </span>
            </li>
          )
        })}
      </ul>
      <Popup title="New follow-up" open={creating} onClose={() => setCreating(false)}>
        <form className="form-grid" onSubmit={async (event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          await saveLocal('follow_ups', { id: uuidv7(), customer_id: data.get('customer_id'), title: data.get('title'), type: 'call', due_at: data.get('due_at'), deleted_at: null })
          setCreating(false)
          await onSaved()
        }}>
          <label className="control-line">Shop
            <select name="customer_id" aria-label="Shop" className="control" required>{tables.customers.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.shop_name)}</option>)}</select>
          </label>
          <label className="control-line">Title
            <input name="title" aria-label="Follow-up title" required className="control" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="control-line">Due date
            <input name="due_at" aria-label="Due date" type="date" required className="control" value={due} onChange={(event) => setDue(event.target.value)} />
          </label>
          <button className="btn">Save follow-up</button>
        </form>
      </Popup>
      <Popup title="Edit follow-up" open={editing != null} onClose={() => setEditingId('')}>
        <form className="form-grid" onSubmit={async (event) => {
          event.preventDefault()
          if (!editing) return
          const data = new FormData(event.currentTarget)
          await saveLocal('follow_ups', { ...editing, title: data.get('title'), due_at: data.get('due_at'), deleted_at: null })
          setEditingId('')
          await onSaved()
        }}>
          <label className="control-line">Title
            <input name="title" aria-label="Follow-up title" required className="control" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="control-line">Due date
            <input name="due_at" aria-label="Due date" type="date" required className="control" value={due} onChange={(event) => setDue(event.target.value)} />
          </label>
          <button className="btn">Save changes</button>
        </form>
      </Popup>
      <ArchiveDialog open={archiveId !== ''} title="Archive follow-up" needsReason={false} onClose={() => setArchiveId('')} onConfirm={async () => {
        const row = tables.follow_ups.find((item) => item.id === archiveId)
        if (row) {
          await saveLocal('follow_ups', { ...row, deleted_at: new Date().toISOString() })
          offerUndo('Follow-up archived', async () => {
            await saveLocal('follow_ups', { ...row, deleted_at: null })
            await onSaved()
          })
        }
        setArchiveId('')
        await onSaved()
      }} />
    </section>
  )
}
