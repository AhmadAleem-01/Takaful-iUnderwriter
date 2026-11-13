export interface SearchableBusinessRule { id: string; name: string }

const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en').trim()

export function searchBusinessRules<T extends SearchableBusinessRule>(rules: T[], query: string, limit = 8): T[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  if (!terms.length) return []
  return rules
    .map((rule) => {
      const name = normalize(rule.name)
      if (!terms.every((term) => name.includes(term))) return null
      const phrase = terms.join(' ')
      const score = name === phrase ? 0 : name.startsWith(phrase) ? 1 : name.split(/[^a-z0-9]+/).some((word) => word.startsWith(terms[0])) ? 2 : 3
      return { rule, score }
    })
    .filter((item): item is { rule: T; score: number } => item !== null)
    .sort((left, right) => left.score - right.score || left.rule.name.localeCompare(right.rule.name))
    .slice(0, limit)
    .map(({ rule }) => rule)
}
