import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  visitsService,
  type Visit,
  type VisitFilters,
  type PopulatedStore,
  type PopulatedUser,
  VisitStatus,
} from '../services/visits.service'
import { storesService } from '../services/stores.service'
import { usersService, UserRole } from '../services/users.service'
import { ApiError } from '../services/api'
import { authService } from '../services/auth.service'
import { exportVisitsToExcel } from '../utils/exportVisits'
import { downloadVisitPDF } from '../utils/pdfExport'
import './Visits.css'

// ── Shared presentational components ────────────────────────────────────────

function StatusBadge({ status }: { status: VisitStatus }) {
  const map: Record<VisitStatus, string> = {
    [VisitStatus.SCHEDULED]:  'badge badge-scheduled',
    [VisitStatus.INCOMPLETE]: 'badge badge-incomplete',
    [VisitStatus.OVERDUE]:    'badge badge-overdue',
    [VisitStatus.COMPLETED]:  'badge badge-completed',
    [VisitStatus.CANCELLED]:  'badge badge-cancelled',
  }
  return <span className={map[status]}>{status}</span>
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function shortId(id: string): string { return id.slice(-6).toUpperCase() }

function storeName(v: PopulatedStore | string): string {
  return typeof v === 'object' ? v.name : shortId(v)
}
function managerName(v: PopulatedUser | string): string {
  return typeof v === 'object' ? v.name : shortId(v)
}

// ── Query state ──────────────────────────────────────────────────────────────

interface QueryState {
  page:          number
  dateFrom:      string
  dateTo:        string
  storeId:       string
  areaManagerId: string
  status:        VisitStatus | ''
}

function localDate(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

const LIMIT = 20

// ── Main component ───────────────────────────────────────────────────────────

export function Visits() {
  const navigate = useNavigate()
  const currentRole = authService.getCurrentUser()?.role

  const [visits, setVisits]         = useState<Visit[]>([])
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [hasLoaded, setHasLoaded]   = useState(false)

  const [exporting,   setExporting]   = useState(false)
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null)

  // fetchKey: bumped after complete/cancel to re-trigger fetch without changing query
  const [fetchKey, setFetchKey] = useState(0)

  // Dropdown option lists
  const [storeOptions,   setStoreOptions]   = useState<{ _id: string; name: string }[]>([])
  const [managerOptions, setManagerOptions] = useState<{ _id: string; name: string }[]>([])

  // Combined filter + page state
  const [query, setQuery] = useState<QueryState>({
    page: 1, dateFrom: '', dateTo: '', storeId: '', areaManagerId: '', status: '',
  })

  // ── Load dropdown options once on mount ───────────────────────────────────

  useEffect(() => {
    storesService.getAll()
      .then(stores => setStoreOptions(stores.map(s => ({ _id: s._id, name: s.name }))))
      .catch(() => {/* filter optional — silently ignore */})

    usersService.getAll()
      .then(users => {
        const managers = users
          .filter(u => u.role === UserRole.AREA_MANAGER)
          .map(u => ({ _id: u._id, name: u.name }))
        setManagerOptions(managers)
      })
      .catch(() => {})
  }, [])

  // ── Main visits fetch ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const filters: VisitFilters = { page: query.page, limit: LIMIT }
    if (query.dateFrom)             filters.dateFrom      = query.dateFrom
    if (query.dateTo)               filters.dateTo        = query.dateTo
    if (query.storeId)              filters.storeId       = query.storeId
    if (query.areaManagerId)        filters.areaManagerId = query.areaManagerId
    if (query.status)               filters.status        = query.status

    visitsService.getAll(filters)
      .then(result => {
        if (cancelled) return
        setVisits(result.data)
        setTotal(result.total)
        setTotalPages(result.totalPages)
        setHasLoaded(true)
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Failed to load visits.')
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [query, fetchKey])

  // ── Export ─────────────────────────────────────────────────────────────────

  async function handleExport() {
    setExporting(true)
    try {
      const filters: VisitFilters = { page: 1, limit: 99999 }
      if (query.dateFrom)      filters.dateFrom      = query.dateFrom
      if (query.dateTo)        filters.dateTo        = query.dateTo
      if (query.storeId)       filters.storeId       = query.storeId
      if (query.areaManagerId) filters.areaManagerId = query.areaManagerId
      if (query.status)        filters.status        = query.status

      const result = await visitsService.getAll(filters)
      exportVisitsToExcel(result.data, 'visits')
    } catch {
      // silent — export errors are edge-cases; console will show details
    } finally {
      setExporting(false)
    }
  }

  // ── PDF download ───────────────────────────────────────────────────────────

  async function handlePDF(e: React.MouseEvent, visitId: string) {
    e.stopPropagation()
    setPdfLoadingId(visitId)
    try { await downloadVisitPDF(visitId) }
    catch (err) { console.error('PDF failed', err) }
    finally { setPdfLoadingId(null) }
  }

  // ── Filter helpers ─────────────────────────────────────────────────────────

  const hasFilters =
    query.dateFrom || query.dateTo || query.storeId || query.areaManagerId || query.status

  function clearFilters() {
    setQuery({ page: 1, dateFrom: '', dateTo: '', storeId: '', areaManagerId: '', status: '' })
  }

  function setQuickDate(offsetDays: number) {
    const d = localDate(offsetDays)
    setQuery(q => ({ ...q, page: 1, dateFrom: d, dateTo: d }))
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const showEmpty    = hasLoaded && !loading && !error && total === 0
  const showTable    = hasLoaded && !loading && !error && total > 0
  const showPaginate = showTable && totalPages > 1

  return (
    <div className="page">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Visits</h1>
          <p className="page-subtitle">Track area manager store visits and schedules</p>
        </div>
        <div className="visit-header-right">
          <span className="visit-count">
            {hasLoaded && !loading && (
              hasFilters
                ? `${total} filtered visit${total !== 1 ? 's' : ''}`
                : `${total} visit${total !== 1 ? 's' : ''}`
            )}
          </span>
          {hasLoaded && total > 0 && (
            <button
              className="btn btn-ghost btn-sm visit-export-btn"
              onClick={handleExport}
              disabled={exporting || loading}
              title="Export all filtered visits to Excel"
            >
              {exporting ? 'Exporting…' : 'Export Excel'}
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      {hasLoaded && (
        <div className="filter-bar">
          <div className="filter-date-group">
            <div className="filter-quick-dates">
              <button
                className={`btn btn-sm filter-quick-btn${query.dateFrom === localDate(0) && query.dateTo === localDate(0) ? ' active' : ''}`}
                onClick={() => setQuickDate(0)}
              >Today</button>
              <button
                className={`btn btn-sm filter-quick-btn${query.dateFrom === localDate(1) && query.dateTo === localDate(1) ? ' active' : ''}`}
                onClick={() => setQuickDate(1)}
              >Tomorrow</button>
            </div>
            <input
              type="date"
              className="form-input filter-input"
              value={query.dateFrom}
              max={query.dateTo || undefined}
              onChange={e => setQuery(q => ({ ...q, page: 1, dateFrom: e.target.value }))}
              aria-label="From date"
            />
            <span className="filter-date-sep">–</span>
            <input
              type="date"
              className="form-input filter-input"
              value={query.dateTo}
              min={query.dateFrom || undefined}
              onChange={e => setQuery(q => ({ ...q, page: 1, dateTo: e.target.value }))}
              aria-label="To date"
            />
          </div>
          <select
            className="form-input filter-input filter-select"
            value={query.status}
            onChange={e => setQuery(q => ({ ...q, page: 1, status: e.target.value as VisitStatus | '' }))}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {Object.values(VisitStatus).map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <select
            className="form-input filter-input filter-select"
            value={query.storeId}
            onChange={e => setQuery(q => ({ ...q, page: 1, storeId: e.target.value }))}
            aria-label="Filter by store"
          >
            <option value="">All stores</option>
            {storeOptions.map(s => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </select>
          {(currentRole === 'Admin' || currentRole === 'Operations') && (
            <select
              className="form-input filter-input filter-select"
              value={query.areaManagerId}
              onChange={e => setQuery(q => ({ ...q, page: 1, areaManagerId: e.target.value }))}
              aria-label="Filter by area manager"
            >
              <option value="">All managers</option>
              {managerOptions.map(m => (
                <option key={m._id} value={m._id}>{m.name}</option>
              ))}
            </select>
          )}
          {hasFilters && (
            <button className="btn btn-ghost btn-sm filter-clear" onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>
      )}

      {/* First-time loading */}
      {loading && !hasLoaded && (
        <div className="state-box">
          <div className="spinner" aria-label="Loading visits" />
          <p className="state-box-text">Loading visits…</p>
        </div>
      )}

      {/* Thin refresh bar for subsequent loads */}
      {loading && hasLoaded && (
        <div className="table-loading-bar" aria-label="Refreshing" />
      )}

      {!loading && error && (
        <div className="state-box">
          <div className="state-box-icon" aria-hidden="true">!</div>
          <p className="state-box-text">{error}</p>
          <button className="btn btn-ghost btn-sm" onClick={() => setFetchKey(k => k + 1)}>
            Retry
          </button>
        </div>
      )}

      {showEmpty && !hasFilters && (
        <div className="state-box">
          <div className="state-box-icon" aria-hidden="true">📅</div>
          <p className="state-box-text">No visits found.</p>
        </div>
      )}

      {showEmpty && hasFilters && (
        <div className="state-box">
          <div className="state-box-icon" aria-hidden="true">🔍</div>
          <p className="state-box-text">No visits match the current filters.</p>
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear filters</button>
        </div>
      )}

      {showTable && (
        <>
          {/* Desktop table */}
          <div className="table-wrap desktop-only">
            <table className="data-table" aria-label="Visits list">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Area Manager</th>
                  <th>Visit Date & Time</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visits.map(visit => (
                  <tr
                    key={visit._id}
                    className="row-clickable"
                    onClick={() => navigate(`/visits/${visit._id}`)}
                  >
                    <td>{storeName(visit.store)}</td>
                    <td>{managerName(visit.areaManager)}</td>
                    <td className="visit-date">{formatDateTime(visit.visitDate)}</td>
                    <td><StatusBadge status={visit.status} /></td>
                    <td onClick={e => e.stopPropagation()} style={{ width: '2rem', textAlign: 'center' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        title="Download PDF"
                        disabled={pdfLoadingId === visit._id}
                        onClick={e => handlePDF(e, visit._id)}
                        style={{ padding: '0.25rem 0.4rem' }}
                      >
                        {pdfLoadingId === visit._id ? (
                          <span className="spinner" style={{ width: '0.85rem', height: '0.85rem' }} />
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                          </svg>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="card-list mobile-only">
            {visits.map(visit => (
              <div
                key={visit._id}
                className="data-card data-card--clickable"
                onClick={() => navigate(`/visits/${visit._id}`)}
              >
                <div className="data-card-row">
                  <div>
                    <div className="data-card-name visit-date-big">{formatDateTime(visit.visitDate)}</div>
                    <div className="data-card-meta">ID: {shortId(visit._id)}</div>
                  </div>
                  <StatusBadge status={visit.status} />
                </div>
                <div className="data-card-row">
                  <span className="data-card-label">Store</span>
                  <span className="data-card-value">{storeName(visit.store)}</span>
                </div>
                <div className="data-card-row">
                  <span className="data-card-label">Manager</span>
                  <span className="data-card-value">{managerName(visit.areaManager)}</span>
                </div>
                <div style={{ marginTop: '0.5rem' }} onClick={e => e.stopPropagation()}>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={pdfLoadingId === visit._id}
                    onClick={e => handlePDF(e, visit._id)}
                  >
                    {pdfLoadingId === visit._id ? <><span className="spinner" /> Generating…</> : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        PDF
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {showPaginate && (
            <div className="pagination">
              <button
                className="btn btn-ghost btn-sm"
                disabled={query.page <= 1 || loading}
                onClick={() => setQuery(q => ({ ...q, page: q.page - 1 }))}
                aria-label="Previous page"
              >
                ← Prev
              </button>
              <span className="pagination-info">
                Page {query.page} of {totalPages}
                <span className="pagination-total"> · {total} visit{total !== 1 ? 's' : ''}</span>
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={query.page >= totalPages || loading}
                onClick={() => setQuery(q => ({ ...q, page: q.page + 1 }))}
                aria-label="Next page"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}


    </div>
  )
}
