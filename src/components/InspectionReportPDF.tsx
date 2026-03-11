import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { Visit, PopulatedStore, PopulatedUser } from '../services/visits.service'
import type {
  Inspection,
  AmbianceSection,
  EquipmentSection,
  ComplianceSection,
  StoreTeamSection,
  OperationsSection,
} from '../services/inspections.service'

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  primary:   '#4f46e5',
  text:      '#1e293b',
  muted:     '#64748b',
  border:    '#e2e8f0',
  rowAlt:    '#f8fafc',
  yes:       '#16a34a',
  no:        '#dc2626',
  good:      '#15803d',
  avg:       '#b45309',
  subhead:   '#ede9fe',
  subtext:   '#4f46e5',
  white:     '#ffffff',
  headerBg:  '#4f46e5',
  sectionBg: '#f1f5f9',
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: C.text, backgroundColor: C.white, paddingHorizontal: 36, paddingTop: 36, paddingBottom: 48 },

  // Header
  header:      { backgroundColor: C.headerBg, borderRadius: 4, padding: '12 16', marginBottom: 14 },
  headerTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 2 },
  headerSub:   { fontSize: 9, color: '#c7d2fe' },

  // Meta card
  metaCard:    { borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: '10 12', marginBottom: 12 },
  metaTitle:   { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.text, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 4 },
  metaGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  metaItem:    { width: '48%', flexDirection: 'row', gap: 4, marginBottom: 3 },
  metaLabel:   { color: C.muted, width: 90, flexShrink: 0 },
  metaValue:   { color: C.text, fontFamily: 'Helvetica-Bold', flex: 1 },

  // Section
  sectionWrap:   { marginBottom: 10 },
  sectionHeader: { backgroundColor: C.sectionBg, padding: '5 8', borderTopLeftRadius: 3, borderTopRightRadius: 3, borderWidth: 1, borderColor: C.border },
  sectionTitle:  { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.primary },
  sectionBody:   { borderWidth: 1, borderTopWidth: 0, borderColor: C.border, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },

  // Rows
  row:         { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.border },
  rowAlt:      { backgroundColor: C.rowAlt },
  rowLabel:    { width: 160, color: C.muted, flexShrink: 0 },
  rowValue:    { flex: 1, color: C.text },
  subheadRow:  { backgroundColor: C.subhead, paddingHorizontal: 8, paddingVertical: 3 },
  subheadText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.subtext, textTransform: 'uppercase' },

  // Badges
  badgeYes:  { backgroundColor: '#dcfce7', color: C.yes, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  badgeNo:   { backgroundColor: '#fee2e2', color: C.no,  borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  badgeGood: { backgroundColor: '#dcfce7', color: C.good, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  badgeAvg:  { backgroundColor: '#fef3c7', color: C.avg,  borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  badgeStatus: { borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2, fontSize: 8, fontFamily: 'Helvetica-Bold' },

  // Photos
  photosTitle:  { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.text, marginBottom: 6, marginTop: 10 },
  photoGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  photo:        { width: 120, height: 90, borderRadius: 3, objectFit: 'cover' },
  visitPhoto:   { width: '100%', maxHeight: 200, borderRadius: 4, marginBottom: 12, objectFit: 'cover' },

  // Notes
  notesBox:  { backgroundColor: C.rowAlt, borderWidth: 1, borderColor: C.border, borderRadius: 3, padding: '6 8', marginBottom: 10 },
  notesLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.muted, marginBottom: 3 },
  notesText:  { color: C.text, lineHeight: 1.5 },

  // Footer
  footer:     { position: 'absolute', bottom: 22, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 5 },
  footerText: { fontSize: 7, color: C.muted },

  remarksText: { fontSize: 8, color: C.muted, marginTop: 2, marginLeft: 160 },
})

// ── Primitive components ──────────────────────────────────────────────────────

function YNBadge({ v }: { v?: string }) {
  if (!v) return null
  return <Text style={v === 'yes' ? s.badgeYes : s.badgeNo}>{v === 'yes' ? 'Yes' : 'No'}</Text>
}

function GABadge({ v }: { v?: string }) {
  if (!v) return null
  return <Text style={v === 'good' ? s.badgeGood : s.badgeAvg}>{v === 'good' ? 'Good' : 'Average'}</Text>
}

function MetaRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <View style={s.metaItem}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaValue}>{value}</Text>
    </View>
  )
}

function SubHead({ label }: { label: string }) {
  return (
    <View style={s.subheadRow}>
      <Text style={s.subheadText}>{label}</Text>
    </View>
  )
}

function DataRow({ label, children, alt }: { label: string; children?: React.ReactNode; alt?: boolean }) {
  return (
    <View style={[s.row, alt ? s.rowAlt : {}]}>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.rowValue}>{children}</View>
    </View>
  )
}

function YNItemRow({ label, item, alt }: { label: string; item?: { status?: string; remarks?: string }; alt?: boolean }) {
  if (!item?.status && !item?.remarks) return null
  return (
    <>
      <DataRow label={label} alt={alt}>
        {item.status ? <YNBadge v={item.status} /> : null}
      </DataRow>
      {item.remarks ? (
        <View style={[s.row, alt ? s.rowAlt : {}, { paddingLeft: 20 }]}>
          <Text style={[s.rowLabel, { width: 140, color: C.muted, fontSize: 8, fontFamily: 'Helvetica-Oblique' }]}>Remarks</Text>
          <Text style={[s.rowValue, { fontSize: 8, color: C.muted }]}>{item.remarks}</Text>
        </View>
      ) : null}
    </>
  )
}

// ── Section renderers ─────────────────────────────────────────────────────────

function AmbianceSection_({ data }: { data?: AmbianceSection }) {
  if (!data) return null
  const c = data.cleanliness
  return (
    <>
      <YNItemRow label="Signboard" item={data.signboard} />
      <YNItemRow label="Inside Lighting" item={data.insideLighting} alt />
      <YNItemRow label="Air Conditioner" item={data.airConditioner} />
      <YNItemRow label="Floor Display Unit" item={data.floorDisplayUnit} alt />
      <YNItemRow label="In-Store Branding" item={data.inStoreBranding} />
      {c && (c.dust || c.cleaningNeeded || c.unwantedObjects || c.luxReading || c.remarks) && (
        <>
          <SubHead label="Cleanliness" />
          {c.dust            && <DataRow label="Dust"><YNBadge v={c.dust} /></DataRow>}
          {c.cleaningNeeded  && <DataRow label="Cleaning Needed" alt><YNBadge v={c.cleaningNeeded} /></DataRow>}
          {c.unwantedObjects && <DataRow label="Unwanted Objects"><YNBadge v={c.unwantedObjects} /></DataRow>}
          {c.luxReading      && <DataRow label="Lux Reading" alt><Text style={s.rowValue}>{c.luxReading}</Text></DataRow>}
          {c.remarks         && <DataRow label="Remarks"><Text style={[s.rowValue, { color: C.muted }]}>{c.remarks}</Text></DataRow>}
        </>
      )}
    </>
  )
}

function EquipmentSection_({ data }: { data?: EquipmentSection }) {
  if (!data) return null
  return (
    <>
      <YNItemRow label="CCTV / DVR" item={data.cctvDvr} />
      <YNItemRow label="Printer" item={data.printer} alt />
      <YNItemRow label="Refrigerators" item={data.refrigerators} />
      <YNItemRow label="LED TVs / Projectors" item={data.ledTvsProjectors} alt />
      <YNItemRow label="Water Dispenser" item={data.waterDispenser} />
    </>
  )
}

function ComplianceSection_({ data }: { data?: ComplianceSection }) {
  if (!data) return null
  const { offerDisplay: od, categoryStickers: cs, pharmaRacking: pr } = data
  return (
    <>
      {od && (
        <>
          <SubHead label="Offer Display" />
          {od.skuDisplayedListed          && <DataRow label="SKU Displayed / Listed"><Text>{od.skuDisplayedListed}</Text></DataRow>}
          {od.shelfTalkersDisplayedListed && <DataRow label="Shelf Talkers Disp./Listed" alt><Text>{od.shelfTalkersDisplayedListed}</Text></DataRow>}
          {od.licenseDisplayed            && <DataRow label="License Displayed"><YNBadge v={od.licenseDisplayed} /></DataRow>}
          {od.remarks                     && <DataRow label="Remarks" alt><Text style={[s.rowValue, { color: C.muted }]}>{od.remarks}</Text></DataRow>}
        </>
      )}
      {cs && (
        <>
          <SubHead label="Category Stickers" />
          {cs.numberOfCategoryStickers && <DataRow label="No. of Category Stickers"><Text>{cs.numberOfCategoryStickers}</Text></DataRow>}
          {cs.properFacing             && <DataRow label="Proper Facing" alt><YNBadge v={cs.properFacing} /></DataRow>}
          {cs.babyFoodFefo             && <DataRow label="Baby Food FEFO"><YNBadge v={cs.babyFoodFefo} /></DataRow>}
          {cs.remarks                  && <DataRow label="Remarks" alt><Text style={[s.rowValue, { color: C.muted }]}>{cs.remarks}</Text></DataRow>}
        </>
      )}
      {pr && (
        <>
          <SubHead label="Pharma Racking" />
          {pr.tabletBoxArrangement    && <DataRow label="Tablet Box Arrangement"><YNBadge v={pr.tabletBoxArrangement} /></DataRow>}
          {pr.alphabeticalArrangement && <DataRow label="Alphabetical Arrangement" alt><YNBadge v={pr.alphabeticalArrangement} /></DataRow>}
          {pr.genericCounter          && <DataRow label="Generic Counter"><YNBadge v={pr.genericCounter} /></DataRow>}
          {pr.feedbackSignage         && <DataRow label="Feedback Signage" alt><YNBadge v={pr.feedbackSignage} /></DataRow>}
          {pr.remarks                 && <DataRow label="Remarks"><Text style={[s.rowValue, { color: C.muted }]}>{pr.remarks}</Text></DataRow>}
        </>
      )}
    </>
  )
}

function StoreTeamSection_({ data }: { data?: StoreTeamSection }) {
  if (!data) return null
  const { attitude: at, skill: sk, knowledge: kn } = data
  return (
    <>
      {at && (
        <>
          <SubHead label="Attitude" />
          {at.grooming    && <DataRow label="Grooming"><GABadge v={at.grooming} /></DataRow>}
          {at.discipline  && <DataRow label="Discipline" alt><GABadge v={at.discipline} /></DataRow>}
          {at.greeting    && <DataRow label="Greeting"><GABadge v={at.greeting} /></DataRow>}
          {at.cooperation && <DataRow label="Cooperation" alt><GABadge v={at.cooperation} /></DataRow>}
          {at.remarks     && <DataRow label="Remarks"><Text style={[s.rowValue, { color: C.muted }]}>{at.remarks}</Text></DataRow>}
        </>
      )}
      {sk && (
        <>
          <SubHead label="Skill" />
          {sk.upselling     && <DataRow label="Upselling"><GABadge v={sk.upselling} /></DataRow>}
          {sk.crossSelling  && <DataRow label="Cross Selling" alt><GABadge v={sk.crossSelling} /></DataRow>}
          {sk.saleClosing   && <DataRow label="Sale Closing"><GABadge v={sk.saleClosing} /></DataRow>}
          {sk.acceptability && <DataRow label="Acceptability" alt><GABadge v={sk.acceptability} /></DataRow>}
          {sk.remarks       && <DataRow label="Remarks"><Text style={[s.rowValue, { color: C.muted }]}>{sk.remarks}</Text></DataRow>}
        </>
      )}
      {kn && (
        <>
          <SubHead label="Knowledge" />
          {kn.counselling            && <DataRow label="Counselling"><GABadge v={kn.counselling} /></DataRow>}
          {kn.monthlyOffer           && <DataRow label="Monthly Offer" alt><GABadge v={kn.monthlyOffer} /></DataRow>}
          {kn.substitution           && <DataRow label="Substitution"><GABadge v={kn.substitution} /></DataRow>}
          {kn.dispensingPrescription && <DataRow label="Dispensing Prescription" alt><Text>{kn.dispensingPrescription}</Text></DataRow>}
          {kn.remarks                && <DataRow label="Remarks"><Text style={[s.rowValue, { color: C.muted }]}>{kn.remarks}</Text></DataRow>}
        </>
      )}
    </>
  )
}

function OperationsSection_({ data }: { data?: OperationsSection }) {
  if (!data) return null
  const { cashAccounting: ca, stockAccounting: sa, refillReminder: rr,
          bounce: b, jit, scheduleH1: h1, billing: bl, returns: rt,
          inactiveCalling: ic, manualBill: mb, deliveryLogBook: dl } = data
  return (
    <>
      {ca && <><SubHead label="Cash Accounting" />
        {ca.closingCashVsBanking && <DataRow label="Closing Cash vs Banking"><YNBadge v={ca.closingCashVsBanking} /></DataRow>}
        {ca.runningCash          && <DataRow label="Running Cash" alt><YNBadge v={ca.runningCash} /></DataRow>}
        {ca.pettyCash            && <DataRow label="Petty Cash"><YNBadge v={ca.pettyCash} /></DataRow>}
        {ca.excessCashBook       && <DataRow label="Excess Cash Book" alt><YNBadge v={ca.excessCashBook} /></DataRow>}
        {ca.handoverBook         && <DataRow label="Handover Book"><YNBadge v={ca.handoverBook} /></DataRow>}
      </>}
      {sa && <><SubHead label="Stock Accounting" />
        {sa.unaccountedStock  && <DataRow label="Unaccounted Stock"><YNBadge v={sa.unaccountedStock} /></DataRow>}
        {sa.randomAudit50Sku  && <DataRow label="Random Audit 50 SKU" alt><YNBadge v={sa.randomAudit50Sku} /></DataRow>}
        {sa.stockCheckCycle   && <DataRow label="Stock Check Cycle"><YNBadge v={sa.stockCheckCycle} /></DataRow>}
        {sa.highValueTop50    && <DataRow label="High Value Top 50" alt><YNBadge v={sa.highValueTop50} /></DataRow>}
        {sa.damageExpiry      && <DataRow label="Damage / Expiry"><YNBadge v={sa.damageExpiry} /></DataRow>}
      </>}
      {rr && <><SubHead label="Refill Reminder" />
        {rr.frequencyEntry && <DataRow label="Frequency Entry"><YNBadge v={rr.frequencyEntry} /></DataRow>}
        {rr.dailyCalling   && <DataRow label="Daily Calling" alt><YNBadge v={rr.dailyCalling} /></DataRow>}
      </>}
      {b?.bounceEntryLast3Days && <><SubHead label="Bounce" />
        <DataRow label="Bounce Entry — Last 3 Days"><YNBadge v={b.bounceEntryLast3Days} /></DataRow>
      </>}
      {jit?.jitVsSales && <><SubHead label="JIT" />
        <DataRow label="JIT vs Sales"><YNBadge v={jit.jitVsSales} /></DataRow>
      </>}
      {h1 && <><SubHead label="Schedule H1" />
        {h1.scheduleH1Register && <DataRow label="Schedule H1 Register"><YNBadge v={h1.scheduleH1Register} /></DataRow>}
        {h1.prescriptionFile   && <DataRow label="Prescription File" alt><YNBadge v={h1.prescriptionFile} /></DataRow>}
        {h1.billingAccuracy    && <DataRow label="Billing Accuracy"><YNBadge v={h1.billingAccuracy} /></DataRow>}
      </>}
      {bl && <><SubHead label="Billing" />
        {bl.contactNo         && <DataRow label="Contact No"><YNBadge v={bl.contactNo} /></DataRow>}
        {bl.frequencyAccuracy && <DataRow label="Frequency Accuracy" alt><YNBadge v={bl.frequencyAccuracy} /></DataRow>}
        {bl.doctorName        && <DataRow label="Doctor Name"><YNBadge v={bl.doctorName} /></DataRow>}
      </>}
      {rt?.returnAuditLast7Days && <><SubHead label="Returns" />
        <DataRow label="Return Audit — Last 7 Days"><YNBadge v={rt.returnAuditLast7Days} /></DataRow>
      </>}
      {ic?.dailyCallingLast7Days && <><SubHead label="Inactive Calling" />
        <DataRow label="Daily Calling — Last 7 Days"><YNBadge v={ic.dailyCallingLast7Days} /></DataRow>
      </>}
      {mb?.consumptionReportVsPhysical && <><SubHead label="Manual Bill" />
        <DataRow label="Consumption Report vs Physical"><YNBadge v={mb.consumptionReportVsPhysical} /></DataRow>
      </>}
      {dl?.reportVsPhysical && <><SubHead label="Delivery Log Book" />
        <DataRow label="Report vs Physical"><YNBadge v={dl.reportVsPhysical} /></DataRow>
      </>}
    </>
  )
}

function InspSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.sectionWrap} wrap={false}>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      <View style={s.sectionBody}>{children}</View>
    </View>
  )
}

// ── Main document ─────────────────────────────────────────────────────────────

export interface InspectionReportProps {
  visit:      Visit
  store:      PopulatedStore | null
  manager:    PopulatedUser | null
  inspection: Inspection | null
}

export function InspectionReportPDF({ visit, store, manager, inspection }: InspectionReportProps) {
  const generatedAt = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <Document title="Store Visit Inspection Report">
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Store Visit Inspection Report</Text>
          <Text style={s.headerSub}>
            {store ? `${store.name} — ${store.city}` : `Visit ID: ${visit._id}`}
          </Text>
        </View>

        {/* Visit meta */}
        <View style={s.metaCard}>
          <Text style={s.metaTitle}>Visit Information</Text>
          <View style={s.metaGrid}>
            <MetaRow label="Date & Time" value={new Date(visit.visitDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })} />
            <MetaRow label="Status" value={visit.status.toUpperCase()} />
            {store  && <MetaRow label="Store" value={store.name} />}
            {store  && <MetaRow label="City" value={store.city} />}
            {manager && <MetaRow label="Area Manager" value={manager.name} />}
            {manager && <MetaRow label="Manager Email" value={manager.email} />}
          </View>
        </View>

        {/* Inspection */}
        {inspection && (
          <>
            {/* Inspection meta */}
            <View style={[s.metaCard, { marginBottom: 10 }]}>
              <Text style={s.metaTitle}>Inspection</Text>
              <View style={s.metaGrid}>
                <MetaRow label="Status" value={inspection.status.toUpperCase()} />
              </View>
              {inspection.notes && (
                <View style={[s.notesBox, { marginTop: 6, marginBottom: 0 }]}>
                  <Text style={s.notesLabel}>Notes</Text>
                  <Text style={s.notesText}>{inspection.notes}</Text>
                </View>
              )}
            </View>

            {/* Sections */}
            <InspSection title="1. Ambiance">
              <AmbianceSection_ data={inspection.ambiance} />
            </InspSection>
            <InspSection title="2. Equipment">
              <EquipmentSection_ data={inspection.equipment} />
            </InspSection>
            <InspSection title="3. Compliance & Merchandising">
              <ComplianceSection_ data={inspection.compliance} />
            </InspSection>
            <InspSection title="4. Store Team Observation">
              <StoreTeamSection_ data={inspection.storeTeam} />
            </InspSection>
            <InspSection title="5. Operations">
              <OperationsSection_ data={inspection.operations} />
            </InspSection>

          </>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Generated {generatedAt}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
