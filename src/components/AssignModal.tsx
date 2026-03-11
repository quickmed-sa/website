import { useState, useEffect, useRef, useCallback } from 'react'
import './AssignModal.css'

export interface AssignItem {
  _id: string
  label: string
  sublabel?: string
}

export interface AssignModalProps {
  title: string
  allItems: AssignItem[]
  assignedIds: string[]
  busy: boolean
  onAssign: (id: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onClose: () => void
}

/**
 * Generic bidirectional linking modal.
 * Renders a dark overlay; clicking the overlay closes the modal.
 * Tracks per-item busy state independently of the parent's busy flag.
 */
export function AssignModal({
  title,
  allItems,
  assignedIds,
  busy,
  onAssign,
  onRemove,
  onClose,
}: AssignModalProps) {
  const [query, setQuery]         = useState('')
  const [busyItem, setBusyItem]   = useState<string | null>(null)
  const searchRef                 = useRef<HTMLInputElement>(null)
  const overlayRef                = useRef<HTMLDivElement>(null)

  // Focus search on mount
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === overlayRef.current) onClose()
    },
    [onClose],
  )

  const lowerQuery  = query.toLowerCase().trim()
  const assigned    = allItems.filter(item => assignedIds.includes(item._id))
  const available   = allItems.filter(item => !assignedIds.includes(item._id))

  const filteredAssigned  = lowerQuery
    ? assigned.filter(
        item =>
          item.label.toLowerCase().includes(lowerQuery) ||
          item.sublabel?.toLowerCase().includes(lowerQuery),
      )
    : assigned

  const filteredAvailable = lowerQuery
    ? available.filter(
        item =>
          item.label.toLowerCase().includes(lowerQuery) ||
          item.sublabel?.toLowerCase().includes(lowerQuery),
      )
    : available

  async function handleAssign(id: string) {
    if (busyItem || busy) return
    setBusyItem(id)
    try {
      await onAssign(id)
    } finally {
      setBusyItem(null)
    }
  }

  async function handleRemove(id: string) {
    if (busyItem || busy) return
    setBusyItem(id)
    try {
      await onRemove(id)
    } finally {
      setBusyItem(null)
    }
  }

  return (
    <div
      className="assign-modal-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="assign-modal">
        {/* Header */}
        <div className="assign-modal-header">
          <h2 className="assign-modal-title" title={title}>{title}</h2>
          <button
            className="assign-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            &#x2715;
          </button>
        </div>

        {/* Search */}
        <div className="assign-modal-search">
          <input
            ref={searchRef}
            className="form-input"
            type="search"
            placeholder="Search…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search items"
          />
        </div>

        {/* Body */}
        <div className="assign-modal-body" role="list">
          {/* Assigned section */}
          <div className="assign-modal-divider" aria-hidden="true">
            <span className="assign-modal-divider-label">Assigned ({assigned.length})</span>
            <span className="assign-modal-divider-line" />
          </div>

          {filteredAssigned.length === 0 ? (
            <p className="assign-modal-empty">
              {lowerQuery ? 'No matches.' : 'None assigned yet.'}
            </p>
          ) : (
            filteredAssigned.map(item => (
              <div
                key={item._id}
                className="assign-modal-item"
                role="listitem"
              >
                <div className="assign-modal-item-info">
                  <span className="assign-modal-item-label">{item.label}</span>
                  {item.sublabel && (
                    <span className="assign-modal-item-sublabel">{item.sublabel}</span>
                  )}
                </div>
                <button
                  className="assign-modal-btn assign-modal-btn--remove"
                  disabled={busyItem !== null || busy}
                  onClick={() => handleRemove(item._id)}
                  aria-label={`Remove ${item.label}`}
                  title="Remove"
                >
                  {busyItem === item._id ? (
                    <span className="assign-modal-btn-spinner" aria-hidden="true" />
                  ) : (
                    <span aria-hidden="true">&#x2715;</span>
                  )}
                </button>
              </div>
            ))
          )}

          {/* Available section */}
          <div className="assign-modal-divider" aria-hidden="true">
            <span className="assign-modal-divider-label">Available ({available.length})</span>
            <span className="assign-modal-divider-line" />
          </div>

          {filteredAvailable.length === 0 ? (
            <p className="assign-modal-empty">
              {lowerQuery ? 'No matches.' : 'All items are already assigned.'}
            </p>
          ) : (
            filteredAvailable.map(item => (
              <div
                key={item._id}
                className="assign-modal-item"
                role="listitem"
              >
                <div className="assign-modal-item-info">
                  <span className="assign-modal-item-label">{item.label}</span>
                  {item.sublabel && (
                    <span className="assign-modal-item-sublabel">{item.sublabel}</span>
                  )}
                </div>
                <button
                  className="assign-modal-btn assign-modal-btn--add"
                  disabled={busyItem !== null || busy}
                  onClick={() => handleAssign(item._id)}
                  aria-label={`Add ${item.label}`}
                  title="Add"
                >
                  {busyItem === item._id ? (
                    <span className="assign-modal-btn-spinner" aria-hidden="true" />
                  ) : (
                    <span aria-hidden="true">&#x2B;</span>
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
