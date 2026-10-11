// These quote columns are Dataverse IntegerType, not decimal or currency columns.
export function quoteWholeNumber(value: number, label: string) {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a valid number.`)
  const rounded = Math.round(value)
  if (rounded < -2147483648 || rounded > 2147483647) throw new Error(`${label} exceeds the supported whole-number range.`)
  return rounded
}
