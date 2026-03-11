import { useState, useEffect, Fragment } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  siteInspectionsService,
  type SiteInspection,
  type SISection,
  type SIPopulatedStore,
  type SIPopulatedUser,
  type OperationsSubmission,
  type SiteSubmission,
} from '../services/site-inspections.service'
import './SiteInspectionsComparison.css'

// ── Section definitions ────────────────────────────────────────────────────────

interface SectionDef { key: string; label: string; fields: { key: string; label: string }[] }

const FORM_SECTIONS: SectionDef[] = [
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

function getEffectiveSubmission(si: SiteInspection): OperationsSubmission | SiteSubmission | undefined {
  return si.operationsSubmission ?? si.areaManagerSubmission
}

function getRating(sub: OperationsSubmission | SiteSubmission | undefined, sectionKey: string, fieldKey: string): number | undefined {
  return (sub as any)?.[sectionKey]?.[fieldKey]
}

function calcTotalScore(sub: OperationsSubmission | SiteSubmission | undefined): number {
  if (!sub) return 0
  let sum = 0, count = 0
  for (const sec of FORM_SECTIONS) {
    const section = (sub as any)[sec.key] as SISection | undefined
    if (!section) continue
    for (const f of sec.fields) {
      const v = section[f.key]
      if (typeof v === 'number' && v >= 1 && v <= 5) { sum += v; count++ }
    }
  }
  return count > 0 ? Math.round((sum / (count * 5)) * 100) : 0
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}


function RatingCell({ value }: { value?: number }) {
  if (!value) return <span className="cmp-empty">—</span>
  const cls = value >= 4 ? 'cmp-val-good' : value >= 3 ? 'cmp-val-mid' : 'cmp-val-low'
  return <span className={`cmp-val ${cls}`}>{value}</span>
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SiteInspectionsComparison() {
  const { storeId } = useParams<{ storeId: string }>()
  const navigate    = useNavigate()

  const [sis,           setSis]          = useState<SiteInspection[]>([])
  const [loading,       setLoading]      = useState(true)
  const [error,         setError]        = useState<string | null>(null)
  const [approving,     setApproving]    = useState<string | null>(null)
  const [approveErr,    setApproveErr]   = useState<string | null>(null)
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set())

  const store = sis[0]?.store && typeof sis[0].store === 'object'
    ? sis[0].store as SIPopulatedStore
    : null

  useEffect(() => {
    if (!storeId) return
    siteInspectionsService.getComparison(storeId)
      .then(setSis)
      .catch(err => setError(err?.message ?? 'Failed to load comparison data.'))
      .finally(() => setLoading(false))
  }, [storeId])

  async function handleDownload(siId: string, storeName: string) {
    setDownloadingIds(prev => new Set(prev).add(siId))
    try {
      await siteInspectionsService.downloadMedia(siId, storeName)
    } catch { /* silently ignore */ }
    finally {
      setDownloadingIds(prev => { const next = new Set(prev); next.delete(siId); return next })
    }
  }

  async function handleApprove(siId: string) {
    setApproving(siId)
    setApproveErr(null)
    try {
      await siteInspectionsService.approve(siId)
      navigate('/site-inspections')
    } catch (e: unknown) {
      setApproveErr(e instanceof Error ? e.message : 'Approval failed.')
      setApproving(null)
    }
  }

  // ── Loading / error ────────────────────────────────────────────────────────

  if (loading) return (
    <div className="page">
      <div className="state-box"><span className="spinner" /><span className="state-box-text">Loading comparison…</span></div>
    </div>
  )

  if (error) return (
    <div className="page">
      <div className="state-box">
        <span className="state-box-icon">!</span>
        <p className="state-box-text">{error}</p>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/site-inspections')}>Back</button>
      </div>
    </div>
  )

  if (sis.length === 0) return (
    <div className="page">
      <div className="state-box">
        <span className="state-box-icon">🔍</span>
        <p className="state-box-text">No site inspections with operations submissions found for this store.</p>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/site-inspections')}>Back</button>
      </div>
    </div>
  )

  const totalScores = sis.map(si => calcTotalScore(getEffectiveSubmission(si)))

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="cmp-page">
      {/* Header */}
      <div className="cmp-page-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/site-inspections')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Site Inspections
        </button>
        <h1 className="page-title">Site Comparison</h1>
        {store && (
          <p className="cmp-store-sub">
            {store.name}
            {store.erpCode ? ` · ${store.erpCode}` : ''}
            {' · '}{store.city}, {store.state}
          </p>
        )}
        {approveErr && <p className="cmp-approve-err">{approveErr}</p>}
      </div>

      {/* Comparison table */}
      <div className="cmp-table-wrap">
        <table className="cmp-table">
          <thead>
            {/* Site column headers */}
            <tr>
              <th className="cmp-th-label" rowSpan={2}>Rating Item</th>
              {sis.map((si, idx) => {
                const isPendingAdmin = si.stage === 'pending_admin'
                const isApproved    = si.stage === 'approved'

                // Reviewer names
                const amSub  = si.areaManagerSubmission
                const opsSub = si.operationsSubmission
                const amName  = amSub  && typeof amSub.submittedBy  === 'object' ? (amSub.submittedBy  as SIPopulatedUser).name : null
                const opsName = opsSub && typeof opsSub.submittedBy === 'object' ? (opsSub.submittedBy as SIPopulatedUser).name : null

                // GPS: FO first, AM fallback
                const gps = si.franchiseSubmission?.gpsCoordinates ?? si.areaManagerSubmission?.gpsCoordinates
                const mapsUrl = gps
                  ? `https://www.google.com/maps?q=${gps.latitude},${gps.longitude}`
                  : null

                // Media: only show download if any files exist
                const totalMedia = [
                  ...(si.franchiseSubmission?.photos  ?? []),
                  ...(si.franchiseSubmission?.videos  ?? []),
                  ...(si.areaManagerSubmission?.photos ?? []),
                  ...(si.areaManagerSubmission?.videos ?? []),
                ].length
                const siStoreName = typeof si.store === 'object' ? (si.store as SIPopulatedStore).name : 'SI'
                const isDownloading = downloadingIds.has(si._id)

                return (
                  <th key={si._id} className="cmp-th-site">
                    <div className="cmp-site-header">
                      <span className="cmp-site-num">Site {idx + 1}</span>
                      {si.name && <span className="cmp-site-name">{si.name}</span>}
                      <span className="cmp-site-date">{fmtDate(si.createdAt)}</span>
                      {amName  && <span className="cmp-site-reviewer"><span className="cmp-reviewer-role">AM</span>{amName}</span>}
                      {opsName && <span className="cmp-site-reviewer"><span className="cmp-reviewer-role">Ops</span>{opsName}</span>}

                      {/* Maps + Download links */}
                      {(mapsUrl || totalMedia > 0) && (
                        <div className="cmp-site-links">
                          {mapsUrl && (
                            <a
                              className="cmp-site-link"
                              href={mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open in Google Maps"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
                                <circle cx="12" cy="10" r="3"/>
                              </svg>
                              Maps
                            </a>
                          )}
                          {totalMedia > 0 && (
                            <button
                              type="button"
                              className="cmp-site-link cmp-site-link-btn"
                              disabled={isDownloading}
                              onClick={() => handleDownload(si._id, siStoreName)}
                              title={`Download ${totalMedia} media files`}
                            >
                              {isDownloading ? (
                                <><span className="cmp-dl-spinner" /> Downloading…</>
                              ) : (
                                <>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="7 10 12 15 17 10"/>
                                    <line x1="12" y1="15" x2="12" y2="3"/>
                                  </svg>
                                  Media ({totalMedia})
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}

                      {isPendingAdmin && (
                        <button
                          className="btn btn-primary btn-sm cmp-approve-btn"
                          disabled={approving === si._id}
                          onClick={() => handleApprove(si._id)}
                        >
                          {approving === si._id ? 'Approving…' : 'Approve'}
                        </button>
                      )}
                      {isApproved && (
                        <span className="badge badge-approved cmp-approved-badge">Approved</span>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
            {/* Total score row */}
            <tr className="cmp-score-row">
              {sis.map((si, idx) => {
                const score = totalScores[idx]
                const cls = score >= 70 ? 'cmp-score-good' : score >= 40 ? 'cmp-score-mid' : 'cmp-score-low'
                return (
                  <th key={si._id} className={`cmp-th-score ${cls}`}>{score}%</th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {FORM_SECTIONS.map(sec => (
              <Fragment key={sec.key}>
                {/* Section group header */}
                <tr className="cmp-section-row">
                  <td colSpan={sis.length + 1} className="cmp-section-label">{sec.label}</td>
                </tr>
                {/* Field rows */}
                {sec.fields.map(f => (
                  <tr key={`${sec.key}-${f.key}`} className="cmp-field-row">
                    <td className="cmp-td-label">{f.label}</td>
                    {sis.map(si => (
                      <td key={si._id} className="cmp-td-val">
                        <RatingCell value={getRating(getEffectiveSubmission(si), sec.key, f.key)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="cmp-total-row">
              <td className="cmp-td-total-label">Total Score</td>
              {sis.map((si, idx) => {
                const score = totalScores[idx]
                const cls = score >= 70 ? 'cmp-score-good' : score >= 40 ? 'cmp-score-mid' : 'cmp-score-low'
                return (
                  <td key={si._id} className={`cmp-td-total ${cls}`}>{score}%</td>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
