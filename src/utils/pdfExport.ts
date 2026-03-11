import { createElement } from 'react'
import { visitsService, type Visit, type PopulatedStore, type PopulatedUser } from '../services/visits.service'
import { siteInspectionsService, type SiteInspection } from '../services/site-inspections.service'
import type { Inspection } from '../services/inspections.service'

// ── Visit inspection PDF ──────────────────────────────────────────────────────

export async function downloadVisitPDF(visitOrId: Visit | string): Promise<void> {
  const visit: Visit = typeof visitOrId === 'string'
    ? await visitsService.getOne(visitOrId)
    : visitOrId

  const store      = typeof visit.store        === 'object' ? visit.store       as PopulatedStore : null
  const manager    = typeof visit.areaManager  === 'object' ? visit.areaManager as PopulatedUser  : null
  const inspection = typeof visit.inspectionId === 'object' ? visit.inspectionId as unknown as Inspection : null

  const { pdf }                 = await import('@react-pdf/renderer')
  const { InspectionReportPDF } = await import('../components/InspectionReportPDF')

  const blob    = await pdf(createElement(InspectionReportPDF, { visit, store, manager, inspection }) as any).toBlob()
  const blobUrl = URL.createObjectURL(blob)
  const a       = document.createElement('a')
  a.href        = blobUrl
  a.download    = `visit-inspection-${visit._id}.pdf`
  a.click()
  URL.revokeObjectURL(blobUrl)
}

// ── Site inspection PDF ───────────────────────────────────────────────────────

export async function downloadSiteInspectionPDF(siOrId: SiteInspection | string): Promise<void> {
  const si: SiteInspection = typeof siOrId === 'string'
    ? await siteInspectionsService.getOne(siOrId)
    : siOrId

  const { pdf }                     = await import('@react-pdf/renderer')
  const { SiteInspectionReportPDF } = await import('../components/SiteInspectionReportPDF')

  const blob    = await pdf(createElement(SiteInspectionReportPDF, { si }) as any).toBlob()
  const blobUrl = URL.createObjectURL(blob)
  const a       = document.createElement('a')
  a.href        = blobUrl
  a.download    = `site-inspection-${si._id}.pdf`
  a.click()
  URL.revokeObjectURL(blobUrl)
}
