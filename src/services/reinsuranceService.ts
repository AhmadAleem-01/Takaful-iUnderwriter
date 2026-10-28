import { Aur_reinsurersService } from '../generated/services/Aur_reinsurersService'
import { Aur_treatiesService } from '../generated/services/Aur_treatiesService'
import { Aur_treaty_layersService } from '../generated/services/Aur_treaty_layersService'
import { Aur_treaty_participationsService } from '../generated/services/Aur_treaty_participationsService'
import { Aur_ri_capacity_checksService } from '../generated/services/Aur_ri_capacity_checksService'
import { Aur_fac_placementsService } from '../generated/services/Aur_fac_placementsService'
import { Aur_fac_offersService } from '../generated/services/Aur_fac_offersService'
import { Aur_cessionsService } from '../generated/services/Aur_cessionsService'
import { Aur_cession_linesService } from '../generated/services/Aur_cession_linesService'
import { Aur_policy_conversionsService } from '../generated/services/Aur_policy_conversionsService'
import { Aur_policiesService } from '../generated/services/Aur_policiesService'
import { AccountsService } from '../generated/services/AccountsService'
import { Aur_productsesService } from '../generated/services/Aur_productsesService'
import { Aur_inquiriesService } from '../generated/services/Aur_inquiriesService'
import { Aur_quotesService } from '../generated/services/Aur_quotesService'
import {
  Aur_reinsurersaur_country,
  Aur_reinsurersaur_party_type,
  Aur_reinsurersaur_rating_agency,
  Aur_reinsurersaur_security_rating,
  type Aur_reinsurers,
  type Aur_reinsurersBase,
} from '../generated/models/Aur_reinsurersModel'
import {
  Aur_treatiesaur_shariah_basis,
  Aur_treatiesaur_treaty_type,
  type Aur_treaties,
  type Aur_treatiesBase,
} from '../generated/models/Aur_treatiesModel'
import {
  type Aur_treaty_layers,
  type Aur_treaty_layersBase,
} from '../generated/models/Aur_treaty_layersModel'
import {
  type Aur_treaty_participations,
  type Aur_treaty_participationsBase,
} from '../generated/models/Aur_treaty_participationsModel'
import {
  Aur_ri_capacity_checksaur_calculation_source,
  Aur_ri_capacity_checksaur_outcome,
  type Aur_ri_capacity_checks,
  type Aur_ri_capacity_checksBase,
} from '../generated/models/Aur_ri_capacity_checksModel'
import {
  type Aur_fac_placements,
  type Aur_fac_placementsBase,
} from '../generated/models/Aur_fac_placementsModel'
import {
  Aur_fac_offersstatuscode,
  type Aur_fac_offers,
  type Aur_fac_offersBase,
} from '../generated/models/Aur_fac_offersModel'
import {
  Aur_cessionsaur_cession_basis,
  Aur_cessionsaur_transaction_type,
  Aur_cessionsstatuscode,
  type Aur_cessions,
  type Aur_cessionsBase,
} from '../generated/models/Aur_cessionsModel'
import {
  Aur_cession_linesaur_cession_basis,
  type Aur_cession_lines,
  type Aur_cession_linesBase,
} from '../generated/models/Aur_cession_linesModel'

export interface ReinsurerRecord {
  id: string
  name: string
  accountId: string
  accountLookupId: string
  currentExposure: number
  lastUpdated: string
  maxExposureLimit: number
  isApproved: 'Yes' | 'No'
  partyType: string
  ratingAgency: string
  ratingExpiryDate: string
  securityRating: string
  shariahApprovalRef: string
  shariahCompliant: 'Yes' | 'No'
  country: string
}

export interface ReinsurerSaveInput {
  name: string
  accountLookupId?: string
  maxExposureLimit: number
  isApproved: 'Yes' | 'No'
  partyType: string
  ratingAgency: string
  ratingExpiryDate: string
  securityRating: string
  shariahApprovalRef: string
  shariahCompliant: 'Yes' | 'No'
  country: string
}

export interface ReinsuranceLookupOption {
  value: string
  label: string
}

export interface TreatyRecord {
  id: string
  treatyName: string
  cessionPercentage: number
  commissionPercentage: number
  exchangeRate: number
  inceptionDate: string
  isCedable: 'Yes' | 'No'
  ownRetention: number | null
  productId: string
  productLookupId: string
  profitCommissionPct: number
  shariahBasis: string
  surplusSharingPct: number
  treatyCapacity: number
  treatyType: string
  treatyYear: number
  wakalaFeePercentage: number
}

export interface TreatySaveInput {
  treatyName: string
  cessionPercentage: number
  commissionPercentage: number
  exchangeRate: number
  inceptionDate: string
  isCedable: 'Yes' | 'No'
  ownRetention: number | null
  productLookupId?: string
  profitCommissionPct: number
  shariahBasis: string
  surplusSharingPct: number
  treatyCapacity: number
  treatyType: string
  treatyYear: number
  wakalaFeePercentage: number
}

export interface TreatyLayerRecord {
  id: string
  name: string
  attachmentPoint: number | null
  layerCapacity: number
  layerLimit: number
  lineNumber: number
  linesCount: number
  treatyId: string
  treatyLookupId: string
}

export interface TreatyLayerSaveInput {
  name: string
  attachmentPoint: number | null
  layerCapacity: number
  layerLimit: number
  lineNumber: number
  linesCount: number
  treatyLookupId?: string
}

export interface TreatyParticipationRecord {
  id: string
  name: string
  isLeader: 'Yes' | 'No'
  reinsurerId: string
  reinsurerLookupId: string
  sharePercentage: number
  treatyId: string
  treatyLookupId: string
  treatyLayerId: string
  treatyLayerLookupId: string
}

export interface TreatyParticipationSaveInput {
  name: string
  isLeader: 'Yes' | 'No'
  reinsurerLookupId?: string
  sharePercentage: number
  treatyLookupId?: string
  treatyLayerLookupId?: string
}

export interface RiCapacityCheckRecord {
  id: string
  name: string
  calculatedOn: string
  calculatedTime: string
  calculationSource: string
  excessToPlace: number | null
  inquiryId: string
  inquiryLookupId: string
  isActive: 'Yes' | 'No'
  outcome: string
  quoteId: string
  quoteLookupId: string
  retainedAmount: number
  sumInsured: number
  treatyAbsorbed: number
  treatyId: string
  treatyLookupId: string
}

export interface RiCapacityCheckSaveInput {
  name: string
  calculatedOn: string
  calculatedTime: string
  calculationSource: string
  excessToPlace: number | null
  inquiryLookupId?: string
  isActive: 'Yes' | 'No'
  outcome: string
  quoteLookupId?: string
  retainedAmount: number
  sumInsured: number
  treatyAbsorbed: number
  treatyLookupId?: string
}

export interface FacPlacementRecord {
  id: string
  name: string
  amountToPlace: number
  brokerId: string
  brokerLookupId: string
  brokeragePercentage: number
  capacityCheckId: string
  capacityCheckLookupId: string
  quoteId: string
  quoteLookupId: string
  riskDescription: string
  signedDownFactor: number
  subscribedPercentage: number
  subscribedLastUpdated: string
  targetCloseDate: string
}

export interface FacPlacementSaveInput {
  name: string
  amountToPlace: number
  brokerLookupId?: string
  brokeragePercentage: number
  capacityCheckLookupId?: string
  quoteLookupId?: string
  riskDescription: string
  signedDownFactor: number
  targetCloseDate: string
}

export interface FacOfferRecord {
  id: string
  name: string
  isLeader: 'Yes' | 'No'
  offeredSharePercentage: number
  placementId: string
  placementLookupId: string
  quotedRate: number
  reinsurerId: string
  reinsurerLookupId: string
  responseDate: string
  signedLinePercentage: number
  termsAndConditions: string
  writtenLinePercentage: number
  statusReason: string
}

export interface FacOfferSaveInput {
  name: string
  isLeader: 'Yes' | 'No'
  offeredSharePercentage: number
  placementLookupId?: string
  quotedRate: number
  reinsurerLookupId?: string
  responseDate: string
  signedLinePercentage: number
  termsAndConditions: string
  writtenLinePercentage: number
  statusReason: string
}

export interface CessionRecord {
  id: string
  name: string
  adjuststCessionId: string
  adjuststCessionLookupId: string
  cededSumInsured: number
  cessionBasis: string
  commissionAmount: number
  effectiveDate: string
  grossSumInsured: number
  isAdjustment: 'Yes' | 'No'
  netPayableToReinsurers: number
  policyConversionId: string
  policyConversionLookupId: string
  policyId: string
  policyLookupId: string
  retainedSumInsured: number
  transactionType: string
  statusReason: string
}

export interface CessionSaveInput {
  name: string
  adjuststCessionLookupId?: string
  cededSumInsured: number
  cessionBasis: string
  commissionAmount: number
  effectiveDate: string
  grossSumInsured: number
  isAdjustment: 'Yes' | 'No'
  netPayableToReinsurers: number
  policyConversionLookupId?: string
  policyLookupId?: string
  retainedSumInsured: number
  transactionType: string
  statusReason: string
}

export interface CessionLineRecord {
  id: string
  name: string
  cededPremium: number
  cededSumInsured: number
  cessionBasis: string
  cessionId: string
  cessionLookupId: string
  commissionPercentage: number
  facOfferId: string
  facOfferLookupId: string
  netDue: number
  reinsurerId: string
  reinsurerLookupId: string
  sharePercentage: number
  treatyId: string
  treatyLookupId: string
}

export interface CessionLineSaveInput {
  name: string
  cededPremium: number
  cededSumInsured: number
  cessionBasis: string
  cessionLookupId?: string
  commissionPercentage: number
  facOfferLookupId?: string
  netDue: number
  reinsurerLookupId?: string
  sharePercentage: number
  treatyLookupId?: string
}

export async function listReinsurers(): Promise<ReinsurerRecord[]> {
  const [reinsurersResult, cessionLinesResult] = await Promise.all([
    Aur_reinsurersService.getAll({ orderBy: ['aur_name asc'] }),
    Aur_cession_linesService.getAll({ orderBy: ['modifiedon desc'] }),
  ])
  const exposureByReinsurer = buildCurrentExposureByReinsurer(cessionLinesResult.data ?? [])
  return (reinsurersResult.data ?? []).map((record) => mapReinsurerRecord(record, exposureByReinsurer))
}

export async function listReinsurerAccountOptions(): Promise<ReinsuranceLookupOption[]> {
  const result = await AccountsService.getAll({ orderBy: ['name asc'] })
  return (result.data ?? [])
    .filter((account) => account.accountid)
    .map((account) => ({
      value: account.accountid,
      label: account.name ?? 'Unnamed account',
    }))
}

export async function listTreaties(): Promise<TreatyRecord[]> {
  const result = await Aur_treatiesService.getAll({ orderBy: ['aur_name asc'] })
  return (result.data ?? []).map(mapTreatyRecord)
}

export async function listTreatyLookupOptions(): Promise<ReinsuranceLookupOption[]> {
  const result = await Aur_treatiesService.getAll({ orderBy: ['aur_name asc'] })
  return (result.data ?? [])
    .filter((treaty) => treaty.aur_treatyid)
    .map((treaty) => ({
      value: treaty.aur_treatyid,
      label: treaty.aur_name ?? 'Untitled Treaty',
    }))
}

export async function listReinsurerLookupOptions(): Promise<ReinsuranceLookupOption[]> {
  const result = await Aur_reinsurersService.getAll({ orderBy: ['aur_name asc'] })
  return (result.data ?? [])
    .filter((reinsurer) => reinsurer.aur_reinsurerid)
    .map((reinsurer) => ({
      value: reinsurer.aur_reinsurerid,
      label: reinsurer.aur_name ?? 'Untitled Reinsurer',
    }))
}

export async function listTreatyProductOptions(): Promise<ReinsuranceLookupOption[]> {
  const result = await Aur_productsesService.getAll({ orderBy: ['aur_name asc'] })
  return (result.data ?? [])
    .filter((product) => product.aur_productsid)
    .map((product) => ({
      value: product.aur_productsid,
      label: product.aur_name,
    }))
}

export async function createTreaty(input: TreatySaveInput) {
  await Aur_treatiesService.create(buildTreatyPayload(input) as Omit<Aur_treatiesBase, 'aur_treatyid'>)
}

export async function updateTreaty(id: string, input: TreatySaveInput) {
  await Aur_treatiesService.update(id, buildTreatyPayload(input))
}

export async function listTreatyLayers(): Promise<TreatyLayerRecord[]> {
  const result = await Aur_treaty_layersService.getAll({ orderBy: ['aur_name asc'] })
  return (result.data ?? []).map(mapTreatyLayerRecord)
}

export async function listTreatyLayerLookupOptions(): Promise<ReinsuranceLookupOption[]> {
  const result = await Aur_treaty_layersService.getAll({ orderBy: ['aur_name asc'] })
  return (result.data ?? [])
    .filter((layer) => layer.aur_treaty_layerid)
    .map((layer) => ({
      value: layer.aur_treaty_layerid,
      label: layer.aur_name ?? 'Untitled Layer',
    }))
}

export async function listInquiryLookupOptions(): Promise<ReinsuranceLookupOption[]> {
  const result = await Aur_inquiriesService.getAll({ orderBy: ['createdon desc'] })
  return (result.data ?? [])
    .filter((inquiry) => inquiry.aur_inquiryid)
    .map((inquiry) => ({
      value: inquiry.aur_inquiryid,
      label: inquiry.aur_name ?? inquiry.aur_inquiry_number ?? 'Untitled Inquiry',
    }))
}

export async function listQuoteLookupOptions(): Promise<ReinsuranceLookupOption[]> {
  const result = await Aur_quotesService.getAll({ orderBy: ['createdon desc'] })
  return (result.data ?? [])
    .filter((quote) => quote.aur_quoteid)
    .map((quote) => ({
      value: quote.aur_quoteid,
      label: quote.aur_name ?? 'Untitled Quote',
    }))
}

export async function listInquiryQuoteLookupOptions(): Promise<ReinsuranceLookupOption[]> {
  const result = await Aur_inquiriesService.getAll({ orderBy: ['createdon desc'] })
  return (result.data ?? [])
    .filter((inquiry) => inquiry.aur_inquiryid)
    .map((inquiry) => ({
      value: inquiry.aur_inquiryid,
      label: inquiry.aur_inquiry_number
        ? `${inquiry.aur_inquiry_number} - ${inquiry.aur_name}`
        : inquiry.aur_name ?? 'Untitled Inquiry',
    }))
}

export async function listBrokerLookupOptions(): Promise<ReinsuranceLookupOption[]> {
  const result = await Aur_reinsurersService.getAll({ orderBy: ['aur_name asc'] })
  return (result.data ?? [])
    .filter((broker) => broker.aur_reinsurerid && broker.aur_party_type === 3)
    .map((broker) => ({
      value: broker.aur_reinsurerid,
      label: broker.aur_name ?? 'Untitled Broker',
    }))
}

export async function listCapacityCheckLookupOptions(): Promise<ReinsuranceLookupOption[]> {
  const result = await Aur_ri_capacity_checksService.getAll({ orderBy: ['aur_name asc'] })
  return (result.data ?? [])
    .filter((check) => check.aur_ri_capacity_checkid)
    .map((check) => ({
      value: check.aur_ri_capacity_checkid,
      label: check.aur_name ?? 'Untitled Capacity Check',
    }))
}

export async function createTreatyLayer(input: TreatyLayerSaveInput) {
  const result = await Aur_treaty_layersService.create(
    buildTreatyLayerPayload(input) as Omit<Aur_treaty_layersBase, 'aur_treaty_layerid'>,
  )
  assertOperationSucceeded(result, 'Treaty layer was not created.')
}

export async function updateTreatyLayer(id: string, input: TreatyLayerSaveInput) {
  const updateId = await resolveTreatyLayerUpdateId(id)
  const result = await Aur_treaty_layersService.update(updateId, buildTreatyLayerPayload(input))
  assertOperationSucceeded(result, 'Treaty layer was not saved.')
}

export async function listTreatyParticipations(): Promise<TreatyParticipationRecord[]> {
  const result = await Aur_treaty_participationsService.getAll({ orderBy: ['aur_name asc'] })
  return (result.data ?? []).map(mapTreatyParticipationRecord)
}

export async function createTreatyParticipation(input: TreatyParticipationSaveInput) {
  await Aur_treaty_participationsService.create(
    buildTreatyParticipationPayload(input) as Omit<Aur_treaty_participationsBase, 'aur_treaty_participationid'>,
  )
}

export async function updateTreatyParticipation(id: string, input: TreatyParticipationSaveInput) {
  await Aur_treaty_participationsService.update(id, buildTreatyParticipationPayload(input))
}

export async function listRiCapacityChecks(): Promise<RiCapacityCheckRecord[]> {
  const result = await Aur_ri_capacity_checksService.getAll({ orderBy: ['aur_name asc'] })
  return (result.data ?? []).map(mapRiCapacityCheckRecord)
}

export async function updateRiCapacityCheck(id: string, input: RiCapacityCheckSaveInput) {
  await Aur_ri_capacity_checksService.update(id, buildRiCapacityCheckPayload(input))
}

export async function listFacPlacements(): Promise<FacPlacementRecord[]> {
  const result = await Aur_fac_placementsService.getAll({ orderBy: ['aur_name asc'] })
  return (result.data ?? []).map(mapFacPlacementRecord)
}

export async function listFacPlacementLookupOptions(): Promise<ReinsuranceLookupOption[]> {
  const result = await Aur_fac_placementsService.getAll({ orderBy: ['aur_name asc'] })
  return (result.data ?? [])
    .filter((placement) => placement.aur_fac_placementid)
    .map((placement) => ({
      value: placement.aur_fac_placementid,
      label: placement.aur_name ?? 'Untitled Fac Placement',
    }))
}

export async function createFacPlacement(input: FacPlacementSaveInput) {
  const result = await Aur_fac_placementsService.create(
    buildFacPlacementPayload(input) as Omit<Aur_fac_placementsBase, 'aur_fac_placementid'>,
  )
  assertOperationSucceeded(result, 'Fac placement was not created.')
}

export async function updateFacPlacement(id: string, input: FacPlacementSaveInput) {
  const result = await Aur_fac_placementsService.update(id, buildFacPlacementPayload(input))
  assertOperationSucceeded(result, 'Fac placement was not saved.')
}

export async function listFacOffers(): Promise<FacOfferRecord[]> {
  const result = await Aur_fac_offersService.getAll({ orderBy: ['aur_name asc'] })
  return (result.data ?? []).map(mapFacOfferRecord)
}

export async function listFacOfferLookupOptions(): Promise<ReinsuranceLookupOption[]> {
  const result = await Aur_fac_offersService.getAll({ orderBy: ['aur_name asc'] })
  return (result.data ?? [])
    .filter((offer) => offer.aur_fac_offerid)
    .map((offer) => ({
      value: offer.aur_fac_offerid,
      label: offer.aur_name ?? 'Untitled Fac Offer',
    }))
}

export async function createFacOffer(input: FacOfferSaveInput) {
  const result = await Aur_fac_offersService.create(
    buildFacOfferPayload(input) as Omit<Aur_fac_offersBase, 'aur_fac_offerid'>,
  )
  assertOperationSucceeded(result, 'Fac offer was not created.')
}

export async function updateFacOffer(id: string, input: FacOfferSaveInput) {
  const result = await Aur_fac_offersService.update(id, buildFacOfferPayload(input))
  assertOperationSucceeded(result, 'Fac offer was not saved.')
}

export async function listCessions(): Promise<CessionRecord[]> {
  const result = await Aur_cessionsService.getAll({ orderBy: ['aur_name asc'] })
  return (result.data ?? []).map(mapCessionRecord)
}

export async function listCessionLookupOptions(): Promise<ReinsuranceLookupOption[]> {
  const result = await Aur_cessionsService.getAll({ orderBy: ['aur_name asc'] })
  return (result.data ?? [])
    .filter((cession) => cession.aur_cessionid)
    .map((cession) => ({
      value: cession.aur_cessionid,
      label: cession.aur_name ?? 'Untitled Cession',
    }))
}

export async function listPolicyConversionLookupOptions(): Promise<ReinsuranceLookupOption[]> {
  const result = await Aur_policy_conversionsService.getAll({ orderBy: ['createdon desc'] })
  return (result.data ?? [])
    .filter((conversion) => conversion.aur_policy_conversionid)
    .map((conversion) => ({
      value: conversion.aur_policy_conversionid,
      label: conversion.aur_name ?? conversion.aur_conversion_number ?? 'Untitled Policy Conversion',
    }))
}

export async function listPolicyLookupOptions(): Promise<ReinsuranceLookupOption[]> {
  const result = await Aur_policiesService.getAll({ orderBy: ['aur_policy_number asc'] })
  return (result.data ?? [])
    .filter((policy) => policy.aur_policyid)
    .map((policy) => ({
      value: policy.aur_policyid,
      label: policy.aur_policy_number ?? policy.aur_customer_idname ?? 'Untitled Policy',
    }))
}

export async function createCession(input: CessionSaveInput) {
  const result = await Aur_cessionsService.create(buildCessionPayload(input) as Omit<Aur_cessionsBase, 'aur_cessionid'>)
  assertOperationSucceeded(result, 'Cession was not created.')
}

export async function updateCession(id: string, input: CessionSaveInput) {
  const result = await Aur_cessionsService.update(id, buildCessionPayload(input))
  assertOperationSucceeded(result, 'Cession was not saved.')
}

export async function listCessionLines(): Promise<CessionLineRecord[]> {
  const result = await Aur_cession_linesService.getAll({ orderBy: ['aur_name asc'] })
  return (result.data ?? []).map(mapCessionLineRecord)
}

export async function createCessionLine(input: CessionLineSaveInput) {
  const result = await Aur_cession_linesService.create(
    buildCessionLinePayload(input) as Omit<Aur_cession_linesBase, 'aur_cession_lineid'>,
  )
  assertOperationSucceeded(result, 'Cession line was not created.')
}

export async function updateCessionLine(id: string, input: CessionLineSaveInput) {
  const result = await Aur_cession_linesService.update(id, buildCessionLinePayload(input))
  assertOperationSucceeded(result, 'Cession line was not saved.')
}

export async function createReinsurer(input: ReinsurerSaveInput) {
  await Aur_reinsurersService.create(buildReinsurerPayload(input) as Omit<Aur_reinsurersBase, 'aur_reinsurerid'>)
}

export async function updateReinsurer(id: string, input: ReinsurerSaveInput) {
  await Aur_reinsurersService.update(id, buildReinsurerPayload(input))
}

function mapReinsurerRecord(
  record: Aur_reinsurers,
  exposureByReinsurer = new Map<string, { amount: number; lastUpdated: string }>(),
): ReinsurerRecord {
  const fallbackExposure = exposureByReinsurer.get(normalizeDataverseId(record.aur_reinsurerid))
  const currentExposure = record.aur_current_exposure || fallbackExposure?.amount || 0
  return {
    id: record.aur_reinsurerid,
    name: record.aur_name ?? 'Untitled Reinsurer',
    accountId: record.aur_account_idname ?? record._aur_account_id_value ?? '---',
    accountLookupId: record._aur_account_id_value ?? '',
    currentExposure,
    lastUpdated: record.aur_current_exposure_date ?? fallbackExposure?.lastUpdated ?? record.modifiedon ?? record.createdon ?? '',
    maxExposureLimit: record.aur_max_exposure_limit ?? 0,
    isApproved: resolveYesNo(record.aur_is_approved, record.aur_is_approvedname),
    partyType: record.aur_party_typename ?? resolveOptionLabel(Aur_reinsurersaur_party_type, record.aur_party_type) ?? 'Reinsurer',
    ratingAgency:
      record.aur_rating_agencyname ??
      resolveOptionLabel(Aur_reinsurersaur_rating_agency, record.aur_rating_agency) ??
      'Unrated',
    ratingExpiryDate: record.aur_rating_expiry_date ?? '',
    securityRating:
      normalizeSecurityRating(
        record.aur_security_ratingname ??
          resolveOptionLabel(Aur_reinsurersaur_security_rating, record.aur_security_rating),
      ) ?? '---',
    shariahApprovalRef: record.aur_shariah_approval_ref ?? '---',
    shariahCompliant: resolveYesNo(record.aur_shariah_compliant, record.aur_shariah_compliantname),
    country: record.aur_countryname ?? resolveOptionLabel(Aur_reinsurersaur_country, record.aur_country) ?? '---',
  }
}

function buildCurrentExposureByReinsurer(records: Aur_cession_lines[]) {
  const exposureByReinsurer = new Map<string, { amount: number; lastUpdated: string }>()

  records.forEach((record) => {
    const reinsurerId = normalizeDataverseId(record._aur_reinsurer_id_value)
    if (!reinsurerId) return

    const current = exposureByReinsurer.get(reinsurerId) ?? { amount: 0, lastUpdated: '' }
    const lastUpdated = getLatestDateValue(current.lastUpdated, record.modifiedon ?? record.createdon ?? '')
    exposureByReinsurer.set(reinsurerId, {
      amount: current.amount + (record.aur_ceded_sum_insured ?? 0),
      lastUpdated,
    })
  })

  return exposureByReinsurer
}

function buildReinsurerPayload(input: ReinsurerSaveInput): Partial<Omit<Aur_reinsurersBase, 'aur_reinsurerid'>> {
  const accountId = normalizeDataverseId(input.accountLookupId)

  const payload = {
    aur_name: input.name,
    aur_max_exposure_limit: input.maxExposureLimit,
    aur_is_approved: input.isApproved === 'Yes',
    aur_rating_expiry_date: input.ratingExpiryDate || undefined,
    aur_shariah_approval_ref: input.shariahApprovalRef || undefined,
    aur_shariah_compliant: input.shariahCompliant === 'Yes',
    ...(findOptionKey(Aur_reinsurersaur_party_type, input.partyType)
      ? { aur_party_type: findOptionKey(Aur_reinsurersaur_party_type, input.partyType) }
      : {}),
    ...(findOptionKey(Aur_reinsurersaur_rating_agency, input.ratingAgency)
      ? { aur_rating_agency: findOptionKey(Aur_reinsurersaur_rating_agency, input.ratingAgency) }
      : {}),
    ...(findOptionKey(Aur_reinsurersaur_security_rating, input.securityRating)
      ? { aur_security_rating: findOptionKey(Aur_reinsurersaur_security_rating, input.securityRating) }
      : {}),
    ...(findOptionKey(Aur_reinsurersaur_country, input.country)
      ? { aur_country: findOptionKey(Aur_reinsurersaur_country, input.country) }
      : {}),
    ...(accountId ? { 'aur_account_id@odata.bind': `/accounts(${accountId})` } : {}),
  }

  return payload as Partial<Omit<Aur_reinsurersBase, 'aur_reinsurerid'>>
}

function mapTreatyRecord(record: Aur_treaties): TreatyRecord {
  return {
    id: record.aur_treatyid,
    treatyName: record.aur_name ?? 'Untitled Treaty',
    cessionPercentage: record.aur_cession_percentage ?? 0,
    commissionPercentage: record.aur_commission_percentage ?? 0,
    exchangeRate: record.exchangerate ?? 1,
    inceptionDate: record.aur_inception_date ?? '',
    isCedable: resolveYesNo(record.aur_is_cedable, record.aur_is_cedablename),
    ownRetention: record.aur_own_retention ?? null,
    productId: record.aur_product_idname ?? record._aur_product_id_value ?? '---',
    productLookupId: record._aur_product_id_value ?? '',
    profitCommissionPct: record.aur_profit_commission_pct ?? 0,
    shariahBasis:
      record.aur_shariah_basisname ??
      resolveOptionLabel(Aur_treatiesaur_shariah_basis, record.aur_shariah_basis) ??
      'Retakaful',
    surplusSharingPct: record.aur_surplus_sharing_pct ?? 0,
    treatyCapacity: record.aur_treaty_capacity ?? 0,
    treatyType:
      record.aur_treaty_typename ??
      resolveOptionLabel(Aur_treatiesaur_treaty_type, record.aur_treaty_type) ??
      'Surplus',
    treatyYear: record.aur_treaty_year ?? new Date().getFullYear(),
    wakalaFeePercentage: record.aur_wakala_fee_percentage ?? 0,
  }
}

function buildTreatyPayload(input: TreatySaveInput): Partial<Omit<Aur_treatiesBase, 'aur_treatyid'>> {
  const productId = normalizeDataverseId(input.productLookupId)
  const payload = {
    aur_name: input.treatyName,
    aur_cession_percentage: input.cessionPercentage,
    aur_commission_percentage: input.commissionPercentage,
    aur_inception_date: input.inceptionDate || undefined,
    aur_is_cedable: input.isCedable === 'Yes',
    aur_own_retention: input.ownRetention ?? undefined,
    aur_profit_commission_pct: input.profitCommissionPct,
    aur_surplus_sharing_pct: input.surplusSharingPct,
    aur_treaty_capacity: input.treatyCapacity,
    aur_treaty_year: input.treatyYear,
    aur_wakala_fee_percentage: input.wakalaFeePercentage,
    ...(findOptionKey(Aur_treatiesaur_shariah_basis, input.shariahBasis)
      ? { aur_shariah_basis: findOptionKey(Aur_treatiesaur_shariah_basis, input.shariahBasis) }
      : {}),
    ...(findOptionKey(Aur_treatiesaur_treaty_type, input.treatyType)
      ? { aur_treaty_type: findOptionKey(Aur_treatiesaur_treaty_type, input.treatyType) }
      : {}),
    ...(productId ? { 'aur_product_id@odata.bind': `/aur_productses(${productId})` } : {}),
  }

  return payload as Partial<Omit<Aur_treatiesBase, 'aur_treatyid'>>
}

function mapTreatyLayerRecord(record: Aur_treaty_layers): TreatyLayerRecord {
  return {
    id: record.aur_treaty_layerid,
    name: record.aur_name ?? 'Untitled Layer',
    attachmentPoint: record.aur_attachment_point ?? null,
    layerCapacity: record.aur_layer_capacity ?? 0,
    layerLimit: record.aur_layer_limit ?? 0,
    lineNumber: record.aur_line_number ?? 0,
    linesCount: record.aur_lines_count ?? 0,
    treatyId: record.aur_treaty_idname ?? record._aur_treaty_id_value ?? '---',
    treatyLookupId: record._aur_treaty_id_value ?? '',
  }
}

function buildTreatyLayerPayload(input: TreatyLayerSaveInput): Partial<Omit<Aur_treaty_layersBase, 'aur_treaty_layerid'>> {
  const treatyLayerId = normalizeDataverseId(input.treatyLookupId)
  const payload = {
    aur_name: input.name,
    statecode: 0,
    aur_attachment_point: input.attachmentPoint ?? undefined,
    aur_layer_capacity: input.layerCapacity,
    aur_layer_limit: input.layerLimit,
    aur_line_number: input.lineNumber,
    aur_lines_count: input.linesCount,
    ...(treatyLayerId ? { 'aur_treaty_id@odata.bind': `/aur_treaty_layers(${treatyLayerId})` } : {}),
  }

  return payload as Partial<Omit<Aur_treaty_layersBase, 'aur_treaty_layerid'>>
}

async function resolveTreatyLayerUpdateId(id: string) {
  const normalizedId = normalizeDataverseId(id)
  if (!normalizedId) {
    throw new Error('Treaty layer was not saved because the selected record id is invalid.')
  }

  const existing = await Aur_treaty_layersService.get(normalizedId)
  assertOperationSucceeded(existing, 'Treaty layer was not saved because the selected record no longer exists.')
  return normalizedId
}

function mapTreatyParticipationRecord(record: Aur_treaty_participations): TreatyParticipationRecord {
  return {
    id: record.aur_treaty_participationid,
    name: record.aur_name ?? 'Untitled Participation',
    isLeader: resolveYesNo(record.aur_is_leader, record.aur_is_leadername),
    reinsurerId: record.aur_reinsurer_idname ?? record._aur_reinsurer_id_value ?? '---',
    reinsurerLookupId: record._aur_reinsurer_id_value ?? '',
    sharePercentage: record.aur_share_percentage ?? 0,
    treatyId: record.aur_treaty_idname ?? record._aur_treaty_id_value ?? '---',
    treatyLookupId: record._aur_treaty_id_value ?? '',
    treatyLayerId: record.aur_treaty_layer_idname ?? record._aur_treaty_layer_id_value ?? '---',
    treatyLayerLookupId: record._aur_treaty_layer_id_value ?? '',
  }
}

function buildTreatyParticipationPayload(
  input: TreatyParticipationSaveInput,
): Partial<Omit<Aur_treaty_participationsBase, 'aur_treaty_participationid'>> {
  const reinsurerId = normalizeDataverseId(input.reinsurerLookupId)
  const treatyId = normalizeDataverseId(input.treatyLookupId)
  const treatyLayerId = normalizeDataverseId(input.treatyLayerLookupId)
  const payload = {
    aur_name: input.name,
    aur_is_leader: input.isLeader === 'Yes',
    aur_share_percentage: input.sharePercentage,
    ...(reinsurerId ? { 'aur_reinsurer_id@odata.bind': `/aur_reinsurers(${reinsurerId})` } : {}),
    ...(treatyId ? { 'aur_treaty_id@odata.bind': `/aur_treaties(${treatyId})` } : {}),
    ...(treatyLayerId ? { 'aur_treaty_layer_id@odata.bind': `/aur_treaty_layers(${treatyLayerId})` } : {}),
  }

  return payload as Partial<Omit<Aur_treaty_participationsBase, 'aur_treaty_participationid'>>
}

function mapRiCapacityCheckRecord(record: Aur_ri_capacity_checks): RiCapacityCheckRecord {
  return {
    id: record.aur_ri_capacity_checkid,
    name: record.aur_name ?? 'Untitled Capacity Check',
    calculatedOn: formatDatePart(record.aur_calculated_on),
    calculatedTime: formatTimePart(record.aur_calculated_on),
    calculationSource:
      record.aur_calculation_sourcename ??
      resolveOptionLabel(Aur_ri_capacity_checksaur_calculation_source, record.aur_calculation_source) ??
      'AI Extraction',
    excessToPlace: record.aur_excess_to_place ?? null,
    inquiryId: record.aur_inquiry_idname ?? record._aur_inquiry_id_value ?? '---',
    inquiryLookupId: record._aur_inquiry_id_value ?? '',
    isActive: resolveYesNo(record.aur_is_active, record.aur_is_activename),
    outcome:
      normalizeSecurityRating(
        record.aur_outcomename ?? resolveOptionLabel(Aur_ri_capacity_checksaur_outcome, record.aur_outcome),
      ) ?? '---',
    quoteId: record.aur_quote_idname ?? record._aur_quote_id_value ?? '---',
    quoteLookupId: record._aur_quote_id_value ?? '',
    retainedAmount: record.aur_retained_amount ?? 0,
    sumInsured: record.aur_sum_insured ?? 0,
    treatyAbsorbed: record.aur_treaty_absorbed ?? 0,
    treatyId: record.aur_treaty_idname ?? record._aur_treaty_id_value ?? '---',
    treatyLookupId: record._aur_treaty_id_value ?? '',
  }
}

function buildRiCapacityCheckPayload(
  input: RiCapacityCheckSaveInput,
): Partial<Omit<Aur_ri_capacity_checksBase, 'aur_ri_capacity_checkid'>> {
  const inquiryId = normalizeDataverseId(input.inquiryLookupId)
  const quoteId = normalizeDataverseId(input.quoteLookupId)
  const treatyId = normalizeDataverseId(input.treatyLookupId)
  const payload = {
    aur_name: input.name,
    aur_calculated_on: composeDateTime(input.calculatedOn, input.calculatedTime),
    aur_excess_to_place: input.excessToPlace ?? undefined,
    aur_is_active: input.isActive === 'Yes',
    aur_retained_amount: input.retainedAmount,
    aur_sum_insured: input.sumInsured,
    aur_treaty_absorbed: input.treatyAbsorbed,
    ...(findOptionKey(Aur_ri_capacity_checksaur_calculation_source, input.calculationSource)
      ? { aur_calculation_source: findOptionKey(Aur_ri_capacity_checksaur_calculation_source, input.calculationSource) }
      : {}),
    ...(findOptionKey(Aur_ri_capacity_checksaur_outcome, input.outcome)
      ? { aur_outcome: findOptionKey(Aur_ri_capacity_checksaur_outcome, input.outcome) }
      : {}),
    ...(inquiryId ? { 'aur_inquiry_id@odata.bind': `/aur_inquiries(${inquiryId})` } : {}),
    ...(quoteId ? { 'aur_quote_id@odata.bind': `/aur_quotes(${quoteId})` } : {}),
    ...(treatyId ? { 'aur_treaty_id@odata.bind': `/aur_treaties(${treatyId})` } : {}),
  }

  return payload as Partial<Omit<Aur_ri_capacity_checksBase, 'aur_ri_capacity_checkid'>>
}

function mapFacPlacementRecord(record: Aur_fac_placements): FacPlacementRecord {
  return {
    id: record.aur_fac_placementid,
    name: record.aur_name ?? 'Untitled Fac Placement',
    amountToPlace: record.aur_amount_to_place ?? 0,
    brokerId: record.aur_broker_idname ?? record._aur_broker_id_value ?? '---',
    brokerLookupId: record._aur_broker_id_value ?? '',
    brokeragePercentage: record.aur_brokerage_percentage ?? 0,
    capacityCheckId: record.aur_capacity_check_idname ?? record._aur_capacity_check_id_value ?? '---',
    capacityCheckLookupId: record._aur_capacity_check_id_value ?? '',
    quoteId: record.aur_quote_idname ?? record._aur_quote_id_value ?? '---',
    quoteLookupId: record._aur_quote_id_value ?? '',
    riskDescription: record.aur_risk_description ?? '---',
    signedDownFactor: record.aur_signed_down_factor ?? 0,
    subscribedPercentage: record.aur_subscribed_percentage ?? 0,
    subscribedLastUpdated: record.aur_subscribed_percentage_date ?? record.modifiedon ?? record.createdon ?? '',
    targetCloseDate: formatDatePart(record.aur_target_close_date),
  }
}

function buildFacPlacementPayload(input: FacPlacementSaveInput): Partial<Omit<Aur_fac_placementsBase, 'aur_fac_placementid'>> {
  const brokerId = normalizeDataverseId(input.brokerLookupId)
  const capacityCheckId = normalizeDataverseId(input.capacityCheckLookupId)
  const quoteId = normalizeDataverseId(input.quoteLookupId)
  const payload = {
    aur_name: input.name,
    aur_amount_to_place: input.amountToPlace,
    aur_brokerage_percentage: input.brokeragePercentage,
    aur_risk_description: input.riskDescription || undefined,
    aur_signed_down_factor: input.signedDownFactor,
    aur_target_close_date: input.targetCloseDate || undefined,
    ...(brokerId ? { 'aur_broker_id@odata.bind': `/aur_reinsurers(${brokerId})` } : {}),
    ...(capacityCheckId ? { 'aur_capacity_check_id@odata.bind': `/aur_ri_capacity_checks(${capacityCheckId})` } : {}),
    ...(quoteId ? { 'aur_quote_id@odata.bind': `/aur_quotes(${quoteId})` } : {}),
  }

  return payload as Partial<Omit<Aur_fac_placementsBase, 'aur_fac_placementid'>>
}

function mapFacOfferRecord(record: Aur_fac_offers): FacOfferRecord {
  return {
    id: record.aur_fac_offerid,
    name: record.aur_name ?? 'Untitled Fac Offer',
    isLeader: resolveYesNo(record.aur_is_leader, record.aur_is_leadername),
    offeredSharePercentage: record.aur_offered_share_percentage ?? 0,
    placementId: record.aur_placement_idname ?? record._aur_placement_id_value ?? '---',
    placementLookupId: record._aur_placement_id_value ?? '',
    quotedRate: record.aur_quoted_rate ?? 0,
    reinsurerId: record.aur_reinsurer_idname ?? record._aur_reinsurer_id_value ?? '---',
    reinsurerLookupId: record._aur_reinsurer_id_value ?? '',
    responseDate: formatDatePart(record.aur_response_date),
    signedLinePercentage: record.aur_signed_line_percentage ?? 0,
    termsAndConditions: record.aur_terms_and_conditions ?? '---',
    writtenLinePercentage: record.aur_written_line_percentage ?? 0,
    statusReason: record.statuscodename ?? resolveOptionLabel(Aur_fac_offersstatuscode, record.statuscode) ?? 'Not Approached',
  }
}

function buildFacOfferPayload(input: FacOfferSaveInput): Partial<Omit<Aur_fac_offersBase, 'aur_fac_offerid'>> {
  const placementId = normalizeDataverseId(input.placementLookupId)
  const reinsurerId = normalizeDataverseId(input.reinsurerLookupId)
  const payload = {
    aur_name: input.name,
    aur_is_leader: input.isLeader === 'Yes',
    aur_offered_share_percentage: input.offeredSharePercentage,
    aur_quoted_rate: input.quotedRate,
    aur_response_date: input.responseDate || undefined,
    aur_signed_line_percentage: input.signedLinePercentage,
    aur_terms_and_conditions: input.termsAndConditions || undefined,
    aur_written_line_percentage: input.writtenLinePercentage,
    ...(findOptionKey(Aur_fac_offersstatuscode, input.statusReason)
      ? { statuscode: findOptionKey(Aur_fac_offersstatuscode, input.statusReason) }
      : {}),
    ...(placementId ? { 'aur_placement_id@odata.bind': `/aur_fac_placements(${placementId})` } : {}),
    ...(reinsurerId ? { 'aur_reinsurer_id@odata.bind': `/aur_reinsurers(${reinsurerId})` } : {}),
  }

  return payload as Partial<Omit<Aur_fac_offersBase, 'aur_fac_offerid'>>
}

function mapCessionRecord(record: Aur_cessions): CessionRecord {
  return {
    id: record.aur_cessionid,
    name: record.aur_name ?? 'Untitled Cession',
    adjuststCessionId: record.aur_adjustst_cession_idname ?? record._aur_adjustst_cession_id_value ?? '---',
    adjuststCessionLookupId: record._aur_adjustst_cession_id_value ?? '',
    cededSumInsured: record.aur_ceded_sum_insured ?? 0,
    cessionBasis:
      record.aur_cession_basisname ??
      resolveOptionLabel(Aur_cessionsaur_cession_basis, record.aur_cession_basis) ??
      'Treaty',
    commissionAmount: record.aur_commission_amount ?? 0,
    effectiveDate: formatDatePart(record.aur_effective_date),
    grossSumInsured: record.aur_gross_sum_insured ?? 0,
    isAdjustment: resolveYesNo(record.aur_is_adjustment, record.aur_is_adjustmentname),
    netPayableToReinsurers: record.aur_net_payable_to_reinsurers ?? 0,
    policyConversionId: record.aur_policy_conversion_idname ?? record._aur_policy_conversion_id_value ?? '---',
    policyConversionLookupId: record._aur_policy_conversion_id_value ?? '',
    policyId: record.aur_policy_idname ?? record._aur_policy_id_value ?? '---',
    policyLookupId: record._aur_policy_id_value ?? '',
    retainedSumInsured: record.aur_retained_sum_insured ?? 0,
    transactionType:
      record.aur_transaction_typename ??
      resolveOptionLabel(Aur_cessionsaur_transaction_type, record.aur_transaction_type) ??
      'New',
    statusReason: record.statuscodename ?? resolveOptionLabel(Aur_cessionsstatuscode, record.statuscode) ?? 'Draft',
  }
}

function buildCessionPayload(input: CessionSaveInput): Partial<Omit<Aur_cessionsBase, 'aur_cessionid'>> {
  const adjuststCessionId = normalizeDataverseId(input.adjuststCessionLookupId)
  const policyConversionId = normalizeDataverseId(input.policyConversionLookupId)
  const policyId = normalizeDataverseId(input.policyLookupId)
  const payload = {
    aur_name: input.name,
    aur_ceded_sum_insured: input.cededSumInsured,
    aur_commission_amount: input.commissionAmount,
    aur_effective_date: input.effectiveDate || undefined,
    aur_gross_sum_insured: input.grossSumInsured,
    aur_is_adjustment: input.isAdjustment === 'Yes',
    aur_net_payable_to_reinsurers: input.netPayableToReinsurers,
    aur_retained_sum_insured: input.retainedSumInsured,
    ...(findOptionKey(Aur_cessionsaur_cession_basis, input.cessionBasis)
      ? { aur_cession_basis: findOptionKey(Aur_cessionsaur_cession_basis, input.cessionBasis) }
      : {}),
    ...(findOptionKey(Aur_cessionsaur_transaction_type, input.transactionType)
      ? { aur_transaction_type: findOptionKey(Aur_cessionsaur_transaction_type, input.transactionType) }
      : {}),
    ...(findOptionKey(Aur_cessionsstatuscode, input.statusReason)
      ? { statuscode: findOptionKey(Aur_cessionsstatuscode, input.statusReason) }
      : {}),
    ...(adjuststCessionId ? { 'aur_adjustst_cession_id@odata.bind': `/aur_cessions(${adjuststCessionId})` } : {}),
    ...(policyConversionId ? { 'aur_policy_conversion_id@odata.bind': `/aur_policy_conversions(${policyConversionId})` } : {}),
    ...(policyId ? { 'aur_policy_id@odata.bind': `/aur_policies(${policyId})` } : {}),
  }

  return payload as Partial<Omit<Aur_cessionsBase, 'aur_cessionid'>>
}

function mapCessionLineRecord(record: Aur_cession_lines): CessionLineRecord {
  return {
    id: record.aur_cession_lineid,
    name: record.aur_name ?? 'Untitled Cession Line',
    cededPremium: record.aur_ceded_premium ?? 0,
    cededSumInsured: record.aur_ceded_sum_insured ?? 0,
    cessionBasis:
      record.aur_cession_basisname ??
      resolveOptionLabel(Aur_cession_linesaur_cession_basis, record.aur_cession_basis) ??
      'Treaty',
    cessionId: record.aur_cession_idname ?? record._aur_cession_id_value ?? '---',
    cessionLookupId: record._aur_cession_id_value ?? '',
    commissionPercentage: record.aur_commission_percentage ?? 0,
    facOfferId: record.aur_fac_offer_idname ?? record._aur_fac_offer_id_value ?? '---',
    facOfferLookupId: record._aur_fac_offer_id_value ?? '',
    netDue: record.aur_net_due ?? 0,
    reinsurerId: record.aur_reinsurer_idname ?? record._aur_reinsurer_id_value ?? '---',
    reinsurerLookupId: record._aur_reinsurer_id_value ?? '',
    sharePercentage: record.aur_share_percentage ?? 0,
    treatyId: record.aur_treaty_idname ?? record._aur_treaty_id_value ?? '---',
    treatyLookupId: record._aur_treaty_id_value ?? '',
  }
}

function buildCessionLinePayload(input: CessionLineSaveInput): Partial<Omit<Aur_cession_linesBase, 'aur_cession_lineid'>> {
  const cessionId = normalizeDataverseId(input.cessionLookupId)
  const facOfferId = normalizeDataverseId(input.facOfferLookupId)
  const reinsurerId = normalizeDataverseId(input.reinsurerLookupId)
  const treatyId = normalizeDataverseId(input.treatyLookupId)
  const payload = {
    aur_name: input.name,
    aur_ceded_premium: input.cededPremium,
    aur_ceded_sum_insured: input.cededSumInsured,
    aur_commission_percentage: input.commissionPercentage,
    aur_net_due: input.netDue,
    aur_share_percentage: input.sharePercentage,
    ...(findOptionKey(Aur_cession_linesaur_cession_basis, input.cessionBasis)
      ? { aur_cession_basis: findOptionKey(Aur_cession_linesaur_cession_basis, input.cessionBasis) }
      : {}),
    ...(cessionId ? { 'aur_cession_id@odata.bind': `/aur_cessions(${cessionId})` } : {}),
    ...(facOfferId ? { 'aur_fac_offer_id@odata.bind': `/aur_fac_offers(${facOfferId})` } : {}),
    ...(reinsurerId ? { 'aur_reinsurer_id@odata.bind': `/aur_reinsurers(${reinsurerId})` } : {}),
    ...(treatyId ? { 'aur_treaty_id@odata.bind': `/aur_treaties(${treatyId})` } : {}),
  }

  return payload as Partial<Omit<Aur_cession_linesBase, 'aur_cession_lineid'>>
}

function assertOperationSucceeded(result: unknown, fallbackMessage: string) {
  const record = result as Record<string, unknown>
  const success = record?.success ?? record?.succeeded ?? record?.isSuccess
  const ok = record?.ok
  if (success === false || ok === false) {
    const message = getOperationErrorMessage(record)
    throw new Error(message || `${fallbackMessage} ${serializeOperationResult(record)}`)
  }
  const error = record?.error ?? record?.errors ?? record?.exception
  if (error) {
    if (error instanceof Error) throw error
    const message = getOperationErrorMessage(record)
    throw new Error(message || `${fallbackMessage} ${serializeOperationResult(record)}`)
  }
}

function getOperationErrorMessage(record: Record<string, unknown>) {
  const error = record.error as Record<string, unknown> | Error | string | undefined
  if (typeof record.message === 'string') return record.message
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (!error || typeof error !== 'object') return ''
  if (typeof error.message === 'string') return error.message
  if (typeof error.error === 'string') return error.error

  const nestedError = error.error as Record<string, unknown> | undefined
  if (nestedError && typeof nestedError.message === 'string') return nestedError.message

  const response = error.response as Record<string, unknown> | undefined
  const responseData = response?.data as Record<string, unknown> | undefined
  if (responseData && typeof responseData.message === 'string') return responseData.message

  return ''
}

function serializeOperationResult(record: Record<string, unknown>) {
  try {
    return JSON.stringify(record, (_key, value) => {
      if (value instanceof Error) {
        return { name: value.name, message: value.message, stack: value.stack }
      }
      return value
    })
  } catch {
    return ''
  }
}

function resolveYesNo(value?: boolean, label?: string | null): 'Yes' | 'No' {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return label?.toLowerCase() === 'yes' ? 'Yes' : 'No'
}

function resolveOptionLabel(source: Record<number, string>, value?: number) {
  if (!value) return undefined
  return normalizeSecurityRating(source[value])
}

function findOptionKey(source: Record<number, string>, label?: string) {
  const normalizedLabel = normalizeSecurityRating(label)
  if (!normalizedLabel || normalizedLabel === 'Select' || normalizedLabel === '---') return undefined
  const entry = Object.entries(source).find(([, value]) => normalizeSecurityRating(value) === normalizedLabel)
  return entry ? Number(entry[0]) : undefined
}

function normalizeSecurityRating(value?: string | null) {
  return value?.replace(/[^\x20-\x7E]+/g, '...').replace(/\s+/g, ' ').trim()
}

function normalizeDataverseId(value?: string) {
  const normalized = value?.replace(/[{}]/g, '').trim() ?? ''
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized
    : ''
}

function getLatestDateValue(current: string, next: string) {
  if (!current) return next
  if (!next) return current
  const currentTime = new Date(current).getTime()
  const nextTime = new Date(next).getTime()
  if (Number.isNaN(currentTime)) return next
  if (Number.isNaN(nextTime)) return current
  return nextTime > currentTime ? next : current
}

function formatDatePart(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function formatTimePart(value?: string) {
  if (!value) return 'Select'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Select'
  const hour = date.getHours()
  const minute = date.getMinutes() < 30 ? '00' : '30'
  const period = hour < 12 ? 'AM' : 'PM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour}:${minute} ${period}`
}

function composeDateTime(dateValue: string, timeValue: string) {
  if (!dateValue) return undefined
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return undefined
  const match = /^(\d{1,2}):(\d{2})\s(AM|PM)$/i.exec(timeValue)
  if (match) {
    let hour = Number(match[1])
    const minute = Number(match[2])
    const period = match[3].toUpperCase()
    if (period === 'PM' && hour !== 12) hour += 12
    if (period === 'AM' && hour === 12) hour = 0
    date.setHours(hour, minute, 0, 0)
  }
  return date.toISOString()
}
