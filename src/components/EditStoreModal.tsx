import { useState, useEffect, useRef } from 'react'
import { storesService, type Store, type UpdateStorePayload, StoreType } from '../services/stores.service'
import { ApiError } from '../services/api'
import './AddStoreModal.css'

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
]

interface FormState {
  name: string
  erpCode: string
  address: string
  city: string
  state: string
  type: StoreType
  latitude: string
  longitude: string
  radius: string
}

interface Props {
  store: Store
  onUpdated: () => void
  onClose: () => void
}

export function EditStoreModal({ store, onUpdated, onClose }: Props) {
  const [form, setForm]             = useState<FormState>({
    name:      store.name,
    erpCode:   store.erpCode ?? '',
    address:   store.address ?? '',
    city:      store.city,
    state:     store.state,
    type:      store.type,
    latitude:  store.location?.latitude  != null ? String(store.location.latitude)  : '',
    longitude: store.location?.longitude != null ? String(store.location.longitude) : '',
    radius:    store.radius != null ? String(store.radius) : '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const overlayRef                  = useRef<HTMLDivElement>(null)
  const nameRef                     = useRef<HTMLInputElement>(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const lat = parseFloat(form.latitude)
    const lng = parseFloat(form.longitude)

    const payload: UpdateStorePayload = {
      name:  form.name.trim(),
      city:  form.city.trim(),
      state: form.state,
      type:  form.type,
      ...(form.address.trim() ? { address: form.address.trim() } : {}),
    }
    if (form.erpCode.trim()) payload.erpCode = form.erpCode.trim()
    if (!isNaN(lat) && !isNaN(lng)) payload.location = { latitude: lat, longitude: lng }
    const parsedRadius = parseInt(form.radius, 10)
    if (parsedRadius > 0) payload.radius = parsedRadius

    setSubmitting(true)
    try {
      await storesService.update(store._id, payload)
      onUpdated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update store.')
      setSubmitting(false)
    }
  }

  const canSubmit =
    form.name.trim() &&
    form.city.trim() &&
    form.state &&
    !submitting

  return (
    <div
      className="as-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Edit store"
    >
      <div className="as-modal">

        {/* ── Header ── */}
        <div className="as-header">
          <div>
            <h2 className="as-title">Edit Store</h2>
            <p className="as-subtitle">Update details for <strong>{store.name}</strong></p>
          </div>
          <button
            className="as-close"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6"  x2="6"  y2="18"/>
              <line x1="6"  y1="6"  x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Form ── */}
        <form className="as-body" onSubmit={handleSubmit} noValidate>

          {error && (
            <div className="error" role="alert">{error}</div>
          )}

          {/* Store name */}
          <div className="form-group">
            <label className="form-label" htmlFor="es-name">
              Store Name <span className="as-req">*</span>
            </label>
            <input
              ref={nameRef}
              id="es-name"
              className="form-input"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Dr Morepen Connaught Place"
              required
              autoComplete="off"
            />
          </div>

          {/* ERP Code */}
          <div className="form-group">
            <label className="form-label" htmlFor="es-erpCode">
              ERP Code <span className="as-opt">(optional)</span>
            </label>
            <input
              id="es-erpCode"
              className="form-input"
              name="erpCode"
              type="text"
              value={form.erpCode}
              onChange={handleChange}
              placeholder="e.g. STORE-001"
              autoComplete="off"
            />
          </div>

          {/* Address */}
          <div className="form-group">
            <label className="form-label" htmlFor="es-address">
              Address <span className="as-opt">(optional)</span>
            </label>
            <input
              id="es-address"
              className="form-input"
              name="address"
              type="text"
              value={form.address}
              onChange={handleChange}
              placeholder="Street / locality"
              autoComplete="off"
            />
          </div>

          {/* City + State */}
          <div className="as-two-col">
            <div className="form-group">
              <label className="form-label" htmlFor="es-city">
                City <span className="as-req">*</span>
              </label>
              <input
                id="es-city"
                className="form-input"
                name="city"
                type="text"
                value={form.city}
                onChange={handleChange}
                placeholder="City"
                required
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="es-state">
                State <span className="as-req">*</span>
              </label>
              <select
                id="es-state"
                className="form-input as-select"
                name="state"
                value={form.state}
                onChange={handleChange}
                required
              >
                <option value="" disabled>Select state</option>
                {INDIAN_STATES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Store type */}
          <div className="form-group">
            <label className="form-label">
              Store Type <span className="as-req">*</span>
            </label>
            <div className="as-type-toggle" role="group" aria-label="Store type">
              {([StoreType.COCO, StoreType.FOFO] as StoreType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  className={`as-type-btn${form.type === t ? ' selected' : ''}`}
                  onClick={() => setForm(f => ({ ...f, type: t }))}
                  aria-pressed={form.type === t}
                >
                  <span className="as-type-dot" aria-hidden="true" />
                  {t}
                </button>
              ))}
            </div>
            <p className="as-type-hint">
              {form.type === StoreType.COCO
                ? 'Company Owned, Company Operated'
                : 'Franchise Owned, Franchise Operated'}
            </p>
          </div>

          {/* Coordinates */}
          <div className="as-two-col">
            <div className="form-group">
              <label className="form-label" htmlFor="es-latitude">
                Latitude <span className="as-opt">(optional)</span>
              </label>
              <input
                id="es-latitude"
                className="form-input"
                name="latitude"
                type="number"
                step="any"
                value={form.latitude}
                onChange={handleChange}
                placeholder="e.g. 28.6139"
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="es-longitude">
                Longitude <span className="as-opt">(optional)</span>
              </label>
              <input
                id="es-longitude"
                className="form-input"
                name="longitude"
                type="number"
                step="any"
                value={form.longitude}
                onChange={handleChange}
                placeholder="e.g. 77.2090"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Allowed radius */}
          <div className="form-group">
            <label className="form-label" htmlFor="es-radius">
              Allowed Radius <span className="as-opt">(metres, optional)</span>
            </label>
            <input
              id="es-radius"
              className="form-input"
              name="radius"
              type="number"
              min="1"
              step="1"
              value={form.radius}
              onChange={handleChange}
              placeholder="e.g. 500"
              autoComplete="off"
            />
            <p className="as-type-hint">Site inspections must be submitted within this distance of the store.</p>
          </div>

          {/* ── Footer ── */}
          <div className="as-footer">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!canSubmit}
            >
              {submitting ? (
                <>
                  <span className="as-btn-spinner" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
