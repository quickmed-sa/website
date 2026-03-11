import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  storesService,
  type Store,
  StoreType,
  FirmType,
  Gender,
  Ownership,
  DrugLicenseType,
  DrugLicenseStatus,
} from '../services/stores.service'
import { authService } from '../services/auth.service'
import { VideoCapture } from '../components/VideoCapture'
import './StoreActivation.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'storeDetails'    as const, label: 'Store Details' },
  { key: 'firmDetails'     as const, label: 'Firm Details' },
  { key: 'personalDetails' as const, label: 'Personal Details' },
  { key: 'drugLicense'     as const, label: 'Drug License' },
]
type Tab = typeof TABS[number]['key']

const DL_TYPES = [
  { key: 'dl20_20B' as const, type: DrugLicenseType.DL_20_20B, label: 'Form 20 / 20B' },
  { key: 'dl21_21B' as const, type: DrugLicenseType.DL_21_21B, label: 'Form 21 / 21B' },
  { key: 'dl21C'    as const, type: DrugLicenseType.DL_21C,    label: 'Form 21C' },
  { key: 'dl20F'    as const, type: DrugLicenseType.DL_20F,    label: 'Form 20F' },
]

const FIRM_TYPE_OPTIONS = Object.values(FirmType)
const GENDER_OPTIONS    = Object.values(Gender).filter(g => g !== 'Other')
const OWNERSHIP_OPTIONS = Object.values(Ownership)

// ── Section completion check ──────────────────────────────────────────────────

type TabStatus = 'complete' | 'partial' | 'empty'

function getTabStatus(tab: Tab, store: Store): TabStatus {
  switch (tab) {
    case 'drugLicense': {
      const dl = store.drugLicenseDetails
      const validUptoOk = !!(dl?.dl20_20B?.validUpto && new Date(dl.dl20_20B.validUpto) > new Date())
      const mandatoryMet = !!(
        dl?.dl20_20B?.licenseNumber &&
        dl?.dl20_20B?.validUpto && validUptoOk &&
        dl?.dl20_20B?.file &&
        dl?.dl20_20B?.status === DrugLicenseStatus.RECEIVED
      )
      const anyFilled = !!(dl && (
        dl.drugLicenseName || dl.storeArea || dl.fullAddressAsPerDL ||
        dl.dl20_20B?.licenseNumber || dl.dl20_20B?.validUpto || dl.dl20_20B?.file || dl.dl20_20B?.status ||
        dl.dl21_21B?.licenseNumber || dl.dl21C?.licenseNumber || dl.dl20F?.licenseNumber
      ))
      return mandatoryMet ? 'complete' : anyFilled ? 'partial' : 'empty'
    }
    case 'firmDetails': {
      const f = store.firmDetails
      const mandatoryMet = !!(f?.firmName && f?.authorizedPerson && f?.firmType)
      const anyFilled = !!(f && (f.firmName || f.authorizedPerson || f.firmType || f.designation || f.address || f.panNo || f.gstNo))
      return mandatoryMet ? 'complete' : anyFilled ? 'partial' : 'empty'
    }
    case 'personalDetails': {
      const p = store.personalDetails
      const mandatoryMet = !!(p?.name && p?.gender && p?.qualification && p?.email && p?.dob && p?.aadharNo)
      const anyFilled = !!(p && (p.name || p.gender || p.qualification || p.email || p.dob || p.aadharNo || p.experienceYears))
      return mandatoryMet ? 'complete' : anyFilled ? 'partial' : 'empty'
    }
    case 'storeDetails': {
      const sd = store.storeDetails
      const images = sd?.images ?? []
      const isRented = sd?.ownership === 'Rented'
      const mandatoryMet = !!(
        sd?.shutterDimensions?.width && sd?.shutterDimensions?.height &&
        sd?.shopDimensions?.length && sd?.shopDimensions?.width && sd?.shopDimensions?.height &&
        sd?.actualCarpetArea && sd?.ownership &&
        (!isRented || sd?.rentPerMonth) &&
        images.length >= 5 && sd?.videos?.length
      )
      const anyFilled = !!(sd && (
        sd.shutterDimensions?.width || sd.shutterDimensions?.height ||
        sd.shopDimensions?.length || sd.shopDimensions?.width || sd.shopDimensions?.height ||
        sd.actualCarpetArea || sd.ownership || sd.rentPerMonth ||
        images.length > 0 || sd.videos?.length
      ))
      return mandatoryMet ? 'complete' : anyFilled ? 'partial' : 'empty'
    }
  }
}

// ── Form state types ──────────────────────────────────────────────────────────

interface DlEntry { licenseNumber: string; validUpto: string; status: string }

interface DlForm {
  drugLicenseName: string
  storeArea: string
  fullAddressAsPerDL: string
  dl20_20B: DlEntry
  dl21_21B: DlEntry
  dl21C: DlEntry
  dl20F: DlEntry
}

interface FirmForm {
  firmName: string
  authorizedPerson: string
  firmType: string
  designation: string
  address: string
  panNo: string
  gstNo: string
}

interface PersonalForm {
  name: string
  gender: string
  qualification: string
  experienceYears: string
  email: string
  dob: string
  aadharNo: string
}

interface StoreDetailsForm {
  shutterWidth: string
  shutterHeight: string
  ownership: string
  rentPerMonth: string
  actualCarpetArea: string
  shopLength: string
  shopWidth: string
  shopHeight: string
}

const emptyDlForm = (): DlForm => ({
  drugLicenseName: '',
  storeArea: '',
  fullAddressAsPerDL: '',
  dl20_20B: { licenseNumber: '', validUpto: '', status: '' },
  dl21_21B: { licenseNumber: '', validUpto: '', status: '' },
  dl21C:    { licenseNumber: '', validUpto: '', status: '' },
  dl20F:    { licenseNumber: '', validUpto: '', status: '' },
})

const emptyFirmForm = (): FirmForm => ({
  firmName: '', authorizedPerson: '', firmType: '',
  designation: '', address: '', panNo: '', gstNo: '',
})

const emptyPersonalForm = (): PersonalForm => ({
  name: '', gender: '', qualification: '',
  experienceYears: '', email: '', dob: '', aadharNo: '',
})

const emptyStoreDetailsForm = (): StoreDetailsForm => ({
  shutterWidth: '', shutterHeight: '', ownership: '',
  rentPerMonth: '', actualCarpetArea: '',
  shopLength: '', shopWidth: '', shopHeight: '',
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripEmpty<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== '' && v !== undefined && v !== null) (out as any)[k] = v
  }
  return out
}

function fmtDate(iso?: string): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function isImage(url: string) {
  return /\.(jpe?g|png|webp|gif|bmp)$/i.test(url)
}

function getActivationErrors(store: Store): string[] {
  const images = store.storeDetails?.images ?? []
  return [
    // Store Details
    !store.storeDetails?.shutterDimensions?.width  && 'Shutter width',
    !store.storeDetails?.shutterDimensions?.height && 'Shutter height',
    !store.storeDetails?.shopDimensions?.length    && 'Shop length',
    !store.storeDetails?.shopDimensions?.width     && 'Shop width',
    !store.storeDetails?.shopDimensions?.height    && 'Shop height',
    !store.storeDetails?.actualCarpetArea        && 'Actual carpet area',
    !store.storeDetails?.ownership               && 'Ownership',
    (store.storeDetails?.ownership === 'Rented' && !store.storeDetails?.rentPerMonth) && 'Rent per month',
    images.length < 5                            && 'At least 5 store photos',
    !store.storeDetails?.videos?.length           && 'Store video',
    // Firm Details
    !store.firmDetails?.firmName                 && 'Firm name',
    !store.firmDetails?.authorizedPerson         && 'Authorized person',
    !store.firmDetails?.firmType                 && 'Firm type',
    // Personal Details
    !store.personalDetails?.name                 && 'Full name',
    !store.personalDetails?.gender               && 'Gender',
    !store.personalDetails?.qualification        && 'Qualification',
    !store.personalDetails?.email                && 'Email',
    !store.personalDetails?.dob                  && 'Date of birth',
    !store.personalDetails?.aadharNo             && 'Aadhar number',
    // Drug License — Form 20/20B (all 4 fields + future date + received status)
    !store.drugLicenseDetails?.dl20_20B?.licenseNumber && 'Drug license 20/20B — license number',
    !store.drugLicenseDetails?.dl20_20B?.validUpto     && 'Drug license 20/20B — valid upto',
    (store.drugLicenseDetails?.dl20_20B?.validUpto && new Date(store.drugLicenseDetails.dl20_20B.validUpto) <= new Date()) && 'Drug license 20/20B — valid upto must be a future date',
    !store.drugLicenseDetails?.dl20_20B?.file          && 'Drug license 20/20B — document file',
    !store.drugLicenseDetails?.dl20_20B?.status        && 'Drug license 20/20B — status',
    (store.drugLicenseDetails?.dl20_20B?.status && store.drugLicenseDetails.dl20_20B.status !== DrugLicenseStatus.RECEIVED) && 'Drug license 20/20B — status must be Received',
  ].filter(Boolean) as string[]
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StoreActivation() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentUser = authService.getCurrentUser()
  const isAdminOrOps = currentUser?.role === 'Admin' || currentUser?.role === 'Operations'

  const [store, setStore] = useState<Store | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('storeDetails')
  const [savingTab, setSavingTab] = useState<Tab | null>(null)
  const [savedTab, setSavedTab] = useState<Tab | null>(null)
  const [uploading, setUploading] = useState(false)
  const [activating, setActivating] = useState(false)
  const [showActivationErrors, setShowActivationErrors] = useState(false)

  // Form states
  const [dlForm, setDlForm] = useState<DlForm>(emptyDlForm())
  const [firmForm, setFirmForm] = useState<FirmForm>(emptyFirmForm())
  const [personalForm, setPersonalForm] = useState<PersonalForm>(emptyPersonalForm())
  const [sdForm, setSdForm] = useState<StoreDetailsForm>(emptyStoreDetailsForm())

  const initialized = useRef(false)

  // ── Load store ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const data = await storesService.getOne(id!)
        setStore(data)
      } catch (e: any) {
        setError(e.message ?? 'Failed to load store')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // ── Populate forms from store (once) ────────────────────────────────────────

  useEffect(() => {
    if (!store || initialized.current) return
    initialized.current = true

    const dl = store.drugLicenseDetails
    if (dl) {
      setDlForm({
        drugLicenseName:   dl.drugLicenseName ?? '',
        storeArea:         dl.storeArea?.toString() ?? '',
        fullAddressAsPerDL: dl.fullAddressAsPerDL ?? '',
        dl20_20B: { licenseNumber: dl.dl20_20B?.licenseNumber ?? '', validUpto: fmtDate(dl.dl20_20B?.validUpto), status: dl.dl20_20B?.status ?? '' },
        dl21_21B: { licenseNumber: dl.dl21_21B?.licenseNumber ?? '', validUpto: fmtDate(dl.dl21_21B?.validUpto), status: dl.dl21_21B?.status ?? '' },
        dl21C:    { licenseNumber: dl.dl21C?.licenseNumber ?? '',    validUpto: fmtDate(dl.dl21C?.validUpto),    status: dl.dl21C?.status ?? '' },
        dl20F:    { licenseNumber: dl.dl20F?.licenseNumber ?? '',    validUpto: fmtDate(dl.dl20F?.validUpto),    status: dl.dl20F?.status ?? '' },
      })
    }

    const firm = store.firmDetails
    if (firm) {
      setFirmForm({
        firmName: firm.firmName ?? '',
        authorizedPerson: firm.authorizedPerson ?? '',
        firmType: firm.firmType ?? '',
        designation: firm.designation ?? '',
        address: firm.address ?? '',
        panNo: firm.panNo ?? '',
        gstNo: firm.gstNo ?? '',
      })
    }

    const personal = store.personalDetails
    if (personal) {
      setPersonalForm({
        name: personal.name ?? '',
        gender: personal.gender ?? '',
        qualification: personal.qualification ?? '',
        experienceYears: personal.experienceYears?.toString() ?? '',
        email: personal.email ?? '',
        dob: fmtDate(personal.dob),
        aadharNo: personal.aadharNo ?? '',
      })
    }

    const sd = store.storeDetails
    if (sd) {
      setSdForm({
        shutterWidth:    sd.shutterDimensions?.width?.toString() ?? '',
        shutterHeight:   sd.shutterDimensions?.height?.toString() ?? '',
        ownership:       sd.ownership ?? '',
        rentPerMonth:    sd.rentPerMonth?.toString() ?? '',
        actualCarpetArea: sd.actualCarpetArea?.toString() ?? '',
        shopLength:      sd.shopDimensions?.length?.toString() ?? '',
        shopWidth:       sd.shopDimensions?.width?.toString() ?? '',
        shopHeight:      sd.shopDimensions?.height?.toString() ?? '',
      })
    }
  }, [store])

  // ── Save helpers ─────────────────────────────────────────────────────────────

  function showSaved(tab: Tab) {
    setSavedTab(tab)
    setTimeout(() => setSavedTab(null), 2500)
  }

  async function saveDrugLicense() {
    setSavingTab('drugLicense')
    setError(null)
    try {
      const updated = await storesService.updateActivation(id!, {
        drugLicenseDetails: {
          drugLicenseName:    dlForm.drugLicenseName || undefined,
          storeArea:          dlForm.storeArea ? Number(dlForm.storeArea) : undefined,
          fullAddressAsPerDL: dlForm.fullAddressAsPerDL || undefined,
          dl20_20B: stripEmpty({ licenseNumber: dlForm.dl20_20B.licenseNumber, validUpto: dlForm.dl20_20B.validUpto, status: dlForm.dl20_20B.status as DrugLicenseStatus }),
          dl21_21B: stripEmpty({ licenseNumber: dlForm.dl21_21B.licenseNumber, validUpto: dlForm.dl21_21B.validUpto, status: dlForm.dl21_21B.status as DrugLicenseStatus }),
          dl21C:    stripEmpty({ licenseNumber: dlForm.dl21C.licenseNumber,    validUpto: dlForm.dl21C.validUpto,    status: dlForm.dl21C.status as DrugLicenseStatus }),
          dl20F:    stripEmpty({ licenseNumber: dlForm.dl20F.licenseNumber,    validUpto: dlForm.dl20F.validUpto,    status: dlForm.dl20F.status as DrugLicenseStatus }),
        },
      })
      setStore(updated)
      showSaved('drugLicense')
    } catch (e: any) {
      setError(e.message ?? 'Save failed')
    } finally {
      setSavingTab(null)
    }
  }

  async function saveFirmDetails() {
    setSavingTab('firmDetails')
    setError(null)
    try {
      const updated = await storesService.updateActivation(id!, { firmDetails: stripEmpty(firmForm) as any })
      setStore(updated)
      showSaved('firmDetails')
    } catch (e: any) {
      setError(e.message ?? 'Save failed')
    } finally {
      setSavingTab(null)
    }
  }

  async function savePersonalDetails() {
    setSavingTab('personalDetails')
    setError(null)
    try {
      const raw = stripEmpty(personalForm) as any
      if (raw.experienceYears) raw.experienceYears = Number(raw.experienceYears)
      const updated = await storesService.updateActivation(id!, { personalDetails: raw })
      setStore(updated)
      showSaved('personalDetails')
    } catch (e: any) {
      setError(e.message ?? 'Save failed')
    } finally {
      setSavingTab(null)
    }
  }

  async function saveStoreDetails() {
    setSavingTab('storeDetails')
    setError(null)
    try {
      const payload: any = {}
      if (sdForm.shutterWidth || sdForm.shutterHeight) {
        payload.shutterDimensions = {
          ...(sdForm.shutterWidth  ? { width:  Number(sdForm.shutterWidth)  } : {}),
          ...(sdForm.shutterHeight ? { height: Number(sdForm.shutterHeight) } : {}),
        }
      }
      if (sdForm.ownership)       payload.ownership       = sdForm.ownership
      if (sdForm.rentPerMonth)    payload.rentPerMonth    = Number(sdForm.rentPerMonth)
      if (sdForm.actualCarpetArea) payload.actualCarpetArea = Number(sdForm.actualCarpetArea)
      if (sdForm.shopLength || sdForm.shopWidth || sdForm.shopHeight) {
        payload.shopDimensions = {
          ...(sdForm.shopLength ? { length: Number(sdForm.shopLength) } : {}),
          ...(sdForm.shopWidth  ? { width:  Number(sdForm.shopWidth)  } : {}),
          ...(sdForm.shopHeight ? { height: Number(sdForm.shopHeight) } : {}),
        }
      }
      const updated = await storesService.updateActivation(id!, { storeDetails: payload })
      setStore(updated)
      showSaved('storeDetails')
    } catch (e: any) {
      setError(e.message ?? 'Save failed')
    } finally {
      setSavingTab(null)
    }
  }

  // ── File upload handlers ─────────────────────────────────────────────────────

  async function handleDlFile(dlType: DrugLicenseType, file: File) {
    setUploading(true)
    setError(null)
    try {
      const updated = await storesService.addDrugLicenseFile(id!, dlType, file)
      setStore(updated)
    } catch (e: any) {
      setError(e.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleStoreImages(files: FileList) {
    if (!files.length) return
    setUploading(true)
    setError(null)
    try {
      const updated = await storesService.addStoreImages(id!, Array.from(files))
      setStore(updated)
    } catch (e: any) {
      setError(e.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleStoreVideos(files: File[]) {
    if (!files.length) return
    setUploading(true)
    setError(null)
    try {
      const updated = await storesService.addStoreVideos(id!, files)
      setStore(updated)
    } catch (e: any) {
      setError(e.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // ── Activate ─────────────────────────────────────────────────────────────────

  async function handleActivate() {
    if (!store) return
    setShowActivationErrors(true)
    if (activationErrors.length > 0) return
    if (!confirm(`Activate "${store.name}"? This cannot be undone.`)) return
    setActivating(true)
    setError(null)
    try {
      await storesService.activate(id!)
      navigate('/store-activations')
    } catch (e: any) {
      setError(e.message ?? 'Activation failed')
      setActivating(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page">
        <div className="state-box"><div className="state-box-text">Loading store…</div></div>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="page">
        <div className="error">{error ?? 'Store not found'}</div>
      </div>
    )
  }

  const saveHandlers: Record<Tab, () => Promise<void>> = {
    drugLicense:     saveDrugLicense,
    firmDetails:     saveFirmDetails,
    personalDetails: savePersonalDetails,
    storeDetails:    saveStoreDetails,
  }

  const activationErrors = getActivationErrors(store)

  return (
    <div className="page">

      {/* ── Page header ── */}
      <div className="saf-header">
        <button className="saf-back" onClick={() => navigate('/store-activations')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Activations
        </button>

        <div className="saf-header-meta">
          <div className="saf-store-name">
            {store.name}
            <span className={`badge ${store.type === StoreType.COCO ? 'badge-approved' : 'badge-pending'}`}>
              {store.type}
            </span>
          </div>
          <div className="saf-store-sub">{store.city}, {store.state}{store.erpCode ? ` · ${store.erpCode}` : ''}</div>
        </div>

        {isAdminOrOps && (
          <button
            className="btn btn-primary saf-activate-btn"
            onClick={handleActivate}
            disabled={activating}
          >
            {activating ? 'Activating…' : 'Activate Store'}
          </button>
        )}
      </div>

      {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {isAdminOrOps && showActivationErrors && activationErrors.length > 0 && (
        <div className="saf-activation-errors">
          <strong>Required before activation:</strong>
          <ul>
            {activationErrors.map(msg => <li key={msg}>{msg}</li>)}
          </ul>
        </div>
      )}

      {/* ── Section tabs ── */}
      <div className="saf-tabs">
        {TABS.map(tab => {
          const status = getTabStatus(tab.key, store)
          return (
            <button
              key={tab.key}
              className={`saf-tab${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className={`saf-tab-dot saf-tab-dot--${status}`} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Tab panels ── */}
      <div className="saf-panel">

        {/* ── Drug License ── */}
        {activeTab === 'drugLicense' && (
          <div className="saf-section">
            <div className="saf-section-intro">
              <h2 className="saf-section-title">Drug License Details</h2>
              <p className="saf-section-desc">Enter drug license information and upload supporting documents.</p>
            </div>

            <div className="saf-field-grid">
              <div className="form-group">
                <label className="form-label">Drug License Name</label>
                <input
                  className="form-input"
                  value={dlForm.drugLicenseName}
                  onChange={e => setDlForm(f => ({ ...f, drugLicenseName: e.target.value }))}
                  placeholder="Name as per drug license"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Store Area (sq ft)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  value={dlForm.storeArea}
                  onChange={e => setDlForm(f => ({ ...f, storeArea: e.target.value }))}
                  placeholder="e.g. 250"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '0.85rem' }}>
              <label className="form-label">Full Address as per Drug License</label>
              <textarea
                className="form-input saf-textarea"
                value={dlForm.fullAddressAsPerDL}
                onChange={e => setDlForm(f => ({ ...f, fullAddressAsPerDL: e.target.value }))}
                placeholder="Complete address as printed on the drug license"
                rows={3}
              />
            </div>

            <div className="saf-dl-grid">
              {DL_TYPES.map(({ key, type, label }) => (
                <div key={key} className="saf-dl-card">
                  <div className="saf-dl-card-header">
                    <span className="saf-dl-card-title">
                      {label}{key === 'dl20_20B' && <span className="saf-required"> *</span>}
                    </span>
                    {store.drugLicenseDetails?.[key]?.file && (
                      <a
                        className="saf-file-link"
                        href={store.drugLicenseDetails[key]!.file}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View uploaded ↗
                      </a>
                    )}
                  </div>
                  <div className="saf-dl-card-fields">
                    <div className="form-group">
                      <label className="form-label">License Number{key === 'dl20_20B' && <span className="saf-required"> *</span>}</label>
                      <input
                        className="form-input"
                        value={dlForm[key].licenseNumber}
                        onChange={e => setDlForm(f => ({ ...f, [key]: { ...f[key], licenseNumber: e.target.value } }))}
                        placeholder="e.g. MH-MUM-20-123456"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Valid Upto{key === 'dl20_20B' && <span className="saf-required"> *</span>}</label>
                      <input
                        className="form-input"
                        type="date"
                        value={dlForm[key].validUpto}
                        onChange={e => setDlForm(f => ({ ...f, [key]: { ...f[key], validUpto: e.target.value } }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Status{key === 'dl20_20B' && <span className="saf-required"> *</span>}</label>
                      <select
                        className="form-input"
                        value={dlForm[key].status}
                        onChange={e => setDlForm(f => ({ ...f, [key]: { ...f[key], status: e.target.value } }))}
                      >
                        <option value="">Select status</option>
                        <option value={DrugLicenseStatus.APPLIED}>Applied</option>
                        <option value={DrugLicenseStatus.REJECTED}>Rejected</option>
                        <option value={DrugLicenseStatus.RECEIVED}>Received</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Photo / PDF{key === 'dl20_20B' && <span className="saf-required"> *</span>}</label>
                      <label className={`saf-file-btn${uploading ? ' disabled' : ''}`}>
                        {uploading ? 'Uploading…' : store.drugLicenseDetails?.[key]?.file ? 'Replace file' : 'Upload file'}
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          style={{ display: 'none' }}
                          disabled={uploading}
                          onChange={e => { if (e.target.files?.[0]) handleDlFile(type, e.target.files[0]) }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <SaveBar tab="drugLicense" savingTab={savingTab} savedTab={savedTab} onSave={saveHandlers.drugLicense} />
          </div>
        )}

        {/* ── Firm Details ── */}
        {activeTab === 'firmDetails' && (
          <div className="saf-section">
            <div className="saf-section-intro">
              <h2 className="saf-section-title">Firm Details</h2>
              <p className="saf-section-desc">Legal and business entity information of the store owner.</p>
            </div>

            <div className="saf-field-grid">
              <div className="form-group">
                <label className="form-label">Firm Name<span className="saf-required"> *</span></label>
                <input
                  className="form-input"
                  value={firmForm.firmName}
                  onChange={e => setFirmForm(f => ({ ...f, firmName: e.target.value }))}
                  placeholder="Registered firm name"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Authorized Person<span className="saf-required"> *</span></label>
                <input
                  className="form-input"
                  value={firmForm.authorizedPerson}
                  onChange={e => setFirmForm(f => ({ ...f, authorizedPerson: e.target.value }))}
                  placeholder="Name of authorized signatory"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Firm Type<span className="saf-required"> *</span></label>
                <select
                  className="form-input"
                  value={firmForm.firmType}
                  onChange={e => setFirmForm(f => ({ ...f, firmType: e.target.value }))}
                >
                  <option value="">Select firm type</option>
                  {FIRM_TYPE_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Designation</label>
                <input
                  className="form-input"
                  value={firmForm.designation}
                  onChange={e => setFirmForm(f => ({ ...f, designation: e.target.value }))}
                  placeholder="e.g. Proprietor, Partner, Director"
                />
              </div>
              <div className="form-group">
                <label className="form-label">PAN Number</label>
                <input
                  className="form-input"
                  value={firmForm.panNo}
                  onChange={e => setFirmForm(f => ({ ...f, panNo: e.target.value.toUpperCase() }))}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                />
              </div>
              <div className="form-group">
                <label className="form-label">GST Number</label>
                <input
                  className="form-input"
                  value={firmForm.gstNo}
                  onChange={e => setFirmForm(f => ({ ...f, gstNo: e.target.value.toUpperCase() }))}
                  placeholder="22ABCDE1234F1Z5"
                  maxLength={15}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '0.85rem' }}>
              <label className="form-label">Firm Address</label>
              <textarea
                className="form-input saf-textarea"
                value={firmForm.address}
                onChange={e => setFirmForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Registered business address"
                rows={3}
              />
            </div>

            <SaveBar tab="firmDetails" savingTab={savingTab} savedTab={savedTab} onSave={saveHandlers.firmDetails} />
          </div>
        )}

        {/* ── Personal Details ── */}
        {activeTab === 'personalDetails' && (
          <div className="saf-section">
            <div className="saf-section-intro">
              <h2 className="saf-section-title">Personal Details</h2>
              <p className="saf-section-desc">Details of the pharmacist / responsible person for the store.</p>
            </div>

            <div className="saf-field-grid">
              <div className="form-group">
                <label className="form-label">Full Name<span className="saf-required"> *</span></label>
                <input
                  className="form-input"
                  value={personalForm.name}
                  onChange={e => setPersonalForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="As per ID proof"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Gender<span className="saf-required"> *</span></label>
                <select
                  className="form-input"
                  value={personalForm.gender}
                  onChange={e => setPersonalForm(f => ({ ...f, gender: e.target.value }))}
                >
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Qualification<span className="saf-required"> *</span></label>
                <input
                  className="form-input"
                  value={personalForm.qualification}
                  onChange={e => setPersonalForm(f => ({ ...f, qualification: e.target.value }))}
                  placeholder="e.g. B.Pharm, D.Pharm, M.Pharm"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Experience (years)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  value={personalForm.experienceYears}
                  onChange={e => setPersonalForm(f => ({ ...f, experienceYears: e.target.value }))}
                  placeholder="Years of pharmacy experience"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email<span className="saf-required"> *</span></label>
                <input
                  className="form-input"
                  type="email"
                  value={personalForm.email}
                  onChange={e => setPersonalForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date of Birth<span className="saf-required"> *</span></label>
                <input
                  className="form-input"
                  type="date"
                  value={personalForm.dob}
                  onChange={e => setPersonalForm(f => ({ ...f, dob: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Aadhar Number<span className="saf-required"> *</span></label>
                <input
                  className="form-input"
                  value={personalForm.aadharNo}
                  onChange={e => setPersonalForm(f => ({ ...f, aadharNo: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                  placeholder="12-digit Aadhar number"
                  maxLength={12}
                  inputMode="numeric"
                />
              </div>
            </div>

            <SaveBar tab="personalDetails" savingTab={savingTab} savedTab={savedTab} onSave={saveHandlers.personalDetails} />
          </div>
        )}

        {/* ── Store Details ── */}
        {activeTab === 'storeDetails' && (
          <div className="saf-section">
            <div className="saf-section-intro">
              <h2 className="saf-section-title">Store Details</h2>
              <p className="saf-section-desc">Physical dimensions, ownership, and media for the store premises.</p>
            </div>

            {/* Dimensions */}
            <div className="saf-subsection-label">Shutter Dimensions (ft)<span className="saf-required"> *</span></div>
            <div className="saf-dim-row">
              <div className="form-group">
                <label className="form-label">Width<span className="saf-required"> *</span></label>
                <input className="form-input" type="number" min="0" value={sdForm.shutterWidth}
                  onChange={e => setSdForm(f => ({ ...f, shutterWidth: e.target.value }))} placeholder="ft" />
              </div>
              <div className="form-group">
                <label className="form-label">Height<span className="saf-required"> *</span></label>
                <input className="form-input" type="number" min="0" value={sdForm.shutterHeight}
                  onChange={e => setSdForm(f => ({ ...f, shutterHeight: e.target.value }))} placeholder="ft" />
              </div>
            </div>

            <div className="saf-subsection-label" style={{ marginTop: '1.25rem' }}>Shop Dimensions (ft)<span className="saf-required"> *</span></div>
            <div className="saf-dim-row saf-dim-row--three">
              <div className="form-group">
                <label className="form-label">Length<span className="saf-required"> *</span></label>
                <input className="form-input" type="number" min="0" value={sdForm.shopLength}
                  onChange={e => setSdForm(f => ({ ...f, shopLength: e.target.value }))} placeholder="ft" />
              </div>
              <div className="form-group">
                <label className="form-label">Width<span className="saf-required"> *</span></label>
                <input className="form-input" type="number" min="0" value={sdForm.shopWidth}
                  onChange={e => setSdForm(f => ({ ...f, shopWidth: e.target.value }))} placeholder="ft" />
              </div>
              <div className="form-group">
                <label className="form-label">Height<span className="saf-required"> *</span></label>
                <input className="form-input" type="number" min="0" value={sdForm.shopHeight}
                  onChange={e => setSdForm(f => ({ ...f, shopHeight: e.target.value }))} placeholder="ft" />
              </div>
            </div>

            <div className="saf-field-grid" style={{ marginTop: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Actual Carpet Area (sq ft)<span className="saf-required"> *</span></label>
                <input className="form-input" type="number" min="0" value={sdForm.actualCarpetArea}
                  onChange={e => setSdForm(f => ({ ...f, actualCarpetArea: e.target.value }))} placeholder="e.g. 220" />
              </div>
              <div className="form-group">
                <label className="form-label">Ownership<span className="saf-required"> *</span></label>
                <select className="form-input" value={sdForm.ownership}
                  onChange={e => setSdForm(f => ({ ...f, ownership: e.target.value }))}>
                  <option value="">Select ownership</option>
                  {OWNERSHIP_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              {sdForm.ownership === Ownership.RENTED && (
                <div className="form-group">
                  <label className="form-label">Rent per Month (₹)<span className="saf-required"> *</span></label>
                  <input className="form-input" type="number" min="0" value={sdForm.rentPerMonth}
                    onChange={e => setSdForm(f => ({ ...f, rentPerMonth: e.target.value }))} placeholder="e.g. 35000" />
                </div>
              )}
            </div>

            <SaveBar tab="storeDetails" savingTab={savingTab} savedTab={savedTab} onSave={saveHandlers.storeDetails} />

            {/* ── Store Photos ── */}
            <div className="saf-media-section">
              <div className="saf-media-header">
                <div className="saf-subsection-label" style={{ margin: 0 }}>
                  Store Photos ({store.storeDetails?.images?.length ?? 0})<span className="saf-required"> *</span> <span style={{ fontWeight: 400, fontSize: '0.8rem', textTransform: 'none', letterSpacing: 0 }}>min 5</span>
                </div>
                <label className={`saf-file-btn${uploading ? ' disabled' : ''}`}>
                  {uploading ? 'Uploading…' : '+ Add Photos'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    disabled={uploading}
                    onChange={e => { if (e.target.files) handleStoreImages(e.target.files) }}
                  />
                </label>
              </div>
              {store.storeDetails?.images && store.storeDetails.images.length > 0 ? (
                <div className="saf-image-grid">
                  {store.storeDetails.images.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer" className="saf-image-thumb">
                      {isImage(url)
                        ? <img src={url} alt={`Store photo ${i + 1}`} />
                        : <div className="saf-image-placeholder">File {i + 1}</div>
                      }
                    </a>
                  ))}
                </div>
              ) : (
                <div className="saf-media-empty">No photos uploaded yet</div>
              )}
            </div>

            {/* ── Store Videos ── */}
            <div className="saf-media-section">
              <div className="saf-media-header">
                <div className="saf-subsection-label" style={{ margin: 0 }}>Store Videos ({store.storeDetails?.videos?.length ?? 0})<span className="saf-required"> *</span></div>
              </div>
              {store.storeDetails?.videos && store.storeDetails.videos.length > 0 && (
                <div className="saf-image-grid">
                  {store.storeDetails.videos.map((url, i) => (
                    <div key={i} className="saf-image-thumb">
                      <video src={url} className="saf-video-thumb" preload="metadata" playsInline muted />
                    </div>
                  ))}
                </div>
              )}
              <VideoCapture
                onChange={handleStoreVideos}
                maxVideos={10}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── SaveBar sub-component ─────────────────────────────────────────────────────

function SaveBar({
  tab, savingTab, savedTab, onSave,
}: {
  tab: Tab
  savingTab: Tab | null
  savedTab: Tab | null
  onSave: () => Promise<void>
}) {
  return (
    <div className="saf-save-bar">
      {savedTab === tab && (
        <span className="saf-saved-msg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Saved
        </span>
      )}
      <button
        className="btn btn-primary"
        onClick={onSave}
        disabled={savingTab === tab}
      >
        {savingTab === tab ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
