import { useState, useEffect, useRef, type FormEvent } from 'react'
import { usersService, UserRole, UserStatus } from '../services/users.service'
import { ApiError } from '../services/api'
import './AddUserModal.css'

interface Props {
  onSuccess: () => void
  onClose: () => void
}

interface FormState {
  name: string
  email: string
  password: string
  role: UserRole | ''
  status: UserStatus
}

const EMPTY: FormState = {
  name:     '',
  email:    '',
  password: '',
  role:     '',
  status:   UserStatus.ACTIVE,
}

export function AddUserModal({ onSuccess, onClose }: Props) {
  const [form, setForm]       = useState<FormState>(EMPTY)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const overlayRef            = useRef<HTMLDivElement>(null)
  const firstInputRef         = useRef<HTMLInputElement>(null)

  useEffect(() => { firstInputRef.current?.focus() }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
    setError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.role) { setError('Please select a role.'); return }

    setLoading(true)
    setError(null)
    try {
      await usersService.create({
        name:     form.name.trim(),
        email:    form.email.trim(),
        password: form.password,
        role:     form.role,
        status:   form.status,
      })
      // Reset loading BEFORE calling onSuccess so the component is in a clean
      // state when the parent unmounts it — avoids setState-on-unmounted issues.
      setLoading(false)
      onSuccess()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create user.')
      setLoading(false)
    }
  }

  return (
    <div
      className="assign-modal-overlay"
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-user-title"
    >
      <div className="assign-modal add-user-modal">
        {/* Header */}
        <div className="assign-modal-header">
          <h2 className="assign-modal-title" id="add-user-title">Add New User</h2>
          <button
            className="assign-modal-close"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            &#x2715;
          </button>
        </div>

        {/* Form */}
        <form className="add-user-form" onSubmit={handleSubmit} noValidate>
          <div className="add-user-body">
            <div className="form-group">
              <label className="form-label" htmlFor="au-name">Full Name</label>
              <input
                ref={firstInputRef}
                id="au-name"
                className="form-input"
                type="text"
                required
                placeholder="e.g. Ravi Kumar"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="au-email">Email Address</label>
              <input
                id="au-email"
                className="form-input"
                type="email"
                required
                placeholder="ravi@example.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="au-password">Password</label>
              <input
                id="au-password"
                className="form-input"
                type="password"
                required
                minLength={6}
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="add-user-row">
              <div className="form-group">
                <label className="form-label" htmlFor="au-role">Role</label>
                <select
                  id="au-role"
                  className="form-input form-select"
                  required
                  value={form.role}
                  onChange={e => set('role', e.target.value as UserRole)}
                  disabled={loading}
                >
                  <option value="" disabled>Select role…</option>
                  {Object.values(UserRole).map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="au-status">Status</label>
                <select
                  id="au-status"
                  className="form-input form-select"
                  value={form.status}
                  onChange={e => set('status', e.target.value as UserStatus)}
                  disabled={loading}
                >
                  <option value={UserStatus.ACTIVE}>Active</option>
                  <option value={UserStatus.INACTIVE}>Inactive</option>
                </select>
              </div>
            </div>

            {error && (
              <p className="error add-user-error" role="alert">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="add-user-footer">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !form.name || !form.email || !form.password || !form.role}
            >
              {loading ? (
                <>
                  <span className="assign-modal-btn-spinner" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff' }} aria-hidden="true" />
                  Creating…
                </>
              ) : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
