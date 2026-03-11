import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  visitsService,
  type Visit,
  type PopulatedStore,
  type PopulatedUser,
  VisitStatus,
} from '../services/visits.service'
import type {
  Inspection,
  YesNo,
  GoodAvg,
  YesNoItem,
  AmbianceSection,
  EquipmentSection,
  ComplianceSection,
  StoreTeamSection,
  OperationsSection,
} from '../services/inspections.service'
import { tokenStorage, ApiError } from '../services/api'
import { downloadVisitPDF } from '../utils/pdfExport'
import './VisitDetail.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function shortId(id: string): string { return id.slice(-6).toUpperCase() }

// ── Badges ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: VisitStatus }) {
  const map: Record<VisitStatus, string> = {
    [VisitStatus.SCHEDULED]:  'badge badge-scheduled',
    [VisitStatus.INCOMPLETE]: 'badge badge-pending',
    [VisitStatus.OVERDUE]:    'badge badge-overdue',
    [VisitStatus.COMPLETED]:  'badge badge-completed',
    [VisitStatus.CANCELLED]:  'badge badge-cancelled',
  }
  return <span className={map[status]}>{status}</span>
}

function YNBadge({ value }: { value: YesNo }) {
  return (
    <span className={`badge ${value === 'yes' ? 'badge-completed' : 'badge-cancelled'}`}>
      {value === 'yes' ? 'Yes' : 'No'}
    </span>
  )
}

function GABadge({ value }: { value: GoodAvg }) {
  return (
    <span className={`badge ${value === 'good' ? 'badge-completed' : 'badge-scheduled'}`}>
      {value === 'good' ? 'Good' : 'Average'}
    </span>
  )
}

function InspBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${status === 'submitted' ? 'badge-completed' : 'badge-scheduled'}`}>
      {status}
    </span>
  )
}

// ── Layout primitives ─────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="vd-row">
      <span className="vd-label">{label}</span>
      <span className="vd-value">{children}</span>
    </div>
  )
}

function SubHead({ children }: { children: React.ReactNode }) {
  return <div className="vd-subhead">{children}</div>
}

function YNItemRow({ label, item }: { label: string; item?: YesNoItem }) {
  if (!item?.status && !item?.remarks) return null
  return (
    <div className="vd-yn-item">
      <Row label={label}>
        {item.status ? <YNBadge value={item.status} /> : null}
      </Row>
      {item.remarks && <p className="vd-remarks">{item.remarks}</p>}
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="vd-section-card">
      <button type="button" className="vd-section-head" onClick={() => setOpen(o => !o)}>
        <span>{title}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && <div className="vd-section-body">{children}</div>}
    </div>
  )
}

// ── Inspection section renderers ──────────────────────────────────────────────

function AmbianceRows({ data }: { data?: AmbianceSection }) {
  if (!data) return <p className="vd-empty">No data recorded.</p>
  const c = data.cleanliness
  const hasMain = data.signboard?.status || data.insideLighting?.status ||
    data.airConditioner?.status || data.floorDisplayUnit?.status || data.inStoreBranding?.status
  const hasClean = c?.dust || c?.cleaningNeeded || c?.unwantedObjects || c?.luxReading || c?.remarks
  if (!hasMain && !hasClean) return <p className="vd-empty">No data recorded.</p>
  return (
    <>
      <YNItemRow label="Signboard"          item={data.signboard} />
      <YNItemRow label="Inside Lighting"    item={data.insideLighting} />
      <YNItemRow label="Air Conditioner"    item={data.airConditioner} />
      <YNItemRow label="Floor Display Unit" item={data.floorDisplayUnit} />
      <YNItemRow label="In-Store Branding"  item={data.inStoreBranding} />
      {hasClean && (
        <>
          <SubHead>Cleanliness</SubHead>
          {c?.dust            && <Row label="Dust"><YNBadge value={c.dust} /></Row>}
          {c?.cleaningNeeded  && <Row label="Cleaning Needed"><YNBadge value={c.cleaningNeeded} /></Row>}
          {c?.unwantedObjects && <Row label="Unwanted Objects"><YNBadge value={c.unwantedObjects} /></Row>}
          {c?.luxReading      && <Row label="Lux Reading">{c.luxReading}</Row>}
          {c?.remarks         && <Row label="Remarks">{c.remarks}</Row>}
        </>
      )}
    </>
  )
}

function EquipmentRows({ data }: { data?: EquipmentSection }) {
  if (!data) return <p className="vd-empty">No data recorded.</p>
  const hasAny = data.cctvDvr?.status || data.printer?.status || data.refrigerators?.status ||
    data.ledTvsProjectors?.status || data.waterDispenser?.status
  if (!hasAny) return <p className="vd-empty">No data recorded.</p>
  return (
    <>
      <YNItemRow label="CCTV / DVR"          item={data.cctvDvr} />
      <YNItemRow label="Printer"              item={data.printer} />
      <YNItemRow label="Refrigerators"        item={data.refrigerators} />
      <YNItemRow label="LED TVs / Projectors" item={data.ledTvsProjectors} />
      <YNItemRow label="Water Dispenser"      item={data.waterDispenser} />
    </>
  )
}

function ComplianceRows({ data }: { data?: ComplianceSection }) {
  if (!data) return <p className="vd-empty">No data recorded.</p>
  const od = data.offerDisplay
  const cs = data.categoryStickers
  const pr = data.pharmaRacking
  const hasAny = od || cs || pr
  if (!hasAny) return <p className="vd-empty">No data recorded.</p>
  return (
    <>
      {od && (od.skuDisplayedListed || od.shelfTalkersDisplayedListed || od.licenseDisplayed || od.remarks) && (
        <>
          <SubHead>Offer Display</SubHead>
          {od.skuDisplayedListed          && <Row label="SKU Displayed / Listed">{od.skuDisplayedListed}</Row>}
          {od.shelfTalkersDisplayedListed && <Row label="Shelf Talkers Displayed / Listed">{od.shelfTalkersDisplayedListed}</Row>}
          {od.licenseDisplayed            && <Row label="License Displayed"><YNBadge value={od.licenseDisplayed} /></Row>}
          {od.remarks                     && <Row label="Remarks">{od.remarks}</Row>}
        </>
      )}
      {cs && (cs.numberOfCategoryStickers || cs.properFacing || cs.babyFoodFefo || cs.remarks) && (
        <>
          <SubHead>Category Stickers</SubHead>
          {cs.numberOfCategoryStickers && <Row label="No. of Category Stickers">{cs.numberOfCategoryStickers}</Row>}
          {cs.properFacing             && <Row label="Proper Facing"><YNBadge value={cs.properFacing} /></Row>}
          {cs.babyFoodFefo             && <Row label="Baby Food FEFO"><YNBadge value={cs.babyFoodFefo} /></Row>}
          {cs.remarks                  && <Row label="Remarks">{cs.remarks}</Row>}
        </>
      )}
      {pr && (pr.tabletBoxArrangement || pr.alphabeticalArrangement || pr.genericCounter || pr.feedbackSignage || pr.remarks) && (
        <>
          <SubHead>Pharma Racking</SubHead>
          {pr.tabletBoxArrangement    && <Row label="Tablet Box Arrangement"><YNBadge value={pr.tabletBoxArrangement} /></Row>}
          {pr.alphabeticalArrangement && <Row label="Alphabetical Arrangement"><YNBadge value={pr.alphabeticalArrangement} /></Row>}
          {pr.genericCounter          && <Row label="Generic Counter"><YNBadge value={pr.genericCounter} /></Row>}
          {pr.feedbackSignage         && <Row label="Feedback Signage"><YNBadge value={pr.feedbackSignage} /></Row>}
          {pr.remarks                 && <Row label="Remarks">{pr.remarks}</Row>}
        </>
      )}
    </>
  )
}

function StoreTeamRows({ data }: { data?: StoreTeamSection }) {
  if (!data) return <p className="vd-empty">No data recorded.</p>
  const at = data.attitude
  const sk = data.skill
  const kn = data.knowledge
  const hasAny = at || sk || kn
  if (!hasAny) return <p className="vd-empty">No data recorded.</p>
  return (
    <>
      {at && (at.grooming || at.discipline || at.greeting || at.cooperation || at.remarks) && (
        <>
          <SubHead>Attitude</SubHead>
          {at.grooming    && <Row label="Grooming"><GABadge value={at.grooming} /></Row>}
          {at.discipline  && <Row label="Discipline"><GABadge value={at.discipline} /></Row>}
          {at.greeting    && <Row label="Greeting"><GABadge value={at.greeting} /></Row>}
          {at.cooperation && <Row label="Cooperation"><GABadge value={at.cooperation} /></Row>}
          {at.remarks     && <Row label="Remarks">{at.remarks}</Row>}
        </>
      )}
      {sk && (sk.upselling || sk.crossSelling || sk.saleClosing || sk.acceptability || sk.remarks) && (
        <>
          <SubHead>Skill</SubHead>
          {sk.upselling     && <Row label="Upselling"><GABadge value={sk.upselling} /></Row>}
          {sk.crossSelling  && <Row label="Cross Selling"><GABadge value={sk.crossSelling} /></Row>}
          {sk.saleClosing   && <Row label="Sale Closing"><GABadge value={sk.saleClosing} /></Row>}
          {sk.acceptability && <Row label="Acceptability"><GABadge value={sk.acceptability} /></Row>}
          {sk.remarks       && <Row label="Remarks">{sk.remarks}</Row>}
        </>
      )}
      {kn && (kn.counselling || kn.monthlyOffer || kn.substitution || kn.dispensingPrescription || kn.remarks) && (
        <>
          <SubHead>Knowledge</SubHead>
          {kn.counselling            && <Row label="Counselling"><GABadge value={kn.counselling} /></Row>}
          {kn.monthlyOffer           && <Row label="Monthly Offer"><GABadge value={kn.monthlyOffer} /></Row>}
          {kn.substitution           && <Row label="Substitution"><GABadge value={kn.substitution} /></Row>}
          {kn.dispensingPrescription && <Row label="Dispensing Prescription">{kn.dispensingPrescription}</Row>}
          {kn.remarks                && <Row label="Remarks">{kn.remarks}</Row>}
        </>
      )}
    </>
  )
}

function OperationsRows({ data }: { data?: OperationsSection }) {
  if (!data) return <p className="vd-empty">No data recorded.</p>
  const { cashAccounting: ca, stockAccounting: sa, refillReminder: rr,
          bounce: b, jit, scheduleH1: h1, billing: bl, returns: rt,
          inactiveCalling: ic, manualBill: mb, deliveryLogBook: dl } = data
  return (
    <>
      {ca && (ca.closingCashVsBanking || ca.runningCash || ca.pettyCash || ca.excessCashBook || ca.handoverBook) && (
        <>
          <SubHead>Cash Accounting</SubHead>
          {ca.closingCashVsBanking && <Row label="Closing Cash vs Banking"><YNBadge value={ca.closingCashVsBanking} /></Row>}
          {ca.runningCash          && <Row label="Running Cash"><YNBadge value={ca.runningCash} /></Row>}
          {ca.pettyCash            && <Row label="Petty Cash"><YNBadge value={ca.pettyCash} /></Row>}
          {ca.excessCashBook       && <Row label="Excess Cash Book"><YNBadge value={ca.excessCashBook} /></Row>}
          {ca.handoverBook         && <Row label="Handover Book"><YNBadge value={ca.handoverBook} /></Row>}
        </>
      )}
      {sa && (sa.unaccountedStock || sa.randomAudit50Sku || sa.stockCheckCycle || sa.highValueTop50 || sa.damageExpiry) && (
        <>
          <SubHead>Stock Accounting</SubHead>
          {sa.unaccountedStock  && <Row label="Unaccounted Stock"><YNBadge value={sa.unaccountedStock} /></Row>}
          {sa.randomAudit50Sku  && <Row label="Random Audit 50 SKU"><YNBadge value={sa.randomAudit50Sku} /></Row>}
          {sa.stockCheckCycle   && <Row label="Stock Check Cycle"><YNBadge value={sa.stockCheckCycle} /></Row>}
          {sa.highValueTop50    && <Row label="High Value Top 50"><YNBadge value={sa.highValueTop50} /></Row>}
          {sa.damageExpiry      && <Row label="Damage / Expiry"><YNBadge value={sa.damageExpiry} /></Row>}
        </>
      )}
      {rr && (rr.frequencyEntry || rr.dailyCalling) && (
        <>
          <SubHead>Refill Reminder</SubHead>
          {rr.frequencyEntry && <Row label="Frequency Entry"><YNBadge value={rr.frequencyEntry} /></Row>}
          {rr.dailyCalling   && <Row label="Daily Calling"><YNBadge value={rr.dailyCalling} /></Row>}
        </>
      )}
      {b?.bounceEntryLast3Days && (
        <>
          <SubHead>Bounce</SubHead>
          <Row label="Bounce Entry — Last 3 Days"><YNBadge value={b.bounceEntryLast3Days} /></Row>
        </>
      )}
      {jit?.jitVsSales && (
        <>
          <SubHead>JIT</SubHead>
          <Row label="JIT vs Sales"><YNBadge value={jit.jitVsSales} /></Row>
        </>
      )}
      {h1 && (h1.scheduleH1Register || h1.prescriptionFile || h1.billingAccuracy) && (
        <>
          <SubHead>Schedule H1</SubHead>
          {h1.scheduleH1Register && <Row label="Schedule H1 Register"><YNBadge value={h1.scheduleH1Register} /></Row>}
          {h1.prescriptionFile   && <Row label="Prescription File"><YNBadge value={h1.prescriptionFile} /></Row>}
          {h1.billingAccuracy    && <Row label="Billing Accuracy"><YNBadge value={h1.billingAccuracy} /></Row>}
        </>
      )}
      {bl && (bl.contactNo || bl.frequencyAccuracy || bl.doctorName) && (
        <>
          <SubHead>Billing</SubHead>
          {bl.contactNo         && <Row label="Contact No"><YNBadge value={bl.contactNo} /></Row>}
          {bl.frequencyAccuracy && <Row label="Frequency Accuracy"><YNBadge value={bl.frequencyAccuracy} /></Row>}
          {bl.doctorName        && <Row label="Doctor Name"><YNBadge value={bl.doctorName} /></Row>}
        </>
      )}
      {rt?.returnAuditLast7Days && (
        <>
          <SubHead>Returns</SubHead>
          <Row label="Return Audit — Last 7 Days"><YNBadge value={rt.returnAuditLast7Days} /></Row>
        </>
      )}
      {ic?.dailyCallingLast7Days && (
        <>
          <SubHead>Inactive Calling</SubHead>
          <Row label="Daily Calling — Last 7 Days"><YNBadge value={ic.dailyCallingLast7Days} /></Row>
        </>
      )}
      {mb?.consumptionReportVsPhysical && (
        <>
          <SubHead>Manual Bill</SubHead>
          <Row label="Consumption Report vs Physical"><YNBadge value={mb.consumptionReportVsPhysical} /></Row>
        </>
      )}
      {dl?.reportVsPhysical && (
        <>
          <SubHead>Delivery Log Book</SubHead>
          <Row label="Report vs Physical"><YNBadge value={dl.reportVsPhysical} /></Row>
        </>
      )}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function VisitDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [visit, setVisit]     = useState<Visit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [busyId, setBusyId]   = useState<'complete' | 'cancel' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [pdfLoading, setPdfLoading]   = useState(false)

  async function downloadMedia(inspId: string) {
    setDownloading(true)
    try {
      const token = tokenStorage.get()
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/inspections/${inspId}/download`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!response.ok) throw new Error('Download failed')
      const blob = await response.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `inspection-${inspId}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch { /* silently ignore */ }
    setDownloading(false)
  }

  async function handleDownloadPDF() {
    if (!visit) return
    setPdfLoading(true)
    try {
      await downloadVisitPDF(visit)
    } catch (e) {
      console.error('PDF generation failed', e)
    } finally {
      setPdfLoading(false)
    }
  }

  useEffect(() => {
    if (!id) return
    visitsService.getOne(id)
      .then(setVisit)
      .catch(err => setError(err instanceof ApiError ? err.message : 'Failed to load visit.'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleAction(action: 'complete' | 'cancel') {
    if (!visit) return
    setBusyId(action)
    setActionError(null)
    try {
      await visitsService[action](visit._id)
      setVisit(prev => prev
        ? { ...prev, status: action === 'complete' ? VisitStatus.COMPLETED : VisitStatus.CANCELLED }
        : prev
      )
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Action failed.')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return (
    <div className="page">
      <div className="state-box">
        <div className="spinner" aria-label="Loading" />
        <p className="state-box-text">Loading visit…</p>
      </div>
    </div>
  )

  if (error || !visit) return (
    <div className="page">
      <div className="state-box">
        <div className="state-box-icon" aria-hidden="true">!</div>
        <p className="state-box-text">{error ?? 'Visit not found.'}</p>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/visits')}>
          Back to Visits
        </button>
      </div>
    </div>
  )

  const store   = typeof visit.store       === 'object' ? visit.store       as PopulatedStore : null
  const manager = typeof visit.areaManager === 'object' ? visit.areaManager as PopulatedUser  : null
  const insp    = typeof visit.inspectionId === 'object' ? visit.inspectionId as unknown as Inspection   : null

  return (
    <div className="page">

      {/* Back + heading */}
      <div className="vd-header">
        <button className="btn btn-ghost btn-sm vd-back" onClick={() => navigate('/visits')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Visits
        </button>
        <div className="vd-title-row">
          <h1 className="page-title">Visit Details</h1>
          <StatusBadge status={visit.status} />
        </div>
        <p className="vd-id">ID: {shortId(visit._id)}</p>
        <button
          className="btn btn-ghost btn-sm"
          disabled={pdfLoading}
          onClick={handleDownloadPDF}
          style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}
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

      {actionError && (
        <div className="error" role="alert" style={{ marginBottom: '1rem' }}>{actionError}</div>
      )}

      {/* ── Visit info card ── */}
      <div className="vd-card">
        <div className="vd-card-title">Visit Info</div>

        <Row label="Date & Time">{formatDateTime(visit.visitDate)}</Row>

        <SubHead>Store</SubHead>
        {store ? (
          <>
            <Row label="Name">{store.name}</Row>
            <Row label="City">{store.city}</Row>
          </>
        ) : (
          <Row label="ID">…{String(visit.store).slice(-6).toUpperCase()}</Row>
        )}

        <SubHead>Area Manager</SubHead>
        {manager ? (
          <>
            <Row label="Name">{manager.name}</Row>
            <Row label="Email">{manager.email}</Row>
          </>
        ) : (
          <Row label="ID">…{String(visit.areaManager).slice(-6).toUpperCase()}</Row>
        )}

        {visit.photo && (
          <>
            <SubHead>Photo</SubHead>
            <div className="vd-photo-wrap">
              <img className="vd-photo" src={visit.photo} alt="Visit photo" />
            </div>
          </>
        )}

        {visit.status === VisitStatus.SCHEDULED && (
          <div className="vd-actions">
            <button
              className="btn btn-primary btn-sm"
              disabled={busyId !== null}
              onClick={() => handleAction('complete')}
            >
              {busyId === 'complete' ? '…' : 'Complete'}
            </button>
            <button
              className="btn btn-danger btn-sm"
              disabled={busyId !== null}
              onClick={() => handleAction('cancel')}
            >
              {busyId === 'cancel' ? '…' : 'Cancel'}
            </button>
          </div>
        )}
      </div>

      {/* ── Inspection card ── */}
      {insp ? (
        <div className="vd-card">
          <div className="vd-card-title-row">
            <span className="vd-card-title">Inspection</span>
            <InspBadge status={insp.status} />
          </div>

          {insp.notes && (
            <div className="vd-insp-notes">
              <span className="vd-label">Notes</span>
              <p className="vd-notes-text">{insp.notes}</p>
            </div>
          )}

          {insp.photos && insp.photos.length > 0 && (
            <>
              <SubHead>Photos</SubHead>
              <div className="vd-photo-grid">
                {insp.photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img className="vd-photo-thumb" src={url} alt={`Inspection photo ${i + 1}`} />
                  </a>
                ))}
              </div>
            </>
          )}

          {insp.videos && insp.videos.length > 0 && (
            <>
              <SubHead>Videos</SubHead>
              <div className="vd-video-grid">
                {insp.videos.map((url, i) => (
                  <video
                    key={i}
                    className="vd-video-player"
                    src={url}
                    controls
                    playsInline
                    preload="metadata"
                  />
                ))}
              </div>
            </>
          )}

          {((insp.photos && insp.photos.length > 0) || (insp.videos && insp.videos.length > 0)) && (
            <div style={{ marginTop: '0.75rem' }}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={downloading}
                onClick={() => downloadMedia(insp._id)}
              >
                {downloading ? (
                  <><span className="spinner" /> Packaging…</>
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
            </div>
          )}

          <div className="vd-insp-sections">
            <SectionCard title="1. Ambiance">
              <AmbianceRows data={insp.ambiance} />
            </SectionCard>
            <SectionCard title="2. Equipment">
              <EquipmentRows data={insp.equipment} />
            </SectionCard>
            <SectionCard title="3. Compliance & Merchandising">
              <ComplianceRows data={insp.compliance} />
            </SectionCard>
            <SectionCard title="4. Store Team Observation">
              <StoreTeamRows data={insp.storeTeam} />
            </SectionCard>
            <SectionCard title="5. Operations">
              <OperationsRows data={insp.operations} />
            </SectionCard>
          </div>
        </div>
      ) : (
        <div className="vd-card vd-card-empty">
          <p className="vd-empty">No inspection recorded for this visit.</p>
        </div>
      )}

    </div>
  )
}
