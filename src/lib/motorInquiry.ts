export function parseMotorCustomerData(value?: string) {
  if (!value?.trim()) return null
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

export const motorDriverFields = [
  ['Full name', 'Full name'], ['Age range', 'Age range'],
  ['Email address', 'Email address'], ['Mobile number', 'Mobile number'],
  ['Nationality', 'Nationality'], ['Licence experience', 'License age'],
  ['Claims history', 'Claims history'],
] as const

export const motorVehicleFields = [
  ['Condition', 'Vehicle condition'], ['Model year', 'Model year'],
  ['Make', 'Vehicle make'], ['Model', 'Vehicle model'],
  ['Body type', 'Body type'], ['Engine', 'Engine details'],
  ['Vehicle use', 'Vehicle use'], ['First registration', 'First registration'],
  ['Specification', 'Vehicle specification'],
] as const

export function motorAnswer(data: Record<string, unknown> | null, property: string, driver = false) {
  const details = data?.['Driver details']
  const nested = details && typeof details === 'object' && !Array.isArray(details)
    ? details as Record<string, unknown> : undefined
  const value = driver && property !== 'License age' && property !== 'Claims history'
    ? nested?.[property] : data?.[property]
  return typeof value === 'string' || typeof value === 'number' ? String(value) : 'Not provided'
}
