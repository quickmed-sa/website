import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { storesService, type Store, type AllocatedUser, StoreStatus } from '../services/stores.service'
import { usersService, type User, UserRole } from '../services/users.service'
import { ApiError } from '../services/api'
import { authService } from '../services/auth.service'
import { AssignModal } from '../components/AssignModal'
import { AddStoreModal } from '../components/AddStoreModal'
import { EditStoreModal } from '../components/EditStoreModal'
import './Stores.css'

function StatusBadge({ status }: { status: StoreStatus }) {
  const map: Record<StoreStatus, string> = {
    [StoreStatus.PENDING]:  'badge badge-pending',
    [StoreStatus.APPROVED]: 'badge badge-approved',
    [StoreStatus.ACTIVE]:   'badge badge-active',
    [StoreStatus.REJECTED]: 'badge badge-rejected',
  }
  return <span className={map[status]}>{status}</span>
}

type ActionKey = 'resubmit'

function StoreActions({
  store,
  busy,
  onAction,
  onSiteInspect,
  onEdit,
}: {
  store: Store
  busy: boolean
  onAction: (id: string, action: ActionKey) => void
  onSiteInspect?: (id: string) => void
  onEdit?: () => void
}) {
  const editBtn = onEdit && (
    <button
      className="btn btn-ghost btn-sm"
      onClick={onEdit}
      aria-label={`Edit ${store.name}`}
    >
      Edit
    </button>
  )

  switch (store.status) {
    case StoreStatus.PENDING:
      return (
        <div className="td-actions">
          {onSiteInspect && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onSiteInspect(store._id)}
            >
              Site Inspect
            </button>
          )}
          {editBtn}
        </div>
      )
    case StoreStatus.APPROVED:
      return (
        <div className="td-actions">
          {editBtn}
        </div>
      )
    case StoreStatus.REJECTED:
      return (
        <div className="td-actions">
          <button
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => onAction(store._id, 'resubmit')}
          >
            Resubmit
          </button>
          {editBtn}
        </div>
      )
    case StoreStatus.ACTIVE:
    default:
      return onEdit
        ? <div className="td-actions">{editBtn}</div>
        : <span className="no-actions">—</span>
  }
}

/** Normalise an allocatedUsers entry to a plain object with _id + name. */
function toUserObj(u: AllocatedUser | string): AllocatedUser {
  return typeof u === 'string' ? { _id: u, name: u, email: '' } : u
}

/** Renders up to 2 user-name chips then a "+N more" overflow chip. */
function UserChips({ allocatedUsers }: { allocatedUsers: (AllocatedUser | string)[] }) {
  const users = allocatedUsers.map(toUserObj)

  if (users.length === 0) {
    return <span className="assign-chips-empty">None</span>
  }

  const MAX      = 2
  const visible  = users.slice(0, MAX)
  const overflow = users.length - MAX

  return (
    <div className="assign-chips">
      {visible.map(u => (
        <span key={u._id} className="assign-chip" title={u.name}>
          {u.name}
        </span>
      ))}
      {overflow > 0 && (
        <span className="assign-chip assign-chip--more">+{overflow}</span>
      )}
    </div>
  )
}

export function Stores() {
  const isAdmin  = authService.getCurrentUser()?.role === 'Admin' || authService.getCurrentUser()?.role === 'Operations'
  const navigate = useNavigate()

  function handleSiteInspect(storeId: string) {
    navigate(`/site-inspection/${storeId}`)
  }

  const [stores, setStores]     = useState<Store[]>([])
  const [users, setUsers]       = useState<User[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [busyId, setBusyId]     = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  /** Which store's AssignModal is open (null = closed) */
  const [modalStoreId, setModalStoreId] = useState<string | null>(null)
  const [showAddStore, setShowAddStore] = useState(false)
  const [editStoreId,  setEditStoreId]  = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (isAdmin) {
        const [storeData, userData] = await Promise.all([
          storesService.getAll(),
          usersService.getAll(),
        ])
        setStores(storeData)
        setUsers(userData)
      } else {
        const storeData = await storesService.getAll()
        setStores(storeData)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load stores.')
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  // Refetch only stores — allocatedUsers is now embedded in the store response
  const refetchStores = useCallback(async () => {
    try {
      const data = await storesService.getAll()
      setStores(data)
    } catch {
      // Silently ignore; user can retry full page
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleAction(id: string, action: ActionKey) {
    setBusyId(id)
    setActionError(null)
    try {
      await storesService[action](id)
      // Only stores list changes for status actions
      const data = await storesService.getAll()
      setStores(data)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Action failed.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleAssignUser(userId: string) {
    if (!modalStoreId) return
    await usersService.assignStores(userId, [modalStoreId])
    await refetchStores()
  }

  async function handleRemoveUser(userId: string) {
    if (!modalStoreId) return
    await usersService.removeStores(userId, [modalStoreId])
    await refetchStores()
  }

  const modalStore      = stores.find(s => s._id === modalStoreId) ?? null
  const assignedUserIds = modalStore ? modalStore.allocatedUsers.map(u => toUserObj(u)._id) : []
  const userItems       = users
    .filter(u => u.role !== UserRole.ADMIN && u.role !== UserRole.OPERATIONS)
    .map(u => ({
      _id:      u._id,
      label:    u.name,
      sublabel: u.email,
    }))

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Stores</h1>
          <p className="page-subtitle">Manage franchise and COCO store registrations</p>
        </div>
        <div className="page-header-actions">
          <span className="store-count">{!loading && `${stores.length} store${stores.length !== 1 ? 's' : ''}`}</span>
          {isAdmin && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowAddStore(true)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5"  y1="12" x2="19" y2="12"/>
              </svg>
              Add Store
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="error" role="alert" style={{ marginBottom: '1rem' }}>
          {actionError}
        </div>
      )}

      {loading && (
        <div className="state-box">
          <div className="spinner" aria-label="Loading stores" />
          <p className="state-box-text">Loading stores…</p>
        </div>
      )}

      {!loading && error && (
        <div className="state-box">
          <div className="state-box-icon" aria-hidden="true">!</div>
          <p className="state-box-text">{error}</p>
          <button className="btn btn-ghost btn-sm" onClick={fetchAll}>Retry</button>
        </div>
      )}

      {!loading && !error && stores.length === 0 && (
        <div className="state-box">
          <div className="state-box-icon" aria-hidden="true">🏪</div>
          <p className="state-box-text">No stores yet.{isAdmin ? ' Add your first store to get started.' : ''}</p>
          {isAdmin && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddStore(true)}>
              Add Store
            </button>
          )}
        </div>
      )}

      {!loading && !error && stores.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="table-wrap desktop-only">
            <table className="data-table" aria-label="Stores list">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>ERP Code</th>
                  <th>City</th>
                  <th>Type</th>
                  <th>Status</th>
                  {isAdmin && <th>Users</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stores.map(store => (
                  <tr key={store._id}>
                    <td>
                      <div className="cell-name">{store.name}</div>
                      <div className="cell-sub">{store.state}</div>
                      {store.status !== StoreStatus.PENDING &&
                        store.location?.latitude && store.location?.longitude && (
                        <a
                          className="as-maps-link"
                          href={`https://www.google.com/maps?q=${store.location.latitude},${store.location.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open in Google Maps"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
                            <circle cx="12" cy="10" r="3"/>
                          </svg>
                          Maps
                        </a>
                      )}
                    </td>
                    <td><code className="erp-code">{store.erpCode}</code></td>
                    <td>{store.city}</td>
                    <td><span className="type-tag">{store.type}</span></td>
                    <td><StatusBadge status={store.status} /></td>
                    {isAdmin && (
                      <td>
                        <div className="cell-chips">
                          <UserChips allocatedUsers={store.allocatedUsers} />
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setModalStoreId(store._id)}
                            aria-label={`Manage users for ${store.name}`}
                          >
                            Assign Users
                          </button>
                        </div>
                      </td>
                    )}
                    <td>
                      <StoreActions
                        store={store}
                        busy={busyId === store._id}
                        onAction={handleAction}
                        onSiteInspect={handleSiteInspect}
                        onEdit={isAdmin ? () => setEditStoreId(store._id) : undefined}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="card-list mobile-only">
            {stores.map(store => (
              <div key={store._id} className="data-card">
                <div className="data-card-row">
                  <div>
                    <div className="data-card-name">{store.name}</div>
                    <div className="data-card-meta">{store.city}, {store.state}</div>
                    {store.status !== StoreStatus.PENDING &&
                      store.location?.latitude && store.location?.longitude && (
                      <a
                        className="as-maps-link"
                        href={`https://www.google.com/maps?q=${store.location.latitude},${store.location.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in Google Maps"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                        Maps
                      </a>
                    )}
                  </div>
                  <StatusBadge status={store.status} />
                </div>
                <div className="data-card-row">
                  <span className="data-card-label">ERP Code</span>
                  <code className="erp-code data-card-value">{store.erpCode}</code>
                </div>
                <div className="data-card-row">
                  <span className="data-card-label">Type</span>
                  <span className="type-tag data-card-value">{store.type}</span>
                </div>
                {isAdmin && (
                  <div className="data-card-row data-card-row--chips">
                    <span className="data-card-label">Users</span>
                    <UserChips allocatedUsers={store.allocatedUsers} />
                  </div>
                )}
                <div className="data-card-actions">
                  <StoreActions
                    store={store}
                    busy={busyId === store._id}
                    onAction={handleAction}
                    onSiteInspect={handleSiteInspect}
                    onEdit={isAdmin ? () => setEditStoreId(store._id) : undefined}
                  />
                  {isAdmin && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setModalStoreId(store._id)}
                      aria-label={`Manage users for ${store.name}`}
                    >
                      Users
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Assign users modal */}
      {modalStore && (
        <AssignModal
          title={`Manage Users for ${modalStore.name}`}
          allItems={userItems}
          assignedIds={assignedUserIds}
          busy={false}
          onAssign={handleAssignUser}
          onRemove={handleRemoveUser}
          onClose={() => setModalStoreId(null)}
        />
      )}

      {/* Add store modal */}
      {showAddStore && (
        <AddStoreModal
          onCreated={async () => {
            setShowAddStore(false)
            await fetchAll()
          }}
          onClose={() => setShowAddStore(false)}
        />
      )}

      {/* Edit store modal */}
      {editStoreId && (() => {
        const editStore = stores.find(s => s._id === editStoreId)
        return editStore ? (
          <EditStoreModal
            store={editStore}
            onUpdated={async () => {
              setEditStoreId(null)
              await refetchStores()
            }}
            onClose={() => setEditStoreId(null)}
          />
        ) : null
      })()}
    </div>
  )
}
