import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  siteInspectionsService,
  type SiteInspection,
  type SISection,
  type SiteInspectionStage,
  type SiteSubmission,
  type OperationsSubmission,
  type SIPopulatedStore,
  type SIPopulatedUser,
} from '../services/site-inspections.service'
import { downloadSiteInspectionPDF } from '../utils/pdfExport'
import './SiteInspectionDetail.css'

// ── Section definitions ────────────────────────────────────────────────────────

interface FieldDef { key: string; label: string }
interface SectionDef { key: string; label: string; fields: FieldDef[] }

const SECTIONS: SectionDef[] = [
  { key: 'locationAndCatchment', label: 'Location & Catchment', fields: [
    { key: 'highResidentialDensity',             label: 'High Residential Density' },
    { key: 'nearbyHospitalsClinicsNursingHomes', label: 'Nearby Hospitals / Clinics / Nursing Homes' },
    { key: 'doctorClinicsWithin300m',            label: 'Doctor Clinics Within 300m' },
    { key: 'elderlyFamilyPopulation',            label: 'Elderly / Family Population' },
    { key: 'strongWalkInPotential',              label: 'Strong Walk-In Potential' },
    { key: 'competitorsWithin500m',              label: 'Competitors Within 500m' },
  ]},
  { key: 'visibilityAndAccessibility', label: 'Visibility & Accessibility', fields: [
    { key: 'groundFloorLocation',         label: 'Ground Floor Location' },
    { key: 'roadFacingShop',              label: 'Road Facing Shop' },
    { key: 'visibleSignageOpportunity',   label: 'Visible Signage Opportunity' },
    { key: 'highPedestrianFootfall',      label: 'High Pedestrian Footfall' },
    { key: 'easyEntryExit',               label: 'Easy Entry / Exit' },
    { key: 'closeToMainRoad',             label: 'Close to Main Road' },
    { key: 'accessibleForSeniorCitizens', label: 'Accessible for Senior Citizens' },
    { key: 'noObstructions',              label: 'No Obstructions' },
  ]},
  { key: 'shopSpecifications', label: 'Shop Specifications', fields: [
    { key: 'minimumCarpetArea',        label: 'Minimum Carpet Area' },
    { key: 'properFrontageWidth',      label: 'Proper Frontage Width' },
    { key: 'rectangularLayout',        label: 'Rectangular Layout' },
    { key: 'adequateStorageSpace',     label: 'Adequate Storage Space' },
    { key: 'properVentilation',        label: 'Proper Ventilation' },
    { key: 'electricalLoadSufficient', label: 'Electrical Load Sufficient' },
  ]},
  { key: 'legalAndCompliance', label: 'Legal & Compliance', fields: [
    { key: 'commercialUsagePermitted',   label: 'Commercial Usage Permitted' },
    { key: 'tradeLicenseFeasible',       label: 'Trade License Feasible' },
    { key: 'drugLicenseFeasible',        label: 'Drug License Feasible' },
    { key: 'fireSafetyNorms',            label: 'Fire Safety Norms' },
    { key: 'noSealingDisputeHistory',    label: 'No Sealing / Dispute History' },
    { key: 'clearOwnershipDocuments',    label: 'Clear Ownership Documents' },
    { key: 'municipalApprovalAvailable', label: 'Municipal Approval Available' },
    { key: 'taxUpdated',                 label: 'Tax Updated' },
  ]},
  { key: 'powerWaterInfrastructure', label: 'Power, Water & Infrastructure', fields: [
    { key: 'electricity24x7',          label: '24×7 Electricity' },
    { key: 'ceilingWallCondition',     label: 'Ceiling / Wall Condition' },
    { key: 'buildingCondition',        label: 'Building Condition' },
    { key: 'inverterDgBackupFeasible', label: 'Inverter / DG Backup Feasible' },
    { key: 'waterSupply',              label: 'Water Supply' },
    { key: 'drainageFacility',         label: 'Drainage Facility' },
    { key: 'internetAvailability',     label: 'Internet Availability' },
  ]},
  { key: 'competitionAnalysis', label: 'Competition Analysis', fields: [
    { key: 'pharmaciesWithin100m',     label: 'Pharmacies Within 100m' },
    { key: 'dailyMarketNearby',        label: 'Daily Market Nearby' },
    { key: 'doctorClinicsNearby',      label: 'Doctor Clinics Nearby' },
    { key: 'competitorTypeAndCount',   label: 'Competitor Type & Count' },
    { key: 'competitorOperatingHours', label: 'Competitor Operating Hours' },
    { key: 'competitorAverageSales',   label: 'Competitor Average Sales' },
    { key: 'priceCompetitiveness',     label: 'Price Competitiveness' },
    { key: 'uspOpportunity',           label: 'USP Opportunity' },
  ]},
  { key: 'commercialsAndFinancials', label: 'Commercials & Financials', fields: [
    { key: 'rentWithinBudget',           label: 'Rent Within Budget' },
    { key: 'securityDepositReasonable',  label: 'Security Deposit Reasonable' },
    { key: 'leaseTenureMinimum5Year',    label: 'Lease Tenure ≥ 5 Years' },
    { key: 'lockInPeriodAcceptable',     label: 'Lock-In Period Acceptable' },
    { key: 'rentEscalationAcceptable',   label: 'Rent Escalation Acceptable' },
    { key: 'roiFeasibility18to24Months', label: 'ROI Feasibility (18–24 Months)' },
  ]},
  { key: 'safetyAndSecurity', label: 'Safety & Security', fields: [
    { key: 'safeNeighborhood',         label: 'Safe Neighbourhood' },
    { key: 'lowTheftRisk',             label: 'Low Theft Risk' },
    { key: 'shutterLockProvision',     label: 'Shutter / Lock Provision' },
    { key: 'cctvInstallationPossible', label: 'CCTV Installation Possible' },
    { key: 'nightOperationFeasible',   label: 'Night Operation Feasible' },
  ]},
  { key: 'parkingAndLogistics', label: 'Parking & Logistics', fields: [
    { key: 'twoWheelerParkingAvailable',    label: 'Two-Wheeler Parking Available' },
    { key: 'ambulancePatientVehicleAccess', label: 'Ambulance / Patient Vehicle Access' },
    { key: 'deliveryRiderParkingFeasible',  label: 'Delivery Rider Parking Feasible' },
    { key: 'stockDeliveryVehicleAccess',    label: 'Stock Delivery Vehicle Access' },
  ]},
  { key: 'growthAndExpansionPotential', label: 'Growth & Expansion Potential', fields: [
    { key: 'scopeForFutureExpansion',          label: 'Scope for Future Expansion' },
    { key: 'increasingResidentialDevelopment', label: 'Increasing Residential Development' },
    { key: 'upcomingHospitalsClinicsNearby',   label: 'Upcoming Hospitals / Clinics Nearby' },
    { key: 'areaGrowthTrendPositive',          label: 'Area Growth Trend Positive' },
  ]},
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function sectionScore(data: SISection | undefined): { pct: number; count: number } | null {
  if (!data) return null
  let sum = 0, count = 0
  for (const v of Object.values(data)) {
    if (typeof v === 'number' && v >= 1 && v <= 5) { sum += v; count++ }
  }
  return count > 0 ? { pct: Math.round((sum / (count * 5)) * 100), count } : null
}

function scoreClass(pct: number): string {
  return pct >= 70 ? 'sid-score-good' : pct >= 40 ? 'sid-score-mid' : 'sid-score-low'
}

function fmtUser(u: SIPopulatedUser | string | undefined): string {
  if (!u) return '—'
  return typeof u === 'object' ? u.name : u
}

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}

// ── Small UI components ────────────────────────────────────────────────────────

function RatingPips({ value }: { value?: number }) {
  if (!value) return <span className="sid-rating-empty">—</span>
  const cls = value >= 4 ? 'good' : value >= 3 ? 'mid' : 'low'
  return (
    <div className={`sid-rating sid-rating-${cls}`}>
      <span className="sid-rating-num">{value}</span>
      <div className="sid-rating-pips">
        {[1, 2, 3, 4, 5].map(i => (
          <span key={i} className={`sid-pip${i <= value ? ' sid-pip-filled' : ''}`} />
        ))}
      </div>
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value?: number }) {
  return (
    <div className="sid-field-row">
      <span className="sid-field-label">{label}</span>
      <RatingPips value={value} />
    </div>
  )
}

function SectionCard({ section, data }: { section: SectionDef; data?: SISection }) {
  const [open, setOpen] = useState(true)
  const score = sectionScore(data)

  return (
    <div className="sid-section-card">
      <button type="button" className="sid-section-head" onClick={() => setOpen(o => !o)}>
        <span className="sid-section-head-left">
          <span className="sid-section-title">{section.label}</span>
          {score !== null ? (
            <span className={`sid-section-score ${scoreClass(score.pct)}`}>{score.pct}%</span>
          ) : (
            <span className="sid-section-score-empty">Not rated</span>
          )}
        </span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s', flexShrink: 0 }}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="sid-section-body">
          {section.fields.map(f => (
            <FieldRow
              key={f.key}
              label={f.label}
              value={(data as Record<string, number> | undefined)?.[f.key]}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Stage progress bar ─────────────────────────────────────────────────────────

const STAGE_ORDER: SiteInspectionStage[] = [
  'pending_fo', 'pending_am', 'pending_ops', 'pending_admin', 'approved',
]

const STAGE_LABELS: Record<string, string> = {
  pending_fo:    'FO',
  pending_am:    'AM',
  pending_ops:   'Ops',
  pending_admin: 'Admin',
  approved:      'Approved',
}

function StageProgress({ stage }: { stage: SiteInspectionStage }) {
  const isRejected = stage === 'rejected'
  const currentIdx = STAGE_ORDER.indexOf(stage)

  if (isRejected) {
    return <div className="sid-stage-bar"><span className="badge badge-rejected">Rejected</span></div>
  }

  return (
    <div className="sid-stage-bar">
      {STAGE_ORDER.map((s, i) => {
        const done   = i < currentIdx
        const active = i === currentIdx
        return (
          <div key={s} className={`sid-stage-step${done ? ' done' : ''}${active ? ' active' : ''}`}>
            <div className="sid-stage-dot">
              {done ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : i + 1}
            </div>
            <span className="sid-stage-lbl">{STAGE_LABELS[s]}</span>
            {i < STAGE_ORDER.length - 1 && <div className="sid-stage-line" />}
          </div>
        )
      })}
    </div>
  )
}

// ── Submission panel ───────────────────────────────────────────────────────────

function SubmissionPanel({
  title,
  submission,
  skipped,
  notApplicable,
}: {
  title: string
  submission?: SiteSubmission | OperationsSubmission
  skipped?: boolean
  notApplicable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const hasData = !!submission

  return (
    <div className="sid-sub-panel">
      <button type="button" className="sid-sub-panel-head" onClick={() => setOpen(o => !o)}>
        <span className="sid-sub-panel-title">{title}</span>
        {skipped     && <span className="badge badge-inactive">Skipped</span>}
        {notApplicable && <span className="badge badge-inactive">N/A</span>}
        {!skipped && !notApplicable && !hasData && <span className="sid-sub-pending">Pending</span>}
        {hasData && <span className="badge badge-approved">{submission!.status === 'submitted' ? 'Submitted' : 'Draft'}</span>}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s', flexShrink: 0 }}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="sid-sub-panel-body">
          {(skipped || notApplicable || !hasData) && (
            <p className="sid-sub-empty">
              {skipped ? 'AM step was skipped.' : notApplicable ? 'Not applicable for this store type.' : 'No data submitted yet.'}
            </p>
          )}
          {hasData && (
            <>
              {/* Submitter + GPS (only SiteSubmission has these) */}
              <div className="sid-sub-meta">
                <div className="sid-meta-row">
                  <span className="sid-meta-label">Submitted By</span>
                  <span className="sid-meta-value">{fmtUser((submission as any).submittedBy)}</span>
                </div>
                {(submission as any).submittedAt && (
                  <div className="sid-meta-row">
                    <span className="sid-meta-label">Submitted At</span>
                    <span className="sid-meta-value">{fmtDate((submission as any).submittedAt)}</span>
                  </div>
                )}
                {(submission as SiteSubmission).gpsCoordinates && (
                  <div className="sid-meta-row">
                    <span className="sid-meta-label">GPS</span>
                    <span className="sid-meta-value">
                      {(submission as SiteSubmission).gpsCoordinates!.latitude.toFixed(6)},&nbsp;
                      {(submission as SiteSubmission).gpsCoordinates!.longitude.toFixed(6)}
                    </span>
                  </div>
                )}
                {(submission as any).remarks && (
                  <div className="sid-meta-row">
                    <span className="sid-meta-label">Remarks</span>
                    <span className="sid-meta-value">{(submission as any).remarks}</span>
                  </div>
                )}
              </div>

              {/* Section ratings */}
              <div className="sid-sections">
                {SECTIONS.map(sec => (
                  <SectionCard
                    key={sec.key}
                    section={sec}
                    data={(submission as any)[sec.key] as SISection | undefined}
                  />
                ))}
              </div>

              {/* Photos */}
              {(submission as SiteSubmission).photos?.length > 0 && (
                <div className="sid-sub-photos">
                  <div className="sid-card-title">Photos ({(submission as SiteSubmission).photos.length})</div>
                  <div className="sid-photo-grid">
                    {(submission as SiteSubmission).photos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img className="sid-photo-thumb" src={url} alt={`Photo ${i + 1}`} />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Videos */}
              {(submission as SiteSubmission).videos?.length > 0 && (
                <div className="sid-sub-videos">
                  <div className="sid-card-title">Videos ({(submission as SiteSubmission).videos.length})</div>
                  <div className="sid-video-grid">
                    {(submission as SiteSubmission).videos.map((url, i) => (
                      <video
                        key={i}
                        className="sid-video-thumb"
                        src={url}
                        controls
                        preload="metadata"
                        aria-label={`Video ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Stage badge ────────────────────────────────────────────────────────────────

const STAGE_BADGE: Record<string, { cls: string; label: string }> = {
  pending_fo:    { cls: 'badge-inactive',  label: 'Pending FO' },
  pending_am:    { cls: 'badge-scheduled', label: 'Pending AM' },
  pending_ops:   { cls: 'badge-warning',   label: 'Pending Ops' },
  pending_admin: { cls: 'badge-purple',    label: 'Pending Admin' },
  approved:      { cls: 'badge-approved',  label: 'Approved' },
  rejected:      { cls: 'badge-rejected',  label: 'Rejected' },
}

function StageBadge({ stage }: { stage: string }) {
  const { cls, label } = STAGE_BADGE[stage] ?? { cls: 'badge-inactive', label: stage }
  return <span className={`badge ${cls}`}>{label}</span>
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SiteInspectionDetail() {
  const { id }      = useParams<{ id: string }>()
  const navigate    = useNavigate()

  const [si,          setSi]          = useState<SiteInspection | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [pdfLoading,  setPdfLoading]  = useState(false)

  useEffect(() => {
    if (!id) return
    siteInspectionsService.getOne(id)
      .then(setSi)
      .catch(err => setError(err?.message ?? 'Failed to load site inspection.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="page">
      <div className="state-box">
        <div className="spinner" aria-label="Loading" />
        <p className="state-box-text">Loading…</p>
      </div>
    </div>
  )

  if (error || !si) return (
    <div className="page">
      <div className="state-box">
        <span className="state-box-icon" aria-hidden="true">!</span>
        <p className="state-box-text">{error ?? 'Inspection not found.'}</p>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/site-inspections')}>
          Back to Site Inspections
        </button>
      </div>
    </div>
  )

  const store = typeof si.store === 'object' ? si.store as SIPopulatedStore : null
  const isFOFO = store?.type === 'FOFO'
  const amSkipped = !!si.amSkippedBy

  const totalMedia = [
    ...(si.franchiseSubmission?.photos ?? []),
    ...(si.franchiseSubmission?.videos ?? []),
    ...(si.areaManagerSubmission?.photos ?? []),
    ...(si.areaManagerSubmission?.videos ?? []),
  ].length

  async function handleDownload() {
    setDownloading(true)
    try {
      await siteInspectionsService.downloadMedia(id!, store?.name ?? id!)
    } catch { /* silently ignore */ }
    finally { setDownloading(false) }
  }

  async function handleDownloadPDF() {
    if (!si) return
    setPdfLoading(true)
    try {
      await downloadSiteInspectionPDF(si)
    } catch (e) {
      console.error('PDF generation failed', e)
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="page">

      {/* ── Header ── */}
      <div className="sid-header">
        <button className="btn btn-ghost btn-sm sid-back" onClick={() => navigate('/site-inspections')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Site Inspections
        </button>
        <div className="sid-title-row">
          <h1 className="page-title">Site Inspection Detail</h1>
          <StageBadge stage={si.stage} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {totalMedia > 0 && (
            <button
              className="btn btn-ghost btn-sm sid-download-btn"
              disabled={downloading}
              onClick={handleDownload}
            >
              {downloading ? (
                <>
                  <span className="sid-download-spinner" />
                  Preparing…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download All Media ({totalMedia})
                </>
              )}
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm"
            disabled={pdfLoading}
            onClick={handleDownloadPDF}
          >
            {pdfLoading ? (
              <><span className="spinner" /> Generating PDF…</>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Stage progress bar ── */}
      <StageProgress stage={si.stage} />

      {/* ── Meta card ── */}
      <div className="sid-card">
        <div className="sid-card-title">Overview</div>
        {store && (
          <>
            <div className="sid-meta-row">
              <span className="sid-meta-label">Store</span>
              <span className="sid-meta-value sid-store-name">{store.name}</span>
            </div>
            {store.erpCode && (
              <div className="sid-meta-row">
                <span className="sid-meta-label">ERP Code</span>
                <span className="sid-meta-value">{store.erpCode}</span>
              </div>
            )}
            <div className="sid-meta-row">
              <span className="sid-meta-label">Location</span>
              <span className="sid-meta-value sid-location-cell">
                <span>{store.city}, {store.state}</span>
                {store.location?.latitude && store.location?.longitude && (
                  <a
                    className="sid-maps-link"
                    href={`https://www.google.com/maps?q=${store.location.latitude},${store.location.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Maps
                  </a>
                )}
              </span>
            </div>
            <div className="sid-meta-row">
              <span className="sid-meta-label">Type</span>
              <span className="sid-meta-value">{store.type}</span>
            </div>
          </>
        )}
        {si.name && (
          <div className="sid-meta-row">
            <span className="sid-meta-label">Name</span>
            <span className="sid-meta-value">{si.name}</span>
          </div>
        )}
        <div className="sid-meta-row">
          <span className="sid-meta-label">Created</span>
          <span className="sid-meta-value">{fmtDate(si.createdAt)}</span>
        </div>
        {si.rejectionReason && (
          <div className="sid-meta-row">
            <span className="sid-meta-label">Rejection Reason</span>
            <span className="sid-meta-value">{si.rejectionReason}</span>
          </div>
        )}
      </div>

      {/* ── Submission panels ── */}
      <div className="sid-submissions">
        <h2 className="sid-submissions-title">Submissions</h2>

        {/* Franchise Owner panel */}
        <SubmissionPanel
          title="Franchise Owner"
          submission={si.franchiseSubmission}
          notApplicable={!isFOFO}
        />

        {/* Area Manager panel */}
        <SubmissionPanel
          title="Area Manager"
          submission={si.areaManagerSubmission}
          skipped={amSkipped}
        />

        {/* Operations panel */}
        <SubmissionPanel
          title="Operations"
          submission={si.operationsSubmission}
        />
      </div>

    </div>
  )
}
