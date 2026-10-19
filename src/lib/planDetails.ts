function comparisonText(value: string) {
  return value.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '').toLowerCase()
}

function removeRepeatedDescription(value: string) {
  const parts = value.split(/\s+[\u2013\u2014-]\s+/).map((part) => part.trim())
  if (parts.length > 1 && parts.every((part) => comparisonText(part) === comparisonText(parts[0]))) {
    return parts[0]
  }
  return value
}

export function parsePlanDetails(value: string) {
  const sections: Array<{ title: string; items: string[] }> = []
  let current: (typeof sections)[number] | undefined

  for (const line of value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
    if (line.endsWith(':')) {
      const title = line.slice(0, -1)
      current = sections.find((section) => comparisonText(section.title) === comparisonText(title))
      if (!current) {
        current = { title, items: [] }
        sections.push(current)
      }
      continue
    }
    if (!current) {
      current = { title: 'Plan Details', items: [] }
      sections.push(current)
    }
    const item = removeRepeatedDescription(line)
    if (!current.items.some((existing) => comparisonText(existing) === comparisonText(item))) {
      current.items.push(item)
    }
  }
  return sections.filter((section) => section.items.length)
}
