import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  storesService,
  type Store,
  type UpdateStorePayload,
  StoreType,
  FirmType,
  Gender,
  Ownership,
  DrugLicenseType,
  DrugLicenseStatus,
} from '../services/stores.service'
import { VideoCapture } from '../components/VideoCapture'
import './StoreActivation.css'
import '../components/AddStoreModal.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
]

const TABS = [
  { key: 'basicInfo'       as const, label: 'Basic Info' },
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

function getActivationTabStatus(tab: Exclude<Tab, 'basicInfo'>, store: Store): TabStatus {
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

function getBasicInfoStatus(store: Store): TabStatus {
  // Basic info is always available on an existing store
  return store.name && store.city && store.state ? 'complete' : 'partial'
}

// ── Form state types ──────────────────────────────────────────────────────────

interface BasicForm {
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

const emptyBasicForm = (store?: Store): BasicForm => ({
  name:      store?.name ?? '',
  erpCode:   store?.erpCode ?? '',
  address:   store?.address ?? '',
  city:      store?.city ?? '',
  state:     store?.state ?? '',
  type:      store?.type ?? StoreType.COCO,
  latitude:  store?.location?.latitude  != null ? String(store.location.latitude)  : '',
  longitude: store?.location?.longitude != null ? String(store.location.longitude) : '',
  radius:    store?.radius != null ? String(store.radius) : '',
})

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

// ── Component ─────────────────────────────────────────────────────────────────

export function EditStore() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [store, setStore] = useState<Store | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('basicInfo')
  const [savingTab, setSavingTab] = useState<Tab | null>(null)
  const [savedTab, setSavedTab] = useState<Tab | null>(null)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [capturingCoords, setCapturingCoords] = useState(false)
  const [playingVideo, setPlayingVideo] = useState<string | null>(null)

  // Form states
  const [basicForm, setBasicForm]   = useState<BasicForm>(emptyBasicForm())
  const [dlForm, setDlForm]         = useState<DlForm>(emptyDlForm())
  const [firmForm, setFirmForm]     = useState<FirmForm>(emptyFirmForm())
  const [personalForm, setPersonalForm] = useState<PersonalForm>(emptyPersonalForm())
  const [sdForm, setSdForm]         = useState<StoreDetailsForm>(emptyStoreDetailsForm())

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

    setBasicForm(emptyBasicForm(store))

    const dl = store.drugLicenseDetails
    if (dl) {
      setDlForm({
        drugLicenseName:    dl.drugLicenseName ?? '',
        storeArea:          dl.storeArea?.toString() ?? '',
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
        firmName:         firm.firmName ?? '',
        authorizedPerson: firm.authorizedPerson ?? '',
        firmType:         firm.firmType ?? '',
        designation:      firm.designation ?? '',
        address:          firm.address ?? '',
        panNo:            firm.panNo ?? '',
        gstNo:            firm.gstNo ?? '',
      })
    }

    const personal = store.personalDetails
    if (personal) {
      setPersonalForm({
        name:            personal.name ?? '',
        gender:          personal.gender ?? '',
        qualification:   personal.qualification ?? '',
        experienceYears: personal.experienceYears?.toString() ?? '',
        email:           personal.email ?? '',
        dob:             fmtDate(personal.dob),
        aadharNo:        personal.aadharNo ?? '',
      })
    }

    const sd = store.storeDetails
    if (sd) {
      setSdForm({
        shutterWidth:     sd.shutterDimensions?.width?.toString() ?? '',
        shutterHeight:    sd.shutterDimensions?.height?.toString() ?? '',
        ownership:        sd.ownership ?? '',
        rentPerMonth:     sd.rentPerMonth?.toString() ?? '',
        actualCarpetArea: sd.actualCarpetArea?.toString() ?? '',
        shopLength:       sd.shopDimensions?.length?.toString() ?? '',
        shopWidth:        sd.shopDimensions?.width?.toString() ?? '',
        shopHeight:       sd.shopDimensions?.height?.toString() ?? '',
      })
    }
  }, [store])

  // ── Coordinate capture ───────────────────────────────────────────────────────

  function captureCoords() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.')
      return
    }
    setCapturingCoords(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setBasicForm(f => ({
          ...f,
          latitude:  pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }))
        setCapturingCoords(false)
      },
      () => {
        setError('Could not get location. Please enter coordinates manually.')
        setCapturingCoords(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // ── Save helpers ─────────────────────────────────────────────────────────────

  function showSaved(tab: Tab) {
    setSavedTab(tab)
    setTimeout(() => setSavedTab(null), 2500)
  }

  async function saveBasicInfo() {
    setSavingTab('basicInfo')
    setError(null)
    try {
      const payload: UpdateStorePayload = {
        name:  basicForm.name.trim(),
        city:  basicForm.city.trim(),
        state: basicForm.state,
        type:  basicForm.type,
      }
      if (basicForm.address.trim())  payload.address  = basicForm.address.trim()
      if (basicForm.erpCode.trim())  payload.erpCode  = basicForm.erpCode.trim()
      const lat = parseFloat(basicForm.latitude)
      const lng = parseFloat(basicForm.longitude)
      if (!isNaN(lat) && !isNaN(lng)) payload.location = { latitude: lat, longitude: lng }
      const r = parseInt(basicForm.radius, 10)
      if (r > 0) payload.radius = r

      const updated = await storesService.update(id!, payload)
      setStore(updated)
      showSaved('basicInfo')
    } catch (e: any) {
      setError(e.message ?? 'Save failed')
    } finally {
      setSavingTab(null)
    }
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
      if (sdForm.ownership)        payload.ownership        = sdForm.ownership
      if (sdForm.rentPerMonth)     payload.rentPerMonth     = Number(sdForm.rentPerMonth)
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

  // ── Media download handler ───────────────────────────────────────────────────

  async function handleDownloadMedia() {
    if (!store) return
    setDownloading(true)
    try {
      await storesService.downloadMedia(id!, store.name)
    } catch { /* silently ignore */ }
    finally { setDownloading(false) }
  }

  // ── Media remove handlers ────────────────────────────────────────────────────

  async function handleRemoveImage(url: string) {
    if (!confirm('Remove this photo?')) return
    setError(null)
    try {
      const updated = await storesService.removeStoreImage(id!, url)
      setStore(updated)
    } catch (e: any) {
      setError(e.message ?? 'Failed to remove photo')
    }
  }

  async function handleRemoveVideo(url: string) {
    if (!confirm('Remove this video?')) return
    setError(null)
    try {
      const updated = await storesService.removeStoreVideo(id!, url)
      setStore(updated)
    } catch (e: any) {
      setError(e.message ?? 'Failed to remove video')
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
    basicInfo:       saveBasicInfo,
    drugLicense:     saveDrugLicense,
    firmDetails:     saveFirmDetails,
    personalDetails: savePersonalDetails,
    storeDetails:    saveStoreDetails,
  }

  function getTabStatus(tab: Tab): TabStatus {
    if (tab === 'basicInfo') return getBasicInfoStatus(store!)
    return getActivationTabStatus(tab, store!)
  }

  const canSaveBasic = basicForm.name.trim() && basicForm.city.trim() && basicForm.state

  return (
    <div className="page">

      {/* ── Page header ── */}
      <div className="saf-header">
        <button className="saf-back" onClick={() => navigate('/stores')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Stores
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
      </div>

      {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* ── Section tabs ── */}
      <div className="saf-tabs">
        {TABS.map(tab => {
          const status = getTabStatus(tab.key)
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

        {/* ── Basic Info ── */}
        {activeTab === 'basicInfo' && (
          <div className="saf-section">
            <div className="saf-section-intro">
              <h2 className="saf-section-title">Basic Info</h2>
              <p className="saf-section-desc">Core store details, location coordinates, and allowed area radius.</p>
            </div>

            <div className="saf-field-grid">
              {/* Store Name */}
              <div className="form-group">
                <label className="form-label">Store Name<span className="saf-required"> *</span></label>
                <input
                  className="form-input"
                  value={basicForm.name}
                  onChange={e => setBasicForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Dr Morepen Connaught Place"
                  autoComplete="off"
                />
              </div>

              {/* ERP Code */}
              <div className="form-group">
                <label className="form-label">ERP Code <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                <input
                  className="form-input"
                  value={basicForm.erpCode}
                  onChange={e => setBasicForm(f => ({ ...f, erpCode: e.target.value }))}
                  placeholder="e.g. STORE-001"
                  autoComplete="off"
                />
              </div>

              {/* City */}
              <div className="form-group">
                <label className="form-label">City<span className="saf-required"> *</span></label>
                <input
                  className="form-input"
                  value={basicForm.city}
                  onChange={e => setBasicForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="City"
                  autoComplete="off"
                />
              </div>

              {/* State */}
              <div className="form-group">
                <label className="form-label">State<span className="saf-required"> *</span></label>
                <select
                  className="form-input"
                  value={basicForm.state}
                  onChange={e => setBasicForm(f => ({ ...f, state: e.target.value }))}
                >
                  <option value="" disabled>Select state</option>
                  {INDIAN_STATES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Address */}
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">Address <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
              <input
                className="form-input"
                value={basicForm.address}
                onChange={e => setBasicForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Street / locality"
                autoComplete="off"
              />
            </div>

            {/* Store Type */}
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">Store Type<span className="saf-required"> *</span></label>
              <div className="as-type-toggle" role="group" aria-label="Store type" style={{ marginTop: '0.4rem' }}>
                {([StoreType.COCO, StoreType.FOFO] as StoreType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`as-type-btn${basicForm.type === t ? ' selected' : ''}`}
                    onClick={() => setBasicForm(f => ({ ...f, type: t }))}
                    aria-pressed={basicForm.type === t}
                  >
                    <span className="as-type-dot" aria-hidden="true" />
                    {t}
                  </button>
                ))}
              </div>
              <p className="as-type-hint" style={{ marginTop: '0.35rem' }}>
                {basicForm.type === StoreType.COCO
                  ? 'Company Owned, Company Operated'
                  : 'Franchise Owned, Franchise Operated'}
              </p>
            </div>

            {/* Coordinates */}
            <div className="saf-subsection-label" style={{ marginTop: '1.5rem' }}>GPS Coordinates</div>
            <div className="saf-field-grid">
              <div className="form-group">
                <label className="form-label">Latitude <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                <input
                  className="form-input"
                  type="number"
                  step="any"
                  value={basicForm.latitude}
                  onChange={e => setBasicForm(f => ({ ...f, latitude: e.target.value }))}
                  placeholder="e.g. 28.613900"
                  autoComplete="off"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Longitude <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                <input
                  className="form-input"
                  type="number"
                  step="any"
                  value={basicForm.longitude}
                  onChange={e => setBasicForm(f => ({ ...f, longitude: e.target.value }))}
                  placeholder="e.g. 77.209000"
                  autoComplete="off"
                />
              </div>
            </div>
            <button
              type="button"
              className="saf-capture-btn"
              onClick={captureCoords}
              disabled={capturingCoords}
            >
              {capturingCoords ? (
                <>
                  <span className="saf-capture-spinner" aria-hidden="true" />
                  Capturing…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>
                    <path d="M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
                  </svg>
                  Capture Current Coordinates
                </>
              )}
            </button>

            {/* Radius */}
            <div className="form-group" style={{ marginTop: '1.5rem' }}>
              <label className="form-label">Allowed Radius <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(metres, optional)</span></label>
              <input
                className="form-input"
                type="number"
                min="1"
                step="1"
                value={basicForm.radius}
                onChange={e => setBasicForm(f => ({ ...f, radius: e.target.value }))}
                placeholder="e.g. 500"
                autoComplete="off"
              />
              <p className="as-type-hint" style={{ marginTop: '0.35rem' }}>
                Site inspections must be submitted within this distance of the store.
              </p>
            </div>

            <div className="saf-save-bar">
              {savedTab === 'basicInfo' && (
                <span className="saf-saved-msg">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Saved
                </span>
              )}
              <button
                className="btn btn-primary"
                onClick={saveBasicInfo}
                disabled={!canSaveBasic || savingTab === 'basicInfo'}
              >
                {savingTab === 'basicInfo' ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* ── Store Details ── */}
        {activeTab === 'storeDetails' && (
          <div className="saf-section">
            <div className="saf-section-intro">
              <h2 className="saf-section-title">Store Details</h2>
              <p className="saf-section-desc">Physical dimensions, ownership, and media for the store premises.</p>
            </div>

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

            {/* Store Photos */}
            <div className="saf-media-section">
              <div className="saf-media-header">
                <div className="saf-subsection-label" style={{ margin: 0 }}>
                  Store Photos ({store.storeDetails?.images?.length ?? 0})<span className="saf-required"> *</span>
                  {' '}<span style={{ fontWeight: 400, fontSize: '0.8rem', textTransform: 'none', letterSpacing: 0 }}>min 5</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {((store.storeDetails?.images?.length ?? 0) > 0 || (store.storeDetails?.videos?.length ?? 0) > 0) && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={handleDownloadMedia}
                      disabled={downloading}
                    >
                      {downloading ? (
                        <>
                          <span className="saf-capture-spinner" style={{ width: 11, height: 11, borderWidth: 2 }} aria-hidden="true" />
                          Downloading…
                        </>
                      ) : (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          Download All
                        </>
                      )}
                    </button>
                  )}
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
              </div>
              {store.storeDetails?.images && store.storeDetails.images.length > 0 ? (
                <div className="saf-image-grid">
                  {store.storeDetails.images.map((url, i) => (
                    <div key={i} className="saf-thumb-wrap">
                      {isImage(url)
                        ? <img src={url} alt={`Store photo ${i + 1}`} />
                        : <div className="saf-image-placeholder">File {i + 1}</div>
                      }
                      <button
                        className="saf-thumb-remove"
                        onClick={() => handleRemoveImage(url)}
                        title="Remove photo"
                        aria-label={`Remove photo ${i + 1}`}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="saf-media-empty">No photos uploaded yet</div>
              )}
            </div>

            {/* Store Videos */}
            <div className="saf-media-section">
              <div className="saf-media-header">
                <div className="saf-subsection-label" style={{ margin: 0 }}>
                  Store Videos ({store.storeDetails?.videos?.length ?? 0})<span className="saf-required"> *</span>
                </div>
              </div>
              {store.storeDetails?.videos && store.storeDetails.videos.length > 0 && (
                <div className="saf-image-grid">
                  {store.storeDetails.videos.map((url, i) => (
                    <div key={i} className="saf-thumb-wrap">
                      <video src={url} preload="metadata" playsInline muted />
                      <button
                        className="saf-thumb-play"
                        onClick={() => setPlayingVideo(url)}
                        aria-label={`Play video ${i + 1}`}
                      >
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="none" aria-hidden="true">
                          <polygon points="5,3 19,12 5,21"/>
                        </svg>
                      </button>
                      <button
                        className="saf-thumb-remove"
                        onClick={() => handleRemoveVideo(url)}
                        title="Remove video"
                        aria-label={`Remove video ${i + 1}`}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <VideoCapture onChange={handleStoreVideos} maxVideos={10} />
            </div>
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
                <input className="form-input" value={firmForm.firmName}
                  onChange={e => setFirmForm(f => ({ ...f, firmName: e.target.value }))}
                  placeholder="Registered firm name" />
              </div>
              <div className="form-group">
                <label className="form-label">Authorized Person<span className="saf-required"> *</span></label>
                <input className="form-input" value={firmForm.authorizedPerson}
                  onChange={e => setFirmForm(f => ({ ...f, authorizedPerson: e.target.value }))}
                  placeholder="Name of authorized signatory" />
              </div>
              <div className="form-group">
                <label className="form-label">Firm Type<span className="saf-required"> *</span></label>
                <select className="form-input" value={firmForm.firmType}
                  onChange={e => setFirmForm(f => ({ ...f, firmType: e.target.value }))}>
                  <option value="">Select firm type</option>
                  {FIRM_TYPE_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Designation</label>
                <input className="form-input" value={firmForm.designation}
                  onChange={e => setFirmForm(f => ({ ...f, designation: e.target.value }))}
                  placeholder="e.g. Proprietor, Partner, Director" />
              </div>
              <div className="form-group">
                <label className="form-label">PAN Number</label>
                <input className="form-input" value={firmForm.panNo}
                  onChange={e => setFirmForm(f => ({ ...f, panNo: e.target.value.toUpperCase() }))}
                  placeholder="ABCDE1234F" maxLength={10} />
              </div>
              <div className="form-group">
                <label className="form-label">GST Number</label>
                <input className="form-input" value={firmForm.gstNo}
                  onChange={e => setFirmForm(f => ({ ...f, gstNo: e.target.value.toUpperCase() }))}
                  placeholder="22ABCDE1234F1Z5" maxLength={15} />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '0.85rem' }}>
              <label className="form-label">Firm Address</label>
              <textarea className="form-input saf-textarea" value={firmForm.address}
                onChange={e => setFirmForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Registered business address" rows={3} />
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
                <input className="form-input" value={personalForm.name}
                  onChange={e => setPersonalForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="As per ID proof" />
              </div>
              <div className="form-group">
                <label className="form-label">Gender<span className="saf-required"> *</span></label>
                <select className="form-input" value={personalForm.gender}
                  onChange={e => setPersonalForm(f => ({ ...f, gender: e.target.value }))}>
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Qualification<span className="saf-required"> *</span></label>
                <input className="form-input" value={personalForm.qualification}
                  onChange={e => setPersonalForm(f => ({ ...f, qualification: e.target.value }))}
                  placeholder="e.g. B.Pharm, D.Pharm, M.Pharm" />
              </div>
              <div className="form-group">
                <label className="form-label">Experience (years)</label>
                <input className="form-input" type="number" min="0" value={personalForm.experienceYears}
                  onChange={e => setPersonalForm(f => ({ ...f, experienceYears: e.target.value }))}
                  placeholder="Years of pharmacy experience" />
              </div>
              <div className="form-group">
                <label className="form-label">Email<span className="saf-required"> *</span></label>
                <input className="form-input" type="email" value={personalForm.email}
                  onChange={e => setPersonalForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Date of Birth<span className="saf-required"> *</span></label>
                <input className="form-input" type="date" value={personalForm.dob}
                  onChange={e => setPersonalForm(f => ({ ...f, dob: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Aadhar Number<span className="saf-required"> *</span></label>
                <input className="form-input" value={personalForm.aadharNo}
                  onChange={e => setPersonalForm(f => ({ ...f, aadharNo: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                  placeholder="12-digit Aadhar number" maxLength={12} inputMode="numeric" />
              </div>
            </div>

            <SaveBar tab="personalDetails" savingTab={savingTab} savedTab={savedTab} onSave={saveHandlers.personalDetails} />
          </div>
        )}

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
                <input className="form-input" value={dlForm.drugLicenseName}
                  onChange={e => setDlForm(f => ({ ...f, drugLicenseName: e.target.value }))}
                  placeholder="Name as per drug license" />
              </div>
              <div className="form-group">
                <label className="form-label">Store Area (sq ft)</label>
                <input className="form-input" type="number" min="0" value={dlForm.storeArea}
                  onChange={e => setDlForm(f => ({ ...f, storeArea: e.target.value }))}
                  placeholder="e.g. 250" />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '0.85rem' }}>
              <label className="form-label">Full Address as per Drug License</label>
              <textarea className="form-input saf-textarea" value={dlForm.fullAddressAsPerDL}
                onChange={e => setDlForm(f => ({ ...f, fullAddressAsPerDL: e.target.value }))}
                placeholder="Complete address as printed on the drug license" rows={3} />
            </div>

            <div className="saf-dl-grid">
              {DL_TYPES.map(({ key, type, label }) => (
                <div key={key} className="saf-dl-card">
                  <div className="saf-dl-card-header">
                    <span className="saf-dl-card-title">
                      {label}{key === 'dl20_20B' && <span className="saf-required"> *</span>}
                    </span>
                    {store.drugLicenseDetails?.[key]?.file && (
                      <a className="saf-file-link" href={store.drugLicenseDetails[key]!.file} target="_blank" rel="noreferrer">
                        View uploaded ↗
                      </a>
                    )}
                  </div>
                  <div className="saf-dl-card-fields">
                    <div className="form-group">
                      <label className="form-label">License Number{key === 'dl20_20B' && <span className="saf-required"> *</span>}</label>
                      <input className="form-input" value={dlForm[key].licenseNumber}
                        onChange={e => setDlForm(f => ({ ...f, [key]: { ...f[key], licenseNumber: e.target.value } }))}
                        placeholder="e.g. MH-MUM-20-123456" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Valid Upto{key === 'dl20_20B' && <span className="saf-required"> *</span>}</label>
                      <input className="form-input" type="date" value={dlForm[key].validUpto}
                        onChange={e => setDlForm(f => ({ ...f, [key]: { ...f[key], validUpto: e.target.value } }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Status{key === 'dl20_20B' && <span className="saf-required"> *</span>}</label>
                      <select className="form-input" value={dlForm[key].status}
                        onChange={e => setDlForm(f => ({ ...f, [key]: { ...f[key], status: e.target.value } }))}>
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

      </div>

      {/* ── Video lightbox ── */}
      {playingVideo && (
        <div className="saf-video-modal" onClick={() => setPlayingVideo(null)}>
          <div className="saf-video-modal-inner" onClick={e => e.stopPropagation()}>
            <button
              className="saf-video-modal-close"
              onClick={() => setPlayingVideo(null)}
              aria-label="Close video"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <video src={playingVideo} controls autoPlay />
          </div>
        </div>
      )}

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
