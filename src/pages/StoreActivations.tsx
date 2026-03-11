import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { storesService, type Store, StoreStatus, StoreType } from '../services/stores.service'
import { authService } from '../services/auth.service'
import './StoreActivations.css'

function canActivate(store: Store): boolean {
  const images = store.storeDetails?.images ?? []
  return !!(
    store.storeDetails?.shopDimensions?.length &&
    store.storeDetails?.shopDimensions?.width &&
    store.storeDetails?.shopDimensions?.height &&
    store.storeDetails?.actualCarpetArea &&
    store.storeDetails?.ownership &&
    images.length >= 5 &&
    store.storeDetails?.videos?.length &&
    store.firmDetails?.firmName &&
    store.firmDetails?.authorizedPerson &&
    store.firmDetails?.firmType &&
    store.personalDetails?.name &&
    store.personalDetails?.gender &&
    store.personalDetails?.qualification &&
    store.personalDetails?.email &&
    store.personalDetails?.dob &&
    store.personalDetails?.aadharNo &&
    store.drugLicenseDetails?.dl20_20B?.licenseNumber &&
    store.drugLicenseDetails?.dl20_20B?.validUpto &&
    store.drugLicenseDetails?.dl20_20B?.file &&
    store.drugLicenseDetails?.dl20_20B?.status
  )
}

function getSectionProgress(store: Store): number {
  let count = 0
  const dl = store.drugLicenseDetails
  if (dl && (
    dl.drugLicenseName ||
    dl.storeArea ||
    dl.fullAddressAsPerDL ||
    dl.dl20_20B?.licenseNumber ||
    dl.dl21_21B?.licenseNumber ||
    dl.dl21C?.licenseNumber ||
    dl.dl20F?.licenseNumber
  )) count++
  if (store.firmDetails?.firmName) count++
  if (store.personalDetails?.name) count++
  const sd = store.storeDetails
  if (sd && (sd.actualCarpetArea || sd.shutterDimensions?.width || (sd.images && sd.images.length > 0))) count++
  return count
}

export function StoreActivations() {
  const navigate = useNavigate()
  const currentUser = authService.getCurrentUser()
  const isAdminOrOps = currentUser?.role === 'Admin' || currentUser?.role === 'Operations'

  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activating, setActivating] = useState<string | null>(null)

  async function load() {
    try {
      const all = await storesService.getAll()
      setStores(all.filter(s => s.status === StoreStatus.APPROVED))
    } catch (e: any) {
      setError(e.message ?? 'Failed to load stores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleActivate(store: Store) {
    if (!confirm(`Activate "${store.name}"? This cannot be undone.`)) return
    setActivating(store._id)
    setError(null)
    try {
      await storesService.activate(store._id)
      setStores(prev => prev.filter(s => s._id !== store._id))
    } catch (e: any) {
      setError(e.message ?? 'Failed to activate store')
    } finally {
      setActivating(null)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="state-box"><div className="state-box-text">Loading stores…</div></div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Store Activations</h1>
          <p className="page-subtitle">Approved stores awaiting activation details</p>
        </div>
      </div>

      {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {stores.length === 0 ? (
        <div className="state-box">
          <div className="state-box-icon">✓</div>
          <div className="state-box-text">No stores pending activation</div>
        </div>
      ) : (
        <>
          {/* ── Desktop table ── */}
          <div className="table-wrap desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Sections filled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stores.map(store => {
                  const progress = getSectionProgress(store)
                  const ready = canActivate(store)
                  return (
                    <tr key={store._id}>
                      <td>
                        <div className="sal-store-name">{store.name}</div>
                        {store.erpCode && <div className="sal-erp-code">{store.erpCode}</div>}
                      </td>
                      <td>
                        <span className={`badge ${store.type === StoreType.COCO ? 'badge-approved' : 'badge-pending'}`}>
                          {store.type}
                        </span>
                      </td>
                      <td className="sal-location">{store.city}, {store.state}</td>
                      <td>
                        <div className="sal-progress-wrap">
                          <div className="sal-progress-bar">
                            <div
                              className="sal-progress-fill"
                              style={{ width: `${(progress / 4) * 100}%` }}
                            />
                          </div>
                          <span className="sal-progress-label">{progress}/4</span>
                        </div>
                      </td>
                      <td>
                        <div className="td-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => navigate(`/store-activations/${store._id}`)}
                          >
                            {progress === 0 ? 'Fill Details' : 'Edit Details'}
                          </button>
                          {isAdminOrOps && ready && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleActivate(store)}
                              disabled={activating === store._id}
                            >
                              {activating === store._id ? 'Activating…' : 'Activate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards ── */}
          <div className="card-list mobile-only">
            {stores.map(store => {
              const progress = getSectionProgress(store)
              const ready = canActivate(store)
              return (
                <div key={store._id} className="data-card">
                  <div className="data-card-row">
                    <span className="data-card-name">{store.name}</span>
                    <span className={`badge ${store.type === StoreType.COCO ? 'badge-approved' : 'badge-pending'}`}>
                      {store.type}
                    </span>
                  </div>
                  <div className="data-card-meta">{store.city}, {store.state}</div>
                  {store.erpCode && <div className="sal-erp-code">{store.erpCode}</div>}
                  <div className="sal-progress-wrap">
                    <div className="sal-progress-bar">
                      <div
                        className="sal-progress-fill"
                        style={{ width: `${(progress / 4) * 100}%` }}
                      />
                    </div>
                    <span className="sal-progress-label">{progress}/4 sections filled</span>
                  </div>
                  <div className="data-card-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => navigate(`/store-activations/${store._id}`)}
                    >
                      {progress === 0 ? 'Fill Details' : 'Edit Details'}
                    </button>
                    {isAdminOrOps && ready && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleActivate(store)}
                        disabled={activating === store._id}
                      >
                        {activating === store._id ? 'Activating…' : 'Activate'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
