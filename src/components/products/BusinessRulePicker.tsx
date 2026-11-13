import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { searchBusinessRules, type SearchableBusinessRule } from '../../lib/businessRuleSearch'
import { Input } from '../ui/Input'

interface Props {
  label: string
  source: string
  kind: 'response' | 'evidence'
  rules: SearchableBusinessRule[]
  onChange: (source: string) => void
}

export function BusinessRulePicker({ label, source, kind, rules, onChange }: Props) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const selected = source.slice(source.indexOf(':') + 1)
  const byId = source.startsWith('responseId:') || source.startsWith('evidenceId:')
  const selectedRule = byId ? rules.find((rule) => rule.id.toLowerCase() === selected.toLowerCase())
    : rules.find((rule) => rule.name.trim().toLowerCase() === selected.trim().toLowerCase())
  const selectedName = selectedRule?.name ?? (byId && selected ? `Rule ID ${selected}` : selected)
  const results = searchBusinessRules(rules, query)
  const trimmedQuery = query.trim()
  const hasExactResult = rules.some((rule) => rule.name.trim().toLowerCase() === trimmedQuery.toLowerCase())
  const showCustom = !!trimmedQuery && !hasExactResult
  const choiceCount = results.length + Number(showCustom)

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  const chooseRule = (rule: SearchableBusinessRule) => {
    onChange(`${kind}Id:${rule.id}`)
    setOpen(false)
    setQuery('')
    triggerRef.current?.focus()
  }
  const chooseCustom = () => {
    if (!trimmedQuery) return
    onChange(`${kind}:${trimmedQuery}`)
    setOpen(false)
    setQuery('')
    triggerRef.current?.focus()
  }

  return <div ref={rootRef} className="relative min-w-0 flex-1">
    <button
      ref={triggerRef}
      type="button"
      aria-label={`${label} business rule`}
      aria-haspopup="dialog"
      aria-expanded={open}
      className="form-field-surface flex min-h-12 w-full items-center gap-3 rounded-xl border border-border px-3 py-2 text-left text-sm outline-none transition hover:border-primary/50 focus:border-primary focus:ring-4 focus:ring-primary/10"
      onClick={() => { setOpen((value) => !value); setQuery(''); setActiveIndex(0) }}
    >
      <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        {selectedName ? <span className="block break-words leading-5">{selectedName}</span>
          : <span className="text-muted-foreground">Search business rules...</span>}
      </span>
      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
    {open && <div role="dialog" aria-label={`${label} business rules`} className="absolute left-0 top-full z-50 mt-2 w-full min-w-[min(100vw-2rem,20rem)] rounded-2xl border border-border bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.18)] dark:bg-[#0f172a]">
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          role="combobox"
          aria-label="Search business rules"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded="true"
          aria-activedescendant={choiceCount ? `${listId}-${Math.min(activeIndex, choiceCount - 1)}` : undefined}
          value={query}
          placeholder="Search by any words in the rule name"
          className="pl-9"
          onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); event.preventDefault() }
            else if (event.key === 'ArrowDown' && choiceCount) { setActiveIndex((index) => (index + 1) % choiceCount); event.preventDefault() }
            else if (event.key === 'ArrowUp' && choiceCount) { setActiveIndex((index) => (index - 1 + choiceCount) % choiceCount); event.preventDefault() }
            else if (event.key === 'Enter' && choiceCount) {
              if (activeIndex < results.length) chooseRule(results[activeIndex])
              else chooseCustom()
              event.preventDefault()
            }
          }}
        />
      </div>
      <div id={listId} role="listbox" aria-label="Matching business rules" className="mt-2 max-h-72 overflow-y-auto">
        {!trimmedQuery && <p className="px-3 py-4 text-sm text-muted-foreground">Type a few words to search {rules.length} business rules.</p>}
        {!!trimmedQuery && !choiceCount && <p className="px-3 py-4 text-sm text-muted-foreground">No matching rules found.</p>}
        {results.map((rule, index) => <button
          id={`${listId}-${index}`}
          key={rule.id}
          type="button"
          role="option"
          aria-selected={activeIndex === index}
          className={`flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm leading-5 ${activeIndex === index ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-surface-soft'}`}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => chooseRule(rule)}
        >
          <span className="min-w-0 flex-1 break-words">{rule.name}</span>
          {selectedRule?.id === rule.id && <Check aria-label="Selected" className="h-4 w-4 shrink-0" />}
        </button>)}
        {showCustom && <button
          id={`${listId}-${results.length}`}
          type="button"
          role="option"
          aria-selected={activeIndex === results.length}
          className={`w-full rounded-xl border-t border-border-soft px-3 py-2.5 text-left text-sm leading-5 ${activeIndex === results.length ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-surface-soft'}`}
          onMouseEnter={() => setActiveIndex(results.length)}
          onClick={chooseCustom}
        >Use “{trimmedQuery}” as a custom rule name</button>}
      </div>
      {results.length === 8 && <p className="px-3 pt-2 text-xs text-muted-foreground">Showing the first 8 matches. Add more words to narrow the list.</p>}
    </div>}
  </div>
}
