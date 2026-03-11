import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { SiteInspection, SiteSubmission, OperationsSubmission } from '../services/site-inspections.service'

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  primary:   '#4f46e5',
  text:      '#1e293b',
  muted:     '#64748b',
  border:    '#e2e8f0',
  rowAlt:    '#f8fafc',
  white:     '#ffffff',
  headerBg:  '#1e293b',
  sectionBg: '#f1f5f9',
  subhead:   '#ede9fe',
  subtext:   '#4f46e5',
  ratingLow: '#dc2626',
  ratingMid: '#d97706',
  ratingGood:'#16a34a',
}

// ── Section definitions (mirrors SiteInspectionDetail.tsx) ───────────────────

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
    { key: 'leaseTenureMinimum5Year',    label: 'Lease Tenure \u2265 5 Years' },
    { key: 'lockInPeriodAcceptable',     label: 'Lock-In Period Acceptable' },
    { key: 'rentEscalationAcceptable',   label: 'Rent Escalation Acceptable' },
    { key: 'roiFeasibility18to24Months', label: 'ROI Feasibility (18\u201324 Months)' },
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

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: C.text, backgroundColor: C.white, paddingHorizontal: 36, paddingTop: 36, paddingBottom: 48 },

  // Header
  header:      { backgroundColor: C.headerBg, borderRadius: 4, padding: '12 16', marginBottom: 14 },
  headerTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 2 },
  headerSub:   { fontSize: 9, color: '#94a3b8' },

  // Meta card
  metaCard:    { borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: '10 12', marginBottom: 12 },
  metaTitle:   { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.text, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 4 },
  metaGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  metaItem:    { width: '48%', flexDirection: 'row', gap: 4, marginBottom: 3 },
  metaLabel:   { color: C.muted, width: 90, flexShrink: 0 },
  metaValue:   { color: C.text, fontFamily: 'Helvetica-Bold', flex: 1 },

  // Submission block
  submissionHeader:   { backgroundColor: C.primary, padding: '7 10', borderRadius: 3, marginTop: 14, marginBottom: 8 },
  submissionTitle:    { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.white },
  submissionMeta:     { borderWidth: 1, borderColor: C.border, borderRadius: 3, padding: '6 10', marginBottom: 8 },
  submissionMetaRow:  { flexDirection: 'row', marginBottom: 3 },
  submissionMetaLabel:{ width: 80, color: C.muted, flexShrink: 0 },
  submissionMetaValue:{ flex: 1, color: C.text },

  // Section table
  sectionWrap:     { marginBottom: 8 },
  sectionHeader:   { backgroundColor: C.sectionBg, padding: '4 8', borderTopLeftRadius: 3, borderTopRightRadius: 3, borderWidth: 1, borderColor: C.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle:    { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.primary },
  sectionScore:    { fontSize: 8, color: C.muted },
  sectionBody:     { borderWidth: 1, borderTopWidth: 0, borderColor: C.border, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },

  // Table rows
  tableRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: C.border },
  tableRowAlt:{ backgroundColor: C.rowAlt },
  tableLabel: { flex: 1, color: C.text },
  tableCell:  { width: 50, alignItems: 'center' },

  // Rating cell
  ratingBox:     { width: 28, height: 16, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  ratingText:    { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.white },
  ratingEmpty:   { fontSize: 8, color: C.muted },

  // Photos
  photosTitle:   { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.text, marginBottom: 5, marginTop: 8 },
  photoGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  photo:         { width: 115, height: 86, borderRadius: 3, objectFit: 'cover' },

  // Remarks
  remarksBox:    { borderWidth: 1, borderColor: C.border, borderRadius: 3, padding: '5 8', marginBottom: 6, backgroundColor: C.rowAlt },
  remarksLabel:  { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.muted, marginBottom: 2 },
  remarksText:   { fontSize: 8, color: C.text, lineHeight: 1.5 },

  // Badge
  badgeApproved: { backgroundColor: '#dcfce7', color: '#15803d', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  badgeRejected: { backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  badgePending:  { backgroundColor: '#f1f5f9', color: '#64748b', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2, fontSize: 8, fontFamily: 'Helvetica-Bold' },

  // Footer
  footer:     { position: 'absolute', bottom: 22, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 5 },
  footerText: { fontSize: 7, color: C.muted },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function ratingBg(v: number): string {
  return v >= 4 ? '#16a34a' : v >= 3 ? '#d97706' : '#dc2626'
}

function sectionScore(data: Record<string, unknown> | undefined): number | null {
  if (!data) return null
  let sum = 0, count = 0
  for (const v of Object.values(data)) {
    if (typeof v === 'number' && v >= 1 && v <= 5) { sum += v; count++ }
  }
  return count > 0 ? Math.round((sum / (count * 5)) * 100) : null
}

function fmtUser(u: unknown): string {
  if (!u) return '—'
  if (typeof u === 'object' && u !== null && 'name' in u) return (u as { name: string }).name
  return String(u)
}

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}

// ── Rating component ──────────────────────────────────────────────────────────

function RatingCell({ value }: { value?: number }) {
  if (!value) return <Text style={s.ratingEmpty}>—</Text>
  return (
    <View style={[s.ratingBox, { backgroundColor: ratingBg(value) }]}>
      <Text style={s.ratingText}>{value}/5</Text>
    </View>
  )
}

// ── Section block ─────────────────────────────────────────────────────────────

function SectionBlock({ section, data }: { section: SectionDef; data?: Record<string, unknown> }) {
  const pct = sectionScore(data)
  return (
    <View style={s.sectionWrap} wrap={false}>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>{section.label}</Text>
        {pct !== null && <Text style={s.sectionScore}>{pct}%</Text>}
      </View>
      <View style={s.sectionBody}>
        {section.fields.map((f, i) => (
          <View key={f.key} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
            <Text style={s.tableLabel}>{f.label}</Text>
            <View style={s.tableCell}>
              <RatingCell value={data?.[f.key] as number | undefined} />
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

// ── Submission block ──────────────────────────────────────────────────────────

function SubmissionBlock({
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
  if (notApplicable) return (
    <View style={s.submissionHeader}>
      <Text style={s.submissionTitle}>{title} — N/A (COCO store)</Text>
    </View>
  )

  if (skipped) return (
    <View style={s.submissionHeader}>
      <Text style={s.submissionTitle}>{title} — Skipped</Text>
    </View>
  )

  if (!submission) return (
    <View style={s.submissionHeader}>
      <Text style={s.submissionTitle}>{title} — Pending</Text>
    </View>
  )

  const foSub = submission as SiteSubmission

  return (
    <>
      <View style={s.submissionHeader}>
        <Text style={s.submissionTitle}>{title}</Text>
      </View>

      {/* Meta */}
      <View style={s.submissionMeta}>
        <View style={s.submissionMetaRow}>
          <Text style={s.submissionMetaLabel}>Submitted By</Text>
          <Text style={s.submissionMetaValue}>{fmtUser((submission as any).submittedBy)}</Text>
        </View>
        {(submission as any).submittedAt && (
          <View style={s.submissionMetaRow}>
            <Text style={s.submissionMetaLabel}>Submitted At</Text>
            <Text style={s.submissionMetaValue}>{fmtDate((submission as any).submittedAt)}</Text>
          </View>
        )}
        {foSub.gpsCoordinates && (
          <View style={s.submissionMetaRow}>
            <Text style={s.submissionMetaLabel}>GPS</Text>
            <Text style={s.submissionMetaValue}>
              {foSub.gpsCoordinates.latitude.toFixed(6)}, {foSub.gpsCoordinates.longitude.toFixed(6)}
            </Text>
          </View>
        )}
        {(submission as any).remarks && (
          <View style={s.submissionMetaRow}>
            <Text style={s.submissionMetaLabel}>Remarks</Text>
            <Text style={s.submissionMetaValue}>{(submission as any).remarks}</Text>
          </View>
        )}
      </View>

      {/* Section ratings */}
      {SECTIONS.map(sec => (
        <SectionBlock key={sec.key} section={sec} data={(submission as any)[sec.key]} />
      ))}

    </>
  )
}

// ── Stage badge text ──────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  pending_fo: 'Pending FO', pending_am: 'Pending AM', pending_ops: 'Pending Ops',
  pending_admin: 'Pending Admin', approved: 'Approved', rejected: 'Rejected',
}

// ── Main document ─────────────────────────────────────────────────────────────

export interface SiteInspectionReportProps {
  si: SiteInspection
}

export function SiteInspectionReportPDF({ si }: SiteInspectionReportProps) {
  const store     = typeof si.store === 'object' ? (si.store as any) : null
  const isFOFO    = store?.type === 'FOFO'
  const amSkipped = !!si.amSkippedBy

  const generatedAt = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <Document title="Site Inspection Report">
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Site Inspection Report</Text>
          <Text style={s.headerSub}>
            {si.name ? `${si.name}${store ? ` — ${store.name}` : ''}` : store ? store.name : `ID: ${si._id}`}
          </Text>
        </View>

        {/* Overview */}
        <View style={s.metaCard}>
          <Text style={s.metaTitle}>Overview</Text>
          <View style={s.metaGrid}>
            {store && <View style={s.metaItem}><Text style={s.metaLabel}>Store</Text><Text style={s.metaValue}>{store.name}</Text></View>}
            {store?.erpCode && <View style={s.metaItem}><Text style={s.metaLabel}>ERP Code</Text><Text style={s.metaValue}>{store.erpCode}</Text></View>}
            {store && <View style={s.metaItem}><Text style={s.metaLabel}>Location</Text><Text style={s.metaValue}>{store.city}, {store.state}</Text></View>}
            {store && <View style={s.metaItem}><Text style={s.metaLabel}>Type</Text><Text style={s.metaValue}>{store.type}</Text></View>}
            {si.name && <View style={s.metaItem}><Text style={s.metaLabel}>Name</Text><Text style={s.metaValue}>{si.name}</Text></View>}
            <View style={s.metaItem}><Text style={s.metaLabel}>Stage</Text><Text style={s.metaValue}>{STAGE_LABELS[si.stage] ?? si.stage}</Text></View>
            <View style={s.metaItem}><Text style={s.metaLabel}>Created</Text><Text style={s.metaValue}>{fmtDate(si.createdAt)}</Text></View>
            {si.rejectionReason && <View style={[s.metaItem, { width: '100%' }]}><Text style={s.metaLabel}>Rejection</Text><Text style={s.metaValue}>{si.rejectionReason}</Text></View>}
          </View>
        </View>

        {/* Franchise Owner submission */}
        <SubmissionBlock
          title="Franchise Owner"
          submission={si.franchiseSubmission}
          notApplicable={!isFOFO}
        />

        {/* Area Manager submission */}
        <SubmissionBlock
          title="Area Manager"
          submission={si.areaManagerSubmission}
          skipped={amSkipped}
        />

        {/* Operations submission */}
        <SubmissionBlock
          title="Operations"
          submission={si.operationsSubmission}
        />

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Generated {generatedAt}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
