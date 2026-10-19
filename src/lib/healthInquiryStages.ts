export const HEALTH_INQUIRY_STEPS = [
  { status: 751820006, label: 'Inquiry Created', description: 'The inquiry has been received and recorded.' },
  { status: 751820017, label: 'ICP Verification', description: 'The inquiry is at ICP verification.' },
  { status: 751820018, label: 'DOH Review', description: 'The inquiry is at DOH review.' },
  { status: 751820019, label: 'KYC Info Required', description: 'Additional KYC information is required.' },
  { status: 751820001, label: 'AI Processing', description: 'The submitted information is being processed by AI.' },
  { status: 751820009, label: 'Awaiting Review', description: 'The inquiry is ready for underwriting review.' },
] as const

export function healthInquiryStepIndex(status?: number | null) {
  const stageStatus = status === 751820020 || status === 751820007
    ? 751820006
    : status === 751820008
      ? 751820001
      : status === 751820016
        ? 751820009
        : status
  return HEALTH_INQUIRY_STEPS.findIndex((step) => step.status === stageStatus)
}
