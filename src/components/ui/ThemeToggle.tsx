import { MoonStar, SunMedium } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import { cn } from '../../lib/cn'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <div role="group" aria-label="Color theme" className="inline-flex h-9 shrink-0 items-center gap-0.5 rounded-[9px] border border-border-soft bg-surface-muted/50 p-0.5 dark:border-white/10 dark:bg-white/5">
      {(['light', 'dark'] as const).map((mode) => {
        const Icon = mode === 'light' ? SunMedium : MoonStar
        return (
          <button
            key={mode}
            type="button"
            aria-label={mode === 'light' ? 'Use light mode' : 'Use dark mode'}
            aria-pressed={theme === mode}
            onClick={() => { if (theme !== mode) toggleTheme() }}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md outline-none transition focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none',
              theme === mode
                ? 'bg-white text-primary shadow-sm dark:bg-surface-soft dark:text-primary-light'
                : 'text-muted-foreground hover:bg-white/60 hover:text-foreground dark:hover:bg-white/10',
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
          </button>
        )
      })}
    </div>
  )
}
