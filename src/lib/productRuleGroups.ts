export const RULE_GROUPS = ['Mandatory Field', 'Required Document', 'Inclusion', 'Exclusion', 'Conditional'] as const
export type RuleGroup = (typeof RULE_GROUPS)[number]

export function categorizeRule(name: string, context: string, description: string): RuleGroup {
  const content = [name, context, description].join(' ').toLowerCase()
  if (content.includes('required document') || content.includes('required docs') || content.includes('document')) return 'Required Document'
  if (content.includes('inclusion') || content.includes('include') || content.includes('cover')) return 'Inclusion'
  if (content.includes('exclusion') || content.includes('exclude') || content.includes('not cover')) return 'Exclusion'
  if (content.includes('mandatory') || content.includes('required') || content.includes('must')) return 'Mandatory Field'
  return 'Conditional'
}
