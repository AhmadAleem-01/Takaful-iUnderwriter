import { parseTemplateFieldTable, type TemplateFieldTable, type TemplateTableSchema } from '../lib/emailTemplateFields'

// Load connected table schemas only when the editor's field browser opens.
// No customer records or extra Dataverse permissions are needed to browse fields.
const schemas = import.meta.glob<TemplateTableSchema>('../../.power/schemas/dataverse/*.Schema.json', { import: 'default' })
let cachedTables: Promise<TemplateFieldTable[]> | undefined

export function getEmailTemplateFieldTables(): Promise<TemplateFieldTable[]> {
  cachedTables ??= Promise.all(Object.values(schemas).map((load) => load()))
    .then((sources) => sources.map(parseTemplateFieldTable)
      .filter((table): table is TemplateFieldTable => table !== null)
      .sort((a, b) => a.label.localeCompare(b.label)))
    .catch((error) => {
      cachedTables = undefined
      throw error
    })
  return cachedTables
}
