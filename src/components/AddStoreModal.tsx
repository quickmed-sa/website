import { useState, useEffect, useRef } from 'react'
import { storesService, type CreateStorePayload, StoreType } from '../services/stores.service'
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
  address: string
  city: string
  state: string
  type: StoreType
  radius: string
  lat: string
  lon: string
}

const INITIAL: FormState = {
  name: '', address: '', city: '', state: '', type: StoreType.COCO, radius: '', lat: '', lon: '',
}

interface Props {
  onCreated: () => void
  onClose: () => void
}

export function AddStoreModal({ onCreated, onClose }: Props) {
  const [form, setForm]             = useState<FormState>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError]     = useState<string | null>(null)
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

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.')
      return
    }
    setGpsLoading(true)
    setGpsError(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(f => ({
          ...f,
          lat: pos.coords.latitude.toFixed(6),
          lon: pos.coords.longitude.toFixed(6),
        }))
        setGpsLoading(false)
      },
      () => {
        setGpsError('Could not get location. Please enable location access or enter manually.')
        setGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const parsedRadius = parseInt(form.radius, 10)
    const parsedLat    = parseFloat(form.lat)
    const parsedLon    = parseFloat(form.lon)

    if (!(parsedRadius > 0)) {
      setError('Allowed radius is required and must be a positive number.')
      return
    }
    if (isNaN(parsedLat) || isNaN(parsedLon) ||
        parsedLat < -90 || parsedLat > 90 ||
        parsedLon < -180 || parsedLon > 180) {
      setError('Valid latitude and longitude are required.')
      return
    }

    const payload: CreateStorePayload = {
      name:     form.name.trim(),
      city:     form.city.trim(),
      state:    form.state,
      type:     form.type,
      radius:   parsedRadius,
      location: { latitude: parsedLat, longitude: parsedLon },
      ...(form.address.trim() ? { address: form.address.trim() } : {}),
    }

    setSubmitting(true)
    try {
      await storesService.create(payload)
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create store.')
      setSubmitting(false)
    }
  }

  const parsedRadiusCheck = parseInt(form.radius, 10)
  const parsedLatCheck    = parseFloat(form.lat)
  const parsedLonCheck    = parseFloat(form.lon)
  const canSubmit =
    form.name.trim() &&
    form.city.trim() &&
    form.state &&
    parsedRadiusCheck > 0 &&
    !isNaN(parsedLatCheck) && parsedLatCheck >= -90 && parsedLatCheck <= 90 &&
    !isNaN(parsedLonCheck) && parsedLonCheck >= -180 && parsedLonCheck <= 180 &&
    !submitting

  return (
    <div
      className="as-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Add new store"
    >
      <div className="as-modal">

        {/* ── Header ── */}
        <div className="as-header">
          <div>
            <h2 className="as-title">Add New Store</h2>
            <p className="as-subtitle">Created as <strong>Pending</strong> — schedule site inspection next</p>
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
            <label className="form-label" htmlFor="as-name">
              Store Name <span className="as-req">*</span>
            </label>
            <input
              ref={nameRef}
              id="as-name"
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

          {/* Address */}
          <div className="form-group">
            <label className="form-label" htmlFor="as-address">
              Address <span className="as-opt">(optional)</span>
            </label>
            <input
              id="as-address"
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
              <label className="form-label" htmlFor="as-city">
                City <span className="as-req">*</span>
              </label>
              <input
                id="as-city"
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
              <label className="form-label" htmlFor="as-state">
                State <span className="as-req">*</span>
              </label>
              <select
                id="as-state"
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

          {/* Allowed radius */}
          <div className="form-group">
            <label className="form-label" htmlFor="as-radius">
              Allowed Radius <span className="as-req">*</span> <span className="as-opt">(metres)</span>
            </label>
            <input
              id="as-radius"
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

          {/* GPS location */}
          <div className="form-group">
            <label className="form-label">
              Site Center Coordinates <span className="as-req">*</span>
            </label>
            <p className="as-type-hint" style={{ marginTop: 0, marginBottom: '0.6rem' }}>
              Center point for site inspection radius validation.
            </p>

            <button
              type="button"
              className={`btn btn-ghost btn-sm as-gps-btn${gpsLoading ? ' as-gps-loading' : ''}`}
              onClick={handleUseMyLocation}
              disabled={gpsLoading}
            >
              {gpsLoading ? (
                <><span className="as-btn-spinner" aria-hidden="true" /> Detecting…</>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  Use My Location
                </>
              )}
            </button>

            {gpsError && (
              <p className="as-gps-error">{gpsError}</p>
            )}

            <div className="as-two-col" style={{ marginTop: '0.6rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="as-lat">Latitude</label>
                <input
                  id="as-lat"
                  className="form-input"
                  name="lat"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={form.lat}
                  onChange={handleChange}
                  placeholder="e.g. 28.6139"
                  autoComplete="off"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="as-lon">Longitude</label>
                <input
                  id="as-lon"
                  className="form-input"
                  name="lon"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={form.lon}
                  onChange={handleChange}
                  placeholder="e.g. 77.2090"
                  autoComplete="off"
                />
              </div>
            </div>

            {form.lat && form.lon && (
              <div className="as-gps-captured">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Location set: {parseFloat(form.lat).toFixed(5)}, {parseFloat(form.lon).toFixed(5)}
                <button
                  type="button"
                  className="as-gps-clear"
                  onClick={() => { setForm(f => ({ ...f, lat: '', lon: '' })); setGpsError(null) }}
                  aria-label="Clear location"
                >
                  Clear
                </button>
              </div>
            )}
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
                  Creating…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5"  y1="12" x2="19" y2="12"/>
                  </svg>
                  Create Store
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
