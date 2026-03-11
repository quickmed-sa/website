import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  siteInspectionsService,
  type SiteInspection,
  type SIFilters,
  type SiteInspectionStage,
  type SIPopulatedStore,
} from '../services/site-inspections.service'
import { storesService, type Store, StoreType } from '../services/stores.service'
import { authService } from '../services/auth.service'
import { downloadSiteInspectionPDF } from '../utils/pdfExport'
import './SiteInspections.css'

const LIMIT = 20

// ── Helpers ────────────────────────────────────────────────────────────────────

function getStore(si: SiteInspection): SIPopulatedStore | null {
  return si.store && typeof si.store === 'object' ? (si.store as SIPopulatedStore) : null
}

function calcOpsScore(si: SiteInspection): string {
  const ops = si.operationsSubmission
  if (!ops) return '—'
  const sectionKeys = [
    'locationAndCatchment', 'visibilityAndAccessibility', 'shopSpecifications',
    'legalAndCompliance', 'powerWaterInfrastructure', 'competitionAnalysis',
    'commercialsAndFinancials', 'safetyAndSecurity', 'parkingAndLogistics',
    'growthAndExpansionPotential',
  ]
  let sum = 0, count = 0
  for (const key of sectionKeys) {
    const section = (ops as any)[key]
    if (!section) continue
    for (const val of Object.values(section)) {
      if (typeof val === 'number' && val >= 1 && val <= 5) { sum += val; count++ }
    }
  }
  if (count === 0) return '—'
  return `${Math.round((sum / (count * 5)) * 100)}%`
}

// ── Stage badge config ─────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<SiteInspectionStage, { cls: string; label: string }> = {
  pending_fo:    { cls: 'badge-inactive',   label: 'Pending FO' },
  pending_am:    { cls: 'badge-scheduled',  label: 'Pending AM' },
  pending_ops:   { cls: 'badge-warning',    label: 'Pending Ops' },
  pending_admin: { cls: 'badge-purple',     label: 'Pending Admin' },
  approved:      { cls: 'badge-approved',   label: 'Approved' },
  rejected:      { cls: 'badge-rejected',   label: 'Rejected' },
}

function StageBadge({ stage }: { stage: SiteInspectionStage }) {
  const cfg = STAGE_CONFIG[stage] ?? { cls: 'badge-inactive', label: stage }
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
}

// ── Query state ────────────────────────────────────────────────────────────────

interface QueryState {
  page: number
  stage: string
  storeId: string
  dateFrom: string
  dateTo: string
}

const DEFAULT_QUERY: QueryState = {
  page: 1,
  stage: '',
  storeId: '',
  dateFrom: '',
  dateTo: '',
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SiteInspections() {
  const navigate    = useNavigate()
  const currentUser = authService.getCurrentUser()
  const role        = currentUser?.role ?? ''

  const isAdmin  = role === 'Admin'
  const isOps    = role === 'Operations'
  const isAM     = role === 'Area Manager'
  const isFO     = role === 'Franchise'

  const [query,      setQuery]      = useState<QueryState>(DEFAULT_QUERY)
  const [rows,       setRows]       = useState<SiteInspection[]>([])
  const [total,      setTotal]      = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [stores,     setStores]     = useState<Store[]>([])

  // For AM: list of COCO pending stores to create new SI
  const [showNewSI,     setShowNewSI]     = useState(false)
  const [cocoStores,    setCocoStores]    = useState<Store[]>([])
  const [skipBusy,      setSkipBusy]      = useState<string | null>(null)
  const [skipError,     setSkipError]     = useState<string | null>(null)
  const [pdfLoadingId,  setPdfLoadingId]  = useState<string | null>(null)

  // Load stores for filter dropdown
  useEffect(() => {
    storesService.getAll().then(data => {
      setStores(Array.isArray(data) ? data : (data as any).data ?? [])
    }).catch(() => {})
  }, [])

  // For AM: load COCO pending stores
  useEffect(() => {
    if (!isAM) return
    storesService.getAll().then(data => {
      const all: Store[] = Array.isArray(data) ? data : (data as any).data ?? []
      setCocoStores(all.filter(s => s.type === StoreType.COCO && s.status === 'pending'))
    }).catch(() => {})
  }, [isAM])

  // Load SIs when query changes
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    const filters: SIFilters = { page: query.page, limit: LIMIT }
    if (query.stage)   filters.stage   = query.stage as SiteInspectionStage
    if (query.storeId) filters.storeId = query.storeId
    if (query.dateFrom) filters.dateFrom = query.dateFrom
    if (query.dateTo)   filters.dateTo   = query.dateTo

    siteInspectionsService
      .getAll(filters)
      .then(res => {
        if (cancelled) return
        setRows(res.data)
        setTotal(res.total)
        setTotalPages(res.totalPages)
      })
      .catch(err => {
        if (cancelled) return
        setError(err?.message ?? 'Failed to load site inspections')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [query])

  function setFilter(patch: Partial<QueryState>) {
    setQuery(q => ({ ...q, ...patch, page: 1 }))
  }

  async function handleSkipAM(siId: string) {
    setSkipBusy(siId)
    setSkipError(null)
    try {
      await siteInspectionsService.skipAreaManager(siId)
      // Refresh list
      setQuery(q => ({ ...q }))
    } catch (e: unknown) {
      setSkipError(e instanceof Error ? e.message : 'Skip failed.')
    } finally {
      setSkipBusy(null)
    }
  }

  const hasFilters = query.stage || query.storeId || query.dateFrom || query.dateTo

  // ── Per-row action buttons ─────────────────────────────────────────────────

  function RowActions({ si }: { si: SiteInspection }) {
    const s    = getStore(si)
    const stage = si.stage

    return (
      <div className="sis-row-actions">
        {/* FO can resume their own pending_fo */}
        {isFO && stage === 'pending_fo' && s && (
          <button
            className="btn btn-primary btn-sm"
            onClick={e => { e.stopPropagation(); navigate(`/site-inspection/${s._id}`) }}
          >
            Resume
          </button>
        )}

        {/* AM: Resume COCO (own creation wizard) or Review FOFO (AM review form) */}
        {isAM && stage === 'pending_am' && s && (
          <button
            className="btn btn-primary btn-sm"
            onClick={e => {
              e.stopPropagation()
              if (s.type === 'COCO') {
                navigate(`/site-inspection/${s._id}`)
              } else {
                navigate(`/site-inspections/${si._id}/area-manager`)
              }
            }}
          >
            {s.type === 'COCO' ? 'Resume' : 'Review'}
          </button>
        )}

        {/* Ops sees review button for pending_ops */}
        {(isOps || isAdmin) && stage === 'pending_ops' && (
          <button
            className="btn btn-primary btn-sm"
            onClick={e => { e.stopPropagation(); navigate(`/site-inspections/${si._id}/operations`) }}
          >
            Review
          </button>
        )}

        {/* Admin/Ops: skip AM for FOFO SIs at pending_am */}
        {(isAdmin || isOps) && stage === 'pending_am' && s?.type === 'FOFO' && (
          <button
            className="btn btn-ghost btn-sm"
            disabled={skipBusy === si._id}
            onClick={async e => { e.stopPropagation(); await handleSkipAM(si._id) }}
          >
            {skipBusy === si._id ? 'Skipping…' : 'Skip AM'}
          </button>
        )}

        {/* Admin: compare sites */}
        {isAdmin && s && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={e => { e.stopPropagation(); navigate(`/site-inspections/compare/${s._id}`) }}
            title="Compare all site inspections for this store"
          >
            Compare
          </button>
        )}

        {/* PDF download */}
        <button
          className="btn btn-ghost btn-sm"
          title="Download PDF"
          disabled={pdfLoadingId === si._id}
          onClick={async e => {
            e.stopPropagation()
            setPdfLoadingId(si._id)
            try { await downloadSiteInspectionPDF(si._id) }
            catch (err) { console.error('PDF failed', err) }
            finally { setPdfLoadingId(null) }
          }}
          style={{ padding: '0.25rem 0.4rem' }}
        >
          {pdfLoadingId === si._id ? (
            <span className="spinner" style={{ width: '0.85rem', height: '0.85rem' }} />
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          )}
        </button>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="sis-page">
      <div className="sis-header">
        <div>
          <h1 className="sis-title">Site Inspections</h1>
          {!loading && (
            <span className="sis-count">{total} record{total !== 1 ? 's' : ''}</span>
          )}
        </div>
        {/* New site inspection button for AM (COCO stores) */}
        {isAM && cocoStores.length > 0 && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowNewSI(true)}>
            + New Site Inspection
          </button>
        )}
      </div>

      {skipError && <p className="sis-error">{skipError}</p>}

      {/* New SI store picker modal */}
      {showNewSI && (
        <div className="sis-modal-backdrop" onClick={() => setShowNewSI(false)}>
          <div className="sis-modal" onClick={e => e.stopPropagation()}>
            <div className="sis-modal-header">
              <span>Select a COCO store</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowNewSI(false)}>✕</button>
            </div>
            <div className="sis-modal-body">
              {cocoStores.map(s => (
                <button
                  key={s._id}
                  className="sis-store-pick"
                  onClick={() => { setShowNewSI(false); navigate(`/site-inspection/${s._id}`) }}
                >
                  <span className="sis-store-pick-name">{s.name}</span>
                  <span className="sis-store-pick-meta">{s.city}, {s.state}{s.erpCode ? ` · ${s.erpCode}` : ''}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <select
          className="filter-select"
          value={query.stage}
          onChange={e => setFilter({ stage: e.target.value })}
          aria-label="Filter by stage"
        >
          <option value="">All stages</option>
          <option value="pending_fo">Pending FO</option>
          <option value="pending_am">Pending AM</option>
          <option value="pending_ops">Pending Ops</option>
          <option value="pending_admin">Pending Admin</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          className="filter-select"
          value={query.storeId}
          onChange={e => setFilter({ storeId: e.target.value })}
          aria-label="Filter by store"
        >
          <option value="">All stores</option>
          {stores.map(s => (
            <option key={s._id} value={s._id}>
              {s.name}{s.erpCode ? ` (${s.erpCode})` : ''}
            </option>
          ))}
        </select>

        <div className="filter-date-group">
          <input
            type="date"
            className="filter-input"
            value={query.dateFrom}
            onChange={e => setFilter({ dateFrom: e.target.value })}
            aria-label="From date"
            title="From date"
          />
          <span className="filter-date-sep">–</span>
          <input
            type="date"
            className="filter-input"
            value={query.dateTo}
            onChange={e => setFilter({ dateTo: e.target.value })}
            aria-label="To date"
            title="To date"
          />
        </div>

        {hasFilters && (
          <button className="filter-clear" onClick={() => setQuery(DEFAULT_QUERY)}>Clear</button>
        )}
      </div>

      {/* Error */}
      {error && <p className="sis-error">{error}</p>}

      {/* Loading */}
      {loading && (
        <div className="state-box">
          <span className="spinner" aria-label="Loading" />
          <span className="state-box-text">Loading…</span>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && rows.length === 0 && (
        <div className="state-box">
          <span className="state-box-icon">🔍</span>
          <span className="state-box-text">No site inspections found</span>
        </div>
      )}

      {/* Table + cards */}
      {!loading && rows.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="table-wrap desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Name</th>
                  <th>Stage</th>
                  <th>Score</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(si => {
                  const store  = getStore(si)
                  const score  = calcOpsScore(si)
                  const scoreNum = score !== '—' ? parseInt(score) : null
                  const mapsUrl = store?.location?.latitude && store?.location?.longitude
                    ? `https://www.google.com/maps?q=${store.location.latitude},${store.location.longitude}`
                    : null

                  return (
                    <tr
                      key={si._id}
                      className="row-clickable"
                      onClick={() => navigate(`/site-inspections/${si._id}`)}
                    >
                      <td>
                        <span className="sis-store-name">{store ? store.name : '—'}</span>
                        {store?.erpCode && <span className="sis-store-code">{store.erpCode}</span>}
                        {mapsUrl && (
                          <a
                            className="sis-maps-link"
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            title="Open in Google Maps"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
                              <circle cx="12" cy="10" r="3"/>
                            </svg>
                            Maps
                          </a>
                        )}
                      </td>
                      <td className="sis-inspector">{si.name ?? '—'}</td>
                      <td><StageBadge stage={si.stage} /></td>
                      <td>
                        <span className={`sis-score${scoreNum !== null ? (scoreNum >= 70 ? ' sis-score-good' : scoreNum >= 40 ? ' sis-score-mid' : ' sis-score-low') : ''}`}>
                          {score}
                        </span>
                      </td>
                      <td className="sis-date">
                        <span>{new Date(si.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <span className="sis-time">{new Date(si.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <RowActions si={si} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="card-list mobile-only">
            {rows.map(si => {
              const store = getStore(si)
              const score = calcOpsScore(si)
              const scoreNum = score !== '—' ? parseInt(score) : null

              return (
                <div
                  key={si._id}
                  className="data-card data-card--clickable"
                  onClick={() => navigate(`/site-inspections/${si._id}`)}
                >
                  <div className="data-card-row">
                    <div>
                      <div className="data-card-name">{store ? store.name : '—'}</div>
                      {store?.erpCode && <div className="data-card-meta">{store.erpCode}</div>}
                    </div>
                    <StageBadge stage={si.stage} />
                  </div>
                  {si.name && (
                    <div className="data-card-row">
                      <span className="data-card-label">Name</span>
                      <span className="data-card-value">{si.name}</span>
                    </div>
                  )}
                  <div className="data-card-row">
                    <span className="data-card-label">Score</span>
                    <span className={`data-card-value sis-score${scoreNum !== null ? (scoreNum >= 70 ? ' sis-score-good' : scoreNum >= 40 ? ' sis-score-mid' : ' sis-score-low') : ''}`}>
                      {score}
                    </span>
                  </div>
                  <div className="data-card-row">
                    <span className="data-card-label">Date</span>
                    <span className="data-card-value">
                      {new Date(si.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' '}
                      <span className="sis-time">{new Date(si.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                    </span>
                  </div>
                  <div className="data-card-row" onClick={e => e.stopPropagation()}>
                    <RowActions si={si} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            disabled={query.page <= 1}
            onClick={() => setQuery(q => ({ ...q, page: q.page - 1 }))}
          >
            Previous
          </button>
          <span className="pagination-info">Page {query.page} of {totalPages}</span>
          <button
            className="pagination-btn"
            disabled={query.page >= totalPages}
            onClick={() => setQuery(q => ({ ...q, page: q.page + 1 }))}
          >
            Next
          </button>
          <span className="pagination-total">{total} total</span>
        </div>
      )}
    </div>
  )
}
