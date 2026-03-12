import { useState, useEffect, useCallback } from 'react'
import { usersService, type User, UserStatus, UserRole } from '../services/users.service'
import { storesService, type Store } from '../services/stores.service'
import { ApiError } from '../services/api'
import { AssignModal } from '../components/AssignModal'
import { AddUserModal } from '../components/AddUserModal'
import { ChangePasswordModal } from '../components/ChangePasswordModal'
import './Users.css'

function StatusBadge({ status }: { status: UserStatus }) {
  const cls = status === UserStatus.ACTIVE ? 'badge badge-active' : 'badge badge-inactive'
  return <span className={cls}>{status}</span>
}

function RolePill({ role }: { role: UserRole }) {
  const cls: Record<UserRole, string> = {
    [UserRole.ADMIN]:        'role-pill role-admin',
    [UserRole.OPERATIONS]:   'role-pill role-operations',
    [UserRole.AREA_MANAGER]: 'role-pill role-manager',
    [UserRole.FRANCHISE]:    'role-pill role-franchise',
  }
  return <span className={cls[role]}>{role}</span>
}

/** Backend may return populated Store objects or plain string IDs — normalise to ID string. */
function toId(s: string | Store): string {
  return typeof s === 'string' ? s : s._id
}

/** Renders up to 2 store-name chips then a "+N more" overflow chip. */
function StoreChips({ rawStores, stores }: { rawStores: (string | Store)[]; stores: Store[] }) {
  const ids = rawStores.map(toId)

  if (ids.length === 0) {
    return <span className="assign-chips-empty">None</span>
  }

  const MAX      = 2
  const visible  = ids.slice(0, MAX)
  const overflow = ids.length - MAX

  return (
    <div className="assign-chips">
      {visible.map(id => {
        const store = stores.find(s => s._id === id)
        return (
          <span key={id} className="assign-chip" title={store?.name ?? id}>
            {store?.name ?? id}
          </span>
        )
      })}
      {overflow > 0 && (
        <span className="assign-chip assign-chip--more">+{overflow}</span>
      )}
    </div>
  )
}

export function Users() {
  const [users, setUsers]     = useState<User[]>([])
  const [stores, setStores]   = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [busyId, setBusyId]   = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  /** Which user's AssignModal is open (null = closed) */
  const [modalUserId, setModalUserId]       = useState<string | null>(null)
  const [changePwdUser, setChangePwdUser]   = useState<User | null>(null)
  const [showAddUser, setShowAddUser]       = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [userData, storeData] = await Promise.all([
        usersService.getAll(),
        storesService.getAll(),
      ])
      setUsers(userData)
      setStores(storeData)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Refetch only users (after assign/remove — stores list doesn't change)
  const refetchUsers = useCallback(async () => {
    try {
      const data = await usersService.getAll()
      setUsers(data)
    } catch {
      // Silently ignore; user can retry full page
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleToggle(user: User) {
    setBusyId(user._id)
    setActionError(null)
    try {
      if (user.status === UserStatus.ACTIVE) {
        await usersService.deactivate(user._id)
      } else {
        await usersService.activate(user._id)
      }
      await refetchUsers()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Action failed.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleAssignStore(storeId: string) {
    if (!modalUserId) return
    await usersService.assignStores(modalUserId, [storeId])
    await refetchUsers()
  }

  async function handleRemoveStore(storeId: string) {
    if (!modalUserId) return
    await usersService.removeStores(modalUserId, [storeId])
    await refetchUsers()
  }

  const modalUser    = users.find(u => u._id === modalUserId) ?? null
  const storeItems   = stores.map(s => ({
    _id:      s._id,
    label:    s.name,
    sublabel: `${s.city} · ${s.erpCode}`,
  }))

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">Manage staff accounts and permissions</p>
        </div>
        <div className="page-header-actions">
          <span className="user-count">{!loading && `${users.length} user${users.length !== 1 ? 's' : ''}`}</span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddUser(true)}>
            + Add User
          </button>
        </div>
      </div>

      {actionError && (
        <div className="error" role="alert" style={{ marginBottom: '1rem' }}>
          {actionError}
        </div>
      )}

      {loading && (
        <div className="state-box">
          <div className="spinner" aria-label="Loading users" />
          <p className="state-box-text">Loading users…</p>
        </div>
      )}

      {!loading && error && (
        <div className="state-box">
          <div className="state-box-icon" aria-hidden="true">!</div>
          <p className="state-box-text">{error}</p>
          <button className="btn btn-ghost btn-sm" onClick={fetchAll}>Retry</button>
        </div>
      )}

      {!loading && !error && users.length === 0 && (
        <div className="state-box">
          <div className="state-box-icon" aria-hidden="true">👤</div>
          <p className="state-box-text">No users found.</p>
        </div>
      )}

      {!loading && !error && users.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="table-wrap desktop-only">
            <table className="data-table" aria-label="Users list">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Stores</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user._id}>
                    <td>
                      <div className="cell-name">{user.name}</div>
                    </td>
                    <td className="cell-email">{user.email}</td>
                    <td><RolePill role={user.role} /></td>
                    <td><StatusBadge status={user.status} /></td>
                    <td>
                      {(user.role === UserRole.ADMIN || user.role === UserRole.OPERATIONS) ? (
                        <span className="assign-chip assign-chip--all">All Stores</span>
                      ) : (
                        <div className="cell-chips">
                          <StoreChips rawStores={user.stores} stores={stores} />
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setModalUserId(user._id)}
                            aria-label={`Manage stores for ${user.name}`}
                          >
                            Assign Stores
                          </button>
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="td-actions">
                        <button
                          className={`btn btn-sm ${user.status === UserStatus.ACTIVE ? 'btn-danger' : 'btn-primary'}`}
                          disabled={busyId === user._id}
                          onClick={() => handleToggle(user)}
                          aria-label={user.status === UserStatus.ACTIVE ? `Deactivate ${user.name}` : `Activate ${user.name}`}
                        >
                          {busyId === user._id
                            ? '…'
                            : user.status === UserStatus.ACTIVE
                              ? 'Deactivate'
                              : 'Activate'}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setChangePwdUser(user)}
                          aria-label={`Change password for ${user.name}`}
                        >
                          Change Pwd
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="card-list mobile-only">
            {users.map(user => (
              <div key={user._id} className="data-card">
                <div className="data-card-row">
                  <div>
                    <div className="data-card-name">{user.name}</div>
                    <div className="data-card-meta">{user.email}</div>
                  </div>
                  <StatusBadge status={user.status} />
                </div>
                <div className="data-card-row">
                  <span className="data-card-label">Role</span>
                  <RolePill role={user.role} />
                </div>
                <div className="data-card-row data-card-row--chips">
                  <span className="data-card-label">Stores</span>
                  {(user.role === UserRole.ADMIN || user.role === UserRole.OPERATIONS) ? (
                    <span className="assign-chip assign-chip--all">All Stores</span>
                  ) : (
                    <StoreChips rawStores={user.stores} stores={stores} />
                  )}
                </div>
                <div className="data-card-actions">
                  <button
                    className={`btn btn-sm ${user.status === UserStatus.ACTIVE ? 'btn-danger' : 'btn-primary'}`}
                    disabled={busyId === user._id}
                    onClick={() => handleToggle(user)}
                    aria-label={user.status === UserStatus.ACTIVE ? `Deactivate ${user.name}` : `Activate ${user.name}`}
                  >
                    {busyId === user._id
                      ? '…'
                      : user.status === UserStatus.ACTIVE
                        ? 'Deactivate'
                        : 'Activate'}
                  </button>
                  {user.role !== UserRole.ADMIN && user.role !== UserRole.OPERATIONS && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setModalUserId(user._id)}
                      aria-label={`Manage stores for ${user.name}`}
                    >
                      Stores
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setChangePwdUser(user)}
                    aria-label={`Change password for ${user.name}`}
                  >
                    Change Pwd
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add user modal */}
      {showAddUser && (
        <AddUserModal
          onSuccess={() => { setShowAddUser(false); refetchUsers() }}
          onClose={() => setShowAddUser(false)}
        />
      )}

      {/* Change password modal */}
      {changePwdUser && (
        <ChangePasswordModal
          user={changePwdUser}
          onSuccess={() => setChangePwdUser(null)}
          onClose={() => setChangePwdUser(null)}
        />
      )}

      {/* Assign stores modal */}
      {modalUser && (
        <AssignModal
          title={`Manage Stores for ${modalUser.name}`}
          allItems={storeItems}
          assignedIds={modalUser.stores.map(toId)}
          busy={false}
          onAssign={handleAssignStore}
          onRemove={handleRemoveStore}
          onClose={() => setModalUserId(null)}
        />
      )}
    </div>
  )
}
