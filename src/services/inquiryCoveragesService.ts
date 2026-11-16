import { Aur_inquiry_coveragesesService } from '../generated/services/Aur_inquiry_coveragesesService'
import { Aur_coveragesesService } from '../generated/services/Aur_coveragesesService'
import { Aur_plansService } from '../generated/services/Aur_plansService'
import { Aur_inquiriesService } from '../generated/services/Aur_inquiriesService'
import { coverageTypeLabel } from './productCoveragesService'

const normalizeId = (id: string) => id.replace(/[{}]/g, '').trim().toLowerCase()
const isGuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

export async function getInquiryCoverages(inquiryId: string) {
  const id = normalizeId(inquiryId)
  if (!isGuid(id)) throw new Error('A valid inquiry ID is required to load coverages.')
  const coverageIds = new Set<string>()
  let skipToken: string | undefined
  do {
    const result = await Aur_inquiry_coveragesesService.getAll({
      filter: `_aur_inquiry_value eq ${id} and statuscode eq 1`,
      maxPageSize: 500,
      skipToken,
    })
    if (!result.success || result.error) throw new Error(result.error?.message || 'Unable to load inquiry coverage links.')
    for (const link of result.data ?? []) {
      if (normalizeId(link._aur_inquiry_value ?? '') !== id || link.statuscode !== 1) continue
      const coverageId = normalizeId(link._aur_coverages_value ?? '')
      if (!isGuid(coverageId)) throw new Error('An inquiry coverage link is missing a valid Coverage lookup.')
      coverageIds.add(coverageId)
    }
    skipToken = result.skipToken
  } while (skipToken)

  const records: Array<{ id: string; name: string; coverageType: string }> = []
  const ids = [...coverageIds]
  // Bound concurrent reads while retrieving every distinct linked coverage.
  for (let offset = 0; offset < ids.length; offset += 10) {
    const batch = await Promise.all(ids.slice(offset, offset + 10).map(async (coverageId) => {
      const result = await Aur_coveragesesService.get(coverageId)
      if (!result.success || result.error || !result.data) throw new Error(result.error?.message || 'Unable to load a linked coverage.')
      return { id: coverageId, name: result.data.aur_name, coverageType: coverageTypeLabel(result.data) }
    }))
    records.push(...batch)
  }
  return records.sort((left, right) => left.name.localeCompare(right.name))
}

export async function deactivateInquiryCoverage(inquiryId: string, coverageId: string): Promise<void> {
  const id = normalizeId(inquiryId)
  const linkedCoverageId = normalizeId(coverageId)
  if (!isGuid(id) || !isGuid(linkedCoverageId)) throw new Error('Valid inquiry and coverage IDs are required.')

  const linkIds = new Set<string>()
  let skipToken: string | undefined
  do {
    const result = await Aur_inquiry_coveragesesService.getAll({
      filter: `_aur_inquiry_value eq ${id} and _aur_coverages_value eq ${linkedCoverageId} and statuscode eq 1`,
      maxPageSize: 500,
      skipToken,
    })
    if (!result.success || result.error) throw new Error(result.error?.message || 'Unable to load inquiry coverage links.')
    for (const link of result.data ?? []) {
      if (normalizeId(link._aur_inquiry_value ?? '') !== id || normalizeId(link._aur_coverages_value ?? '') !== linkedCoverageId || link.statuscode !== 1) continue
      const linkId = normalizeId(link.aur_inquiry_coveragesid ?? '')
      if (!isGuid(linkId)) throw new Error('An inquiry coverage link is missing a valid ID.')
      linkIds.add(linkId)
    }
    skipToken = result.skipToken
  } while (skipToken)

  if (!linkIds.size) throw new Error('This coverage is no longer active for the inquiry. Refresh the list.')
  for (const linkId of linkIds) {
    const result = await Aur_inquiry_coveragesesService.update(linkId, { statecode: 1, statuscode: 2 })
    if (!result.success || result.error) throw new Error(result.error?.message || 'Unable to remove the inquiry coverage.')
  }
}

export async function getProductPlans(productId: string) {
  const id = normalizeId(productId)
  if (!isGuid(id)) return []
  const plans: Array<{ id: string; name: string }> = []
  let skipToken: string | undefined
  do {
    const result = await Aur_plansService.getAll({ filter: `_aur_product_value eq ${id}`, maxPageSize: 500, skipToken })
    if (!result.success || result.error) throw new Error(result.error?.message || 'Unable to load product plans.')
    plans.push(...(result.data ?? [])
      .filter((plan) => normalizeId(plan._aur_product_value ?? '') === id)
      .map((plan) => ({ id: normalizeId(plan.aur_planid), name: plan.aur_name || 'Unnamed plan' })))
    skipToken = result.skipToken
  } while (skipToken)
  return plans.sort((left, right) => left.name.localeCompare(right.name))
}

export async function getPlanCoverages(productId: string, planId: string) {
  const product = normalizeId(productId)
  const plan = normalizeId(planId)
  if (!isGuid(product) || !isGuid(plan)) return []
  const planResult = await Aur_plansService.get(plan)
  if (!planResult.success || planResult.error || !planResult.data) throw new Error(planResult.error?.message || 'Unable to load the selected plan.')
  if (normalizeId(planResult.data._aur_product_value ?? '') !== product) throw new Error('The selected plan is not related to this product.')

  const coverages: Array<{ id: string; name: string; coverageType: string }> = []
  let skipToken: string | undefined
  do {
    const result = await Aur_coveragesesService.getAll({ filter: `_aur_plan_value eq ${plan} and statuscode eq 1`, maxPageSize: 500, skipToken })
    if (!result.success || result.error) throw new Error(result.error?.message || 'Unable to load plan coverages.')
    coverages.push(...(result.data ?? [])
      .filter((coverage) => normalizeId(coverage._aur_plan_value ?? '') === plan &&
        (!coverage._aur_product_value || normalizeId(coverage._aur_product_value) === product) && coverage.statuscode === 1)
      .map((coverage) => ({ id: normalizeId(coverage.aur_coveragesid), name: coverage.aur_name, coverageType: coverageTypeLabel(coverage) })))
    skipToken = result.skipToken
  } while (skipToken)
  return coverages.sort((left, right) => left.name.localeCompare(right.name))
}

export async function addExistingInquiryCoverage(inquiryId: string, productId: string, planId: string, coverageId: string): Promise<void> {
  const inquiry = normalizeId(inquiryId)
  const product = normalizeId(productId)
  const plan = normalizeId(planId)
  const coverage = normalizeId(coverageId)
  if (![inquiry, product, plan, coverage].every(isGuid)) throw new Error('Valid inquiry, product, plan, and coverage IDs are required.')

  const [inquiryResult, planResult, coverageResult] = await Promise.all([
    Aur_inquiriesService.get(inquiry), Aur_plansService.get(plan), Aur_coveragesesService.get(coverage),
  ])
  if (!inquiryResult.success || inquiryResult.error || !inquiryResult.data) throw new Error(inquiryResult.error?.message || 'Unable to load the inquiry.')
  if (!planResult.success || planResult.error || !planResult.data) throw new Error(planResult.error?.message || 'Unable to load the selected plan.')
  if (!coverageResult.success || coverageResult.error || !coverageResult.data) throw new Error(coverageResult.error?.message || 'Unable to load the selected coverage.')
  if (normalizeId(inquiryResult.data._aur_product_value ?? '') !== product || normalizeId(planResult.data._aur_product_value ?? '') !== product ||
    normalizeId(coverageResult.data._aur_plan_value ?? '') !== plan ||
    (coverageResult.data._aur_product_value && normalizeId(coverageResult.data._aur_product_value) !== product) || coverageResult.data.statuscode !== 1) {
    throw new Error('This coverage is not active in a plan for the inquiry product.')
  }

  let inactiveLinkId: string | undefined
  let skipToken: string | undefined
  do {
    const result = await Aur_inquiry_coveragesesService.getAll({
      filter: `_aur_inquiry_value eq ${inquiry} and _aur_coverages_value eq ${coverage}`,
      maxPageSize: 500,
      skipToken,
    })
    if (!result.success || result.error) throw new Error(result.error?.message || 'Unable to check existing inquiry coverages.')
    for (const link of result.data ?? []) {
      if (normalizeId(link._aur_inquiry_value ?? '') !== inquiry || normalizeId(link._aur_coverages_value ?? '') !== coverage) continue
      if (link.statuscode === 1) throw new Error('This coverage is already added to the inquiry.')
      if (!inactiveLinkId && isGuid(normalizeId(link.aur_inquiry_coveragesid ?? ''))) inactiveLinkId = normalizeId(link.aur_inquiry_coveragesid)
    }
    skipToken = result.skipToken
  } while (skipToken)

  const result = inactiveLinkId
    ? await Aur_inquiry_coveragesesService.update(inactiveLinkId, { statecode: 0, statuscode: 1 })
    : await Aur_inquiry_coveragesesService.create({
      aur_name: coverageResult.data.aur_name,
      'aur_inquiry@odata.bind': `/aur_inquiries(${inquiry})`,
      'aur_coverages@odata.bind': `/aur_coverageses(${coverage})`,
      statecode: 0,
      statuscode: 1,
    } as never)
  if (!result.success || result.error) throw new Error(result.error?.message || 'Unable to add the inquiry coverage.')
}
