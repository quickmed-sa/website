import { useState, type FormEvent } from 'react'
import { usersService, type User } from '../services/users.service'
import { ApiError } from '../services/api'
import './ChangePasswordModal.css'

interface Props {
  user: User
  onSuccess: () => void
  onClose: () => void
}

export function ChangePasswordModal({ user, onSuccess, onClose }: Props) {
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [adminPassword,   setAdminPassword]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await usersService.changePassword(user._id, { newPassword, adminPassword })
      onSuccess()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to change password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cp-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Change password">
      <div className="cp-modal" onClick={e => e.stopPropagation()}>

        <div className="cp-header">
          <div>
            <h2 className="cp-title">Change Password</h2>
            <p className="cp-subtitle">for <strong>{user.name}</strong></p>
          </div>
          <button className="cp-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="cp-body" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="error" role="alert">{error}</div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="cp-new">New Password</label>
            <input
              id="cp-new"
              type="password"
              className="form-input"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Min. 6 characters"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="cp-confirm">Confirm Password</label>
            <input
              id="cp-confirm"
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Re-enter new password"
            />
          </div>

          <div className="cp-separator" />

          <div className="form-group">
            <label className="form-label" htmlFor="cp-admin">
              Your Password
              <span className="cp-auth-note"> — required for authorization</span>
            </label>
            <input
              id="cp-admin"
              type="password"
              className="form-input"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Enter your admin password"
            />
          </div>

          <div className="cp-footer">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving && <span className="cp-spinner" aria-hidden="true" />}
              {saving ? 'Changing…' : 'Change Password'}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
