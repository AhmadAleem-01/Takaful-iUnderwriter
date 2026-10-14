import { useState } from 'react'
import { Input } from './Input'
import { formatAmount } from '../../lib/formatters'

export function AmountInput({ value, onValueChange, suffix, suffixPlacement = 'end', maximumFractionDigits = 20 }: { value: string; onValueChange: (value: string) => void; suffix?: string; suffixPlacement?: 'end' | 'after-value'; maximumFractionDigits?: number }) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="relative">
    <Input
      type="text"
      inputMode="decimal"
      className={suffix ? 'pr-9' : undefined}
      value={focused ? value : formatAmount(value, maximumFractionDigits)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(event) => {
        const nextValue = event.target.value.replace(/,/g, '')
        if (/^-?\d*(?:\.\d*)?$/.test(nextValue)) onValueChange(nextValue)
      }}
    />
    {suffix ? suffixPlacement === 'after-value' ? (
      <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 whitespace-pre text-sm">
        <span className="text-transparent">{focused ? value : formatAmount(value, maximumFractionDigits)}</span><span className="text-muted-foreground">{suffix}</span>
      </span>
    ) : <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span> : null}
    </div>
  )
}
