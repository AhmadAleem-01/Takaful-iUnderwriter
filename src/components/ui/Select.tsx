import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Children, isValidElement, type ReactElement, type ReactNode, type SelectHTMLAttributes } from 'react'

export interface SelectOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  value?: string
  onValueChange?: (value: string) => void
  onChange?: (event: { target: { value: string } }) => void
  options?: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  contentClassName?: string
  children?: ReactNode
}

export function Select({
  value,
  onValueChange,
  onChange,
  options,
  placeholder = 'Select',
  disabled = false,
  className,
  contentClassName,
  children,
  id,
  title,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: SelectProps) {
  const derivedOptions =
    options ??
    Children.toArray(children)
      .filter((child): child is ReactElement<{ value?: string; children?: ReactNode; disabled?: boolean }> => isValidElement(child))
      .map((child) => ({
        value: String(child.props.value ?? ''),
        label: child.props.children,
        disabled: Boolean(child.props.disabled),
      }))

  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(nextValue) => {
        onValueChange?.(nextValue)
        onChange?.({ target: { value: nextValue } })
      }}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        title={title}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={cn(
          'form-field-surface flex h-12 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-foreground shadow-sm outline-none ring-offset-white transition placeholder:text-[#94A3B8] focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-[#94A3B8] dark:border-white/10 dark:text-[#F1F5F9]',
          className,
        )}
      >
        {/* Radix Value strips className/style; size its actual parent instead. */}
        <span className="min-w-0 flex-1 truncate text-left [&>span]:block">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          data-codex-select-content="true"
          position="popper"
          sideOffset={8}
          className={cn(
            'z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_50px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-[#0f172a]',
            contentClassName,
          )}
        >
          <SelectPrimitive.Viewport className="max-h-72 p-0.5">
            {derivedOptions.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground outline-none transition focus:bg-primary/8 focus:text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-40 dark:text-[#F1F5F9] dark:focus:bg-white/8"
              >
                <SelectPrimitive.ItemIndicator>
                  <Check className="h-4 w-4 text-primary" />
                </SelectPrimitive.ItemIndicator>
                <span className="min-w-0 flex-1 truncate [&>span]:block">
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                </span>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
