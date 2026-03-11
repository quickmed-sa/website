import * as XLSX from 'xlsx'
import type { Visit } from '../services/visits.service'
import type { Inspection } from '../services/inspections.service'

function yn(v?: string): string { return v === 'yes' ? 'Yes' : v === 'no' ? 'No' : '-' }
function ga(v?: string): string { return v === 'good' ? 'Good' : v === 'average' ? 'Average' : '-' }
function str(v?: string): string { return v ?? '-' }

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

export function exportVisitsToExcel(visits: Visit[], filename = 'visits-export') {
  const rows = visits.map(v => {
    const store   = typeof v.store       === 'object' ? v.store       : null
    const manager = typeof v.areaManager === 'object' ? v.areaManager : null
    const insp    = typeof v.inspectionId === 'object' ? v.inspectionId as unknown as Inspection : null

    const a  = insp?.ambiance
    const cl = a?.cleanliness
    const eq = insp?.equipment
    const cp = insp?.compliance
    const od = cp?.offerDisplay
    const cs = cp?.categoryStickers
    const pr = cp?.pharmaRacking
    const st = insp?.storeTeam
    const at = st?.attitude
    const sk = st?.skill
    const kn = st?.knowledge
    const op = insp?.operations
    const ca = op?.cashAccounting
    const sa = op?.stockAccounting
    const rr = op?.refillReminder
    const b  = op?.bounce
    const jit = op?.jit
    const h1  = op?.scheduleH1
    const bl  = op?.billing
    const rt  = op?.returns
    const ic  = op?.inactiveCalling
    const mb  = op?.manualBill
    const dl  = op?.deliveryLogBook

    return {
      // ── Visit ──────────────────────────────────────────────────────────────
      'Visit ID':              v._id.slice(-6).toUpperCase(),
      'Store Name':            store?.name ?? str(typeof v.store === 'string' ? v.store : undefined),
      'Store City':            store?.city ?? '-',
      'Area Manager':          manager?.name ?? str(typeof v.areaManager === 'string' ? v.areaManager : undefined),
      'Area Manager Email':    manager?.email ?? '-',
      'Visit Date':            formatDateTime(v.visitDate),
      'Status':                v.status,
      'Inspection Conducted':  insp ? 'Yes' : 'No',
      'Inspection Status':     insp?.status ?? '-',
      'Inspection Notes':      insp?.notes ?? '-',

      // ── Ambiance ───────────────────────────────────────────────────────────
      'Ambiance - Signboard':           yn(a?.signboard?.status),
      'Ambiance - Signboard Remarks':   str(a?.signboard?.remarks),
      'Ambiance - Inside Lighting':     yn(a?.insideLighting?.status),
      'Ambiance - Air Conditioner':     yn(a?.airConditioner?.status),
      'Ambiance - Floor Display Unit':  yn(a?.floorDisplayUnit?.status),
      'Ambiance - In-Store Branding':   yn(a?.inStoreBranding?.status),
      'Ambiance - Dust':                yn(cl?.dust),
      'Ambiance - Cleaning Needed':     yn(cl?.cleaningNeeded),
      'Ambiance - Lux Reading':         str(cl?.luxReading),
      'Ambiance - Unwanted Objects':    yn(cl?.unwantedObjects),
      'Ambiance - Cleanliness Remarks': str(cl?.remarks),

      // ── Equipment ──────────────────────────────────────────────────────────
      'Equipment - CCTV/DVR':            yn(eq?.cctvDvr?.status),
      'Equipment - Printer':             yn(eq?.printer?.status),
      'Equipment - Refrigerators':       yn(eq?.refrigerators?.status),
      'Equipment - LED TVs/Projectors':  yn(eq?.ledTvsProjectors?.status),
      'Equipment - Water Dispenser':     yn(eq?.waterDispenser?.status),

      // ── Compliance ─────────────────────────────────────────────────────────
      'Compliance - SKU Displayed/Listed':       str(od?.skuDisplayedListed),
      'Compliance - Shelf Talkers':              str(od?.shelfTalkersDisplayedListed),
      'Compliance - License Displayed':          yn(od?.licenseDisplayed),
      'Compliance - Offer Display Remarks':      str(od?.remarks),
      'Compliance - Category Sticker Count':     str(cs?.numberOfCategoryStickers),
      'Compliance - Proper Facing':              yn(cs?.properFacing),
      'Compliance - Baby Food FEFO':             yn(cs?.babyFoodFefo),
      'Compliance - Category Sticker Remarks':   str(cs?.remarks),
      'Compliance - Tablet Box Arrangement':     yn(pr?.tabletBoxArrangement),
      'Compliance - Alphabetical Arrangement':   yn(pr?.alphabeticalArrangement),
      'Compliance - Generic Counter':            yn(pr?.genericCounter),
      'Compliance - Feedback Signage':           yn(pr?.feedbackSignage),
      'Compliance - Pharma Racking Remarks':     str(pr?.remarks),

      // ── Store Team ─────────────────────────────────────────────────────────
      'Team - Grooming':               ga(at?.grooming),
      'Team - Discipline':             ga(at?.discipline),
      'Team - Greeting':               ga(at?.greeting),
      'Team - Cooperation':            ga(at?.cooperation),
      'Team - Attitude Remarks':       str(at?.remarks),
      'Team - Upselling':              ga(sk?.upselling),
      'Team - Cross Selling':          ga(sk?.crossSelling),
      'Team - Sale Closing':           ga(sk?.saleClosing),
      'Team - Acceptability':          ga(sk?.acceptability),
      'Team - Skill Remarks':          str(sk?.remarks),
      'Team - Counselling':            ga(kn?.counselling),
      'Team - Monthly Offer':          ga(kn?.monthlyOffer),
      'Team - Substitution':           ga(kn?.substitution),
      'Team - Dispensing Prescription': str(kn?.dispensingPrescription),
      'Team - Knowledge Remarks':      str(kn?.remarks),

      // ── Operations ─────────────────────────────────────────────────────────
      'Ops - Closing Cash vs Banking':          yn(ca?.closingCashVsBanking),
      'Ops - Running Cash':                     yn(ca?.runningCash),
      'Ops - Petty Cash':                       yn(ca?.pettyCash),
      'Ops - Excess Cash Book':                 yn(ca?.excessCashBook),
      'Ops - Handover Book':                    yn(ca?.handoverBook),
      'Ops - Unaccounted Stock':                yn(sa?.unaccountedStock),
      'Ops - Random Audit 50 SKU':              yn(sa?.randomAudit50Sku),
      'Ops - Stock Check Cycle':                yn(sa?.stockCheckCycle),
      'Ops - High Value Top 50':                yn(sa?.highValueTop50),
      'Ops - Damage/Expiry':                    yn(sa?.damageExpiry),
      'Ops - Refill Frequency Entry':           yn(rr?.frequencyEntry),
      'Ops - Refill Daily Calling':             yn(rr?.dailyCalling),
      'Ops - Bounce Entry Last 3 Days':         yn(b?.bounceEntryLast3Days),
      'Ops - JIT vs Sales':                     yn(jit?.jitVsSales),
      'Ops - Schedule H1 Register':             yn(h1?.scheduleH1Register),
      'Ops - Prescription File':                yn(h1?.prescriptionFile),
      'Ops - Billing Accuracy':                 yn(h1?.billingAccuracy),
      'Ops - Contact No':                       yn(bl?.contactNo),
      'Ops - Frequency Accuracy':               yn(bl?.frequencyAccuracy),
      'Ops - Doctor Name':                      yn(bl?.doctorName),
      'Ops - Return Audit Last 7 Days':         yn(rt?.returnAuditLast7Days),
      'Ops - Daily Calling Last 7 Days':        yn(ic?.dailyCallingLast7Days),
      'Ops - Consumption Report vs Physical':   yn(mb?.consumptionReportVsPhysical),
      'Ops - Delivery Log Report vs Physical':  yn(dl?.reportVsPhysical),
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  // Auto-fit column widths based on header length
  const colWidths = Object.keys(rows[0] ?? {}).map(k => ({ wch: Math.max(k.length + 2, 14) }))
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Visits')

  const date = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${filename}-${date}.xlsx`)
}
