import { useState } from 'react'
import { Input } from './Input'
import { formatAmount } from '../../lib/formatters'

export function AmountInput({ value, onValueChange, suffix, maximumFractionDigits = 20 }: { value: string; onValueChange: (value: string) => void; suffix?: string; maximumFractionDigits?: number }) {
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
    {suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span> : null}
    </div>
  )
}
