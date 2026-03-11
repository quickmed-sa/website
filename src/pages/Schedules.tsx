import { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import {
  schedulesService,
  type Schedule,
  type ScheduleStore,
  type ScheduleFilters,
} from '../services/schedules.service'
import { usersService, UserRole, type User } from '../services/users.service'
import { storesService, StoreStatus, type Store } from '../services/stores.service'
import { authService } from '../services/auth.service'
import { ApiError } from '../services/api'
import { VisitStatus, type Visit } from '../services/visits.service'
import './Schedules.css'

// ── Date helpers ──────────────────────────────────────────────────────────────

const DAY_NAMES   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_FULL  = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December']

const _now = new Date()
const YEAR_OPTIONS = [_now.getFullYear() - 1, _now.getFullYear(), _now.getFullYear() + 1]

function getMonthBounds(year: number, month: number): { dateFrom: string; dateTo: string } {
  const mm      = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  return {
    dateFrom: `${year}-${mm}-01`,
    dateTo:   `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  }
}

/** Returns every YYYY-MM-DD string in the given month */
function getDatesInMonth(year: number, month: number): string[] {
  const lastDay = new Date(year, month, 0).getDate()
  const mm = String(month).padStart(2, '0')
  return Array.from({ length: lastDay }, (_, i) =>
    `${year}-${mm}-${String(i + 1).padStart(2, '0')}`,
  )
}

function todayUTC(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function isPastDate(isoDate: string): boolean {
  return new Date(isoDate) < todayUTC()
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatScheduleDate(isoDate: string): { day: string; date: string } {
  const d = new Date(isoDate)
  return {
    day:  DAY_NAMES[d.getUTCDay()],
    date: `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
  }
}

// ── Slot helpers ──────────────────────────────────────────────────────────────

type ChipColor = 'green' | 'red' | 'yellow' | 'grey'

function getChipColor(visit: Visit | string | null | undefined, scheduleDate: string): ChipColor {
  if (!visit || typeof visit === 'string') return 'grey'
  const { status } = visit as Visit
  if (status === VisitStatus.COMPLETED) return 'green'
  if (status === VisitStatus.CANCELLED) return 'grey'
  if (isPastDate(scheduleDate)) return 'red'
  return 'yellow'
}

function resolveStoreName(s: ScheduleStore | string): string {
  return typeof s === 'object' ? s.name : s
}

function resolveStoreId(s: ScheduleStore | string): string {
  return typeof s === 'object' ? s._id : s
}

function buildSlots(schedule: Schedule) {
  return Array.from({ length: 3 }, (_, i) => ({
    store: schedule.stores[i] ?? null,
    visit: (schedule.visitIds[i] ?? null) as Visit | null,
  }))
}

// ── Main component ────────────────────────────────────────────────────────────

export function Schedules() {
  const currentUser = authService.getCurrentUser()
  if (currentUser?.role !== 'Admin' && currentUser?.role !== 'Operations') return <Navigate to="/visits" replace />

  // ── Filter state ─────────────────────────────────────────────────────────
  const [selectedAMId,  setSelectedAMId]  = useState('')
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1)
  const [selectedYear,  setSelectedYear]  = useState(() => new Date().getFullYear())

  // ── Server data ───────────────────────────────────────────────────────────
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [managers,  setManagers]  = useState<User[]>([])
  const [stores,    setStores]    = useState<Store[]>([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [fetchKey,  setFetchKey]  = useState(0)

  // ── Edit state — existing schedule rows ───────────────────────────────────
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [editStores, setEditStores] = useState<string[]>([])
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState<string | null>(null)

  // ── Create state — empty date rows ────────────────────────────────────────
  // Per-date draft: key = YYYY-MM-DD, value = store ID slots ('' = unselected)
  // Default (no entry) behaves as [''] — one empty slot always shown
  const [draftStores,  setDraftStores]  = useState<Record<string, string[]>>({})
  const [creatingDate, setCreatingDate] = useState<string | null>(null)
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({})

  // ── Reset transient state when AM / month / year changes ─────────────────
  useEffect(() => {
    setEditingId(null)
    setEditStores([])
    setSaveError(null)
    setDraftStores({})
    setCreateErrors({})
  }, [selectedAMId, selectedMonth, selectedYear])

  // ── Load reference data once ──────────────────────────────────────────────
  useEffect(() => {
    usersService.getAll()
      .then(users => setManagers(users.filter(u => u.role === UserRole.AREA_MANAGER)))
      .catch(() => {})
    storesService.getAll()
      .then(all => setStores(all.filter(s => s.status === StoreStatus.ACTIVE)))
      .catch(() => {})
  }, [])

  // ── Fetch schedules for selected AM + month ───────────────────────────────
  useEffect(() => {
    if (!selectedAMId) {
      setSchedules([])
      setHasLoaded(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const { dateFrom, dateTo } = getMonthBounds(selectedYear, selectedMonth)
    const filters: ScheduleFilters = { areaManagerId: selectedAMId, limit: 200, dateFrom, dateTo }

    schedulesService.getAll(filters)
      .then(result => {
        if (cancelled) return
        setSchedules(result.data)
        setHasLoaded(true)
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Failed to load schedules.')
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [selectedAMId, selectedMonth, selectedYear, fetchKey])

  // ── Derived ───────────────────────────────────────────────────────────────

  const scheduleMap = useMemo(() => {
    const map = new Map<string, Schedule>()
    schedules.forEach(s => {
      map.set(new Date(s.date).toISOString().slice(0, 10), s)
    })
    return map
  }, [schedules])

  const allDates = useMemo(
    () => getDatesInMonth(selectedYear, selectedMonth),
    [selectedYear, selectedMonth],
  )

  const selectedAM  = managers.find(m => m._id === selectedAMId)

  /** Only the stores assigned to the selected AM */
  const filteredStores = useMemo(() => {
    if (!selectedAM) return []
    const assignedIds = new Set(
      selectedAM.stores.map(s => (typeof s === 'string' ? s : (s as { _id: string })._id)),
    )
    return stores.filter(s => assignedIds.has(s._id))
  }, [stores, selectedAM])

  const showContent = hasLoaded && !loading && !error && !!selectedAMId

  // ── Edit helpers ──────────────────────────────────────────────────────────

  function startEdit(schedule: Schedule) {
    setEditingId(schedule._id)
    setEditStores(schedule.stores.map(s => resolveStoreId(s)))
    setSaveError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditStores([])
    setSaveError(null)
  }

  function updateSlot(index: number, storeId: string) {
    setEditStores(prev => { const n = [...prev]; n[index] = storeId; return n })
  }

  function removeSlot(index: number) {
    setEditStores(prev => prev.filter((_, i) => i !== index))
  }

  function addSlot() {
    setEditStores(prev => [...prev, ''])
  }

  async function saveEdit(scheduleId: string) {
    const validIds = editStores.filter(Boolean)
    if (validIds.length === 0) { setSaveError('At least one store is required.'); return }
    setSaving(true)
    setSaveError(null)
    try {
      await schedulesService.update(scheduleId, { storeIds: validIds })
      setEditingId(null)
      setEditStores([])
      setFetchKey(k => k + 1)
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  // ── Create helpers ────────────────────────────────────────────────────────

  // Effective draft for a date: falls back to [''] so slot 0 always renders
  function getDraft(date: string): string[] {
    return draftStores[date] ?? ['']
  }

  function updateDraftSlot(date: string, index: number, storeId: string) {
    setDraftStores(prev => {
      const slots = [...(prev[date] ?? [''])]
      slots[index] = storeId
      return { ...prev, [date]: slots }
    })
  }

  function removeDraftSlot(date: string, index: number) {
    setDraftStores(prev => {
      const slots = (prev[date] ?? ['']).filter((_, i) => i !== index)
      return { ...prev, [date]: slots.length > 0 ? slots : [''] }
    })
  }

  function addDraftSlot(date: string) {
    setDraftStores(prev => ({
      ...prev,
      [date]: [...(prev[date] ?? ['']), ''],
    }))
  }

  async function createSchedule(date: string) {
    const validIds = getDraft(date).filter(Boolean)
    if (validIds.length === 0) return
    setCreatingDate(date)
    setCreateErrors(prev => { const n = { ...prev }; delete n[date]; return n })
    try {
      await schedulesService.create({ areaManagerId: selectedAMId, date, storeIds: validIds })
      setDraftStores(prev => { const n = { ...prev }; delete n[date]; return n })
      setFetchKey(k => k + 1)
    } catch (err) {
      setCreateErrors(prev => ({
        ...prev,
        [date]: err instanceof ApiError ? err.message : 'Create failed.',
      }))
    } finally {
      setCreatingDate(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Visit Schedules</h1>
          <p className="page-subtitle">View and manage area manager visit schedules</p>
        </div>
      </div>

      {/* Controls */}
      <div className="sc-controls">
        <div className="sc-am-group form-group">
          <label className="form-label" htmlFor="sc-am-select">Area Manager</label>
          <select
            id="sc-am-select"
            className="form-input sc-am-select"
            value={selectedAMId}
            onChange={e => setSelectedAMId(e.target.value)}
          >
            <option value="">— Select area manager —</option>
            {managers.map(m => (
              <option key={m._id} value={m._id}>{m.name}</option>
            ))}
          </select>
        </div>

        {selectedAMId && (
          <div className="sc-month-group form-group">
            <label className="form-label">Month</label>
            <div className="sc-month-row">
              <select
                className="form-input sc-month-select"
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                aria-label="Select month"
              >
                {MONTH_FULL.map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
              <select
                className="form-input sc-year-select"
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                aria-label="Select year"
              >
                {YEAR_OPTIONS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* No AM selected */}
      {!selectedAMId && (
        <div className="state-box sc-state-box">
          <div className="state-box-icon">👤</div>
          <p className="state-box-text">Select an area manager above to view their schedule.</p>
        </div>
      )}

      {/* Initial load */}
      {selectedAMId && loading && !hasLoaded && (
        <div className="state-box sc-state-box">
          <div className="sc-spinner" aria-label="Loading" />
          <p className="state-box-text">Loading schedule for {selectedAM?.name}…</p>
        </div>
      )}

      {/* Refresh bar */}
      {selectedAMId && loading && hasLoaded && (
        <div className="sc-loading-bar" aria-label="Refreshing" />
      )}

      {/* Error */}
      {!loading && error && (
        <div className="state-box sc-state-box">
          <div className="state-box-icon">⚠</div>
          <p className="state-box-text">{error}</p>
          <button className="btn btn-ghost btn-sm" onClick={() => setFetchKey(k => k + 1)}>
            Retry
          </button>
        </div>
      )}

      {/* Full month table */}
      {showContent && (
        <>
          <div className="table-wrap sc-table-wrap">
            <table className="data-table sc-table" aria-label="Visit schedule">
              <thead>
                <tr>
                  <th className="sc-th-date">Date &amp; Day</th>
                  <th>Store 1</th>
                  <th>Store 2</th>
                  <th>Store 3</th>
                  <th className="sc-th-actions"></th>
                </tr>
              </thead>
              <tbody>
                {allDates.map(dateStr => {
                  const schedule  = scheduleMap.get(dateStr)
                  const { day, date } = formatScheduleDate(dateStr)
                  const past      = isPastDate(dateStr)
                  const isToday   = dateStr === todayISO()

                  const rowClass = [
                    'sc-row',
                    schedule ? 'sc-row-filled' : 'sc-row-empty',
                    isToday ? 'sc-row-today' : '',
                    past    ? 'sc-row-past'  : '',
                  ].filter(Boolean).join(' ')

                  const dateCellContent = (
                    <td className="sc-date-cell">
                      <span className="sc-day-name">{day}</span>
                      <span className="sc-date-str">{date}</span>
                      {isToday && <span className="sc-today-badge">Today</span>}
                    </td>
                  )

                  // ── Existing schedule ──────────────────────────────────
                  if (schedule) {
                    const isEditing = editingId === schedule._id
                    const slots = buildSlots(schedule)

                    return (
                      <tr key={dateStr} className={rowClass}>
                        {dateCellContent}

                        {[0, 1, 2].map(i => {
                          const takenInEdit = new Set(editStores.filter((id, j) => j !== i && id))
                          return (
                          <td key={i} className="sc-slot-cell">
                            {isEditing ? (
                              editStores[i] !== undefined ? (
                                <div className="sc-slot-edit">
                                  <select
                                    className="form-input sc-slot-select"
                                    value={editStores[i]}
                                    onChange={e => updateSlot(i, e.target.value)}
                                    disabled={saving}
                                  >
                                    <option value="">Select store…</option>
                                    {filteredStores
                                      .filter(s => !takenInEdit.has(s._id) || s._id === editStores[i])
                                      .map(s => (
                                      <option key={s._id} value={s._id}>{s.name}</option>
                                    ))}
                                  </select>
                                  <button
                                    className="sc-remove-btn"
                                    onClick={() => removeSlot(i)}
                                    disabled={saving}
                                    title="Remove"
                                    aria-label="Remove store"
                                  >×</button>
                                </div>
                              ) : (
                                i === editStores.length && editStores.length < 3 ? (
                                  <button
                                    className="btn btn-ghost btn-sm sc-add-btn"
                                    onClick={addSlot}
                                    disabled={saving}
                                  >+ Add</button>
                                ) : null
                              )
                            ) : (
                              slots[i].store ? (
                                <span className={`sc-chip sc-chip-${getChipColor(slots[i].visit, dateStr)}`}>
                                  {resolveStoreName(slots[i].store as ScheduleStore | string)}
                                </span>
                              ) : (
                                <span className="sc-empty">—</span>
                              )
                            )}
                          </td>
                        )})}

                        <td className="sc-actions-cell">
                          {!past && (
                            isEditing ? (
                              <div className="sc-row-actions">
                                {saveError && <span className="sc-save-error">{saveError}</span>}
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => saveEdit(schedule._id)}
                                  disabled={saving || editStores.filter(Boolean).length === 0}
                                >
                                  {saving ? '…' : 'Save'}
                                </button>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={cancelEdit}
                                  disabled={saving}
                                >Cancel</button>
                              </div>
                            ) : (
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => startEdit(schedule)}
                              >Edit</button>
                            )
                          )}
                        </td>
                      </tr>
                    )
                  }

                  // ── Empty date (no schedule yet) ───────────────────────
                  const draft      = getDraft(dateStr)
                  const validCount = draft.filter(Boolean).length
                  const isCreating = creatingDate === dateStr
                  const cError     = createErrors[dateStr]

                  return (
                    <tr key={dateStr} className={rowClass}>
                      {dateCellContent}

                      {[0, 1, 2].map(i => {
                        const takenInDraft = new Set(draft.filter((id, j) => j !== i && id))
                        return (
                        <td key={i} className="sc-slot-cell">
                          {past ? (
                            <span className="sc-empty">—</span>
                          ) : draft[i] !== undefined ? (
                            <div className="sc-slot-edit">
                              <select
                                className="form-input sc-slot-select"
                                value={draft[i]}
                                onChange={e => updateDraftSlot(dateStr, i, e.target.value)}
                                disabled={isCreating}
                              >
                                <option value="">Select store…</option>
                                {filteredStores
                                  .filter(s => !takenInDraft.has(s._id) || s._id === draft[i])
                                  .map(s => (
                                  <option key={s._id} value={s._id}>{s.name}</option>
                                ))}
                              </select>
                              {i > 0 && (
                                <button
                                  className="sc-remove-btn"
                                  onClick={() => removeDraftSlot(dateStr, i)}
                                  disabled={isCreating}
                                  title="Remove"
                                  aria-label="Remove store"
                                >×</button>
                              )}
                            </div>
                          ) : (
                            i === draft.length && draft.length < 3 ? (
                              <button
                                className="btn btn-ghost btn-sm sc-add-btn"
                                onClick={() => addDraftSlot(dateStr)}
                                disabled={isCreating}
                              >+ Add</button>
                            ) : null
                          )}
                        </td>
                      )})}

                      <td className="sc-actions-cell">
                        {!past && (
                          <div className="sc-row-actions">
                            {cError && <span className="sc-save-error">{cError}</span>}
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => createSchedule(dateStr)}
                              disabled={isCreating || validCount === 0}
                            >
                              {isCreating ? '…' : 'Create'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="sc-legend">
            <div className="sc-legend-item">
              <span className="sc-chip sc-chip-green">Store</span>
              <span className="sc-legend-label">Completed</span>
            </div>
            <div className="sc-legend-item">
              <span className="sc-chip sc-chip-yellow">Store</span>
              <span className="sc-legend-label">Scheduled</span>
            </div>
            <div className="sc-legend-item">
              <span className="sc-chip sc-chip-red">Store</span>
              <span className="sc-legend-label">Missed (past)</span>
            </div>
            <div className="sc-legend-item">
              <span className="sc-chip sc-chip-grey">Store</span>
              <span className="sc-legend-label">Cancelled</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
