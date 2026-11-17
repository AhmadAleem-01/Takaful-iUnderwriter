import { BriefcaseBusiness, Check, ChevronDown, ChevronRight, CircleUserRound, RefreshCw, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { topbarPageLabel } from '../../lib/topbarPageLabel'
import { ThemeToggle } from '../ui/ThemeToggle'
import { Button } from '../ui/Button'
import { ROLE_LABELS, ROLE_OPTIONS } from '../../lib/constants'
import { useRole } from '../../hooks/useRole'
import { usePageRefreshAction } from '../../hooks/usePageRefresh'

const ROLE_DESCRIPTIONS = {
  underwriter: 'Review inquiries and underwriting responses',
  seniorUnderwriter: 'Oversee escalations, risk review, and product checks',
  administrator: 'Manage the full insurance workspace and admin catalog',
} as const

export function TopHeader() {
  const { user, role, setRole } = useRole()
  const refreshPage = usePageRefreshAction()
  const location = useLocation()
  const pageLabel = topbarPageLabel(location.pathname, location.search)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <header className="sticky top-0 z-40 border-b border-border-soft bg-white dark:border-white/10 dark:bg-surface">
      <div className="flex min-h-[63px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 lg:px-6">
        <nav aria-label="Breadcrumb" className="min-w-0 max-w-full flex-1 basis-[240px]">
          <ol className="flex min-w-0 items-center gap-2 text-[13px] sm:gap-3">
            <li className="shrink-0">
              <Link to="/" className="flex items-center gap-2 rounded-md text-muted-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary">
                <ShieldCheck aria-hidden="true" className="h-[18px] w-[18px]" />
                <span>Insure AI</span>
              </Link>
            </li>
            <li aria-hidden="true" className="shrink-0 text-muted-foreground/70"><ChevronRight className="h-3.5 w-3.5" /></li>
            <li aria-current="page" title={pageLabel} className="min-w-0 truncate font-medium text-foreground">{pageLabel}</li>
          </ol>
        </nav>
        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh current page"
            onClick={refreshPage}
            className="h-9 w-9 shrink-0 rounded-[9px] border border-border-soft bg-surface-muted/50 text-muted-foreground hover:bg-surface-muted dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <ThemeToggle />
          <div ref={menuRef} className="relative min-w-0 border-l border-border-soft pl-3 sm:pl-4 dark:border-white/10">
            <button
              ref={triggerRef}
              type="button"
              aria-expanded={open}
              aria-controls={open ? 'topbar-user-options' : undefined}
              aria-label={user.name + ', ' + ROLE_LABELS[role] + ', change role'}
              onClick={() => setOpen((current) => !current)}
              className="flex max-w-full items-center gap-2 rounded-lg py-0.5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
            >
              <div aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-soft bg-primary/10 text-[13px] font-medium text-primary ring-2 ring-white ring-offset-1 ring-offset-border-soft dark:border-white/10 dark:text-primary-light dark:ring-surface dark:ring-offset-white/10">
                {user.initials}
              </div>
              <div className="min-w-0 max-w-[110px] sm:max-w-[180px]" title={user.name + ' - ' + ROLE_LABELS[role]}>
                <p className="truncate text-[13px] font-medium">{user.name}</p>
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{ROLE_LABELS[role]}</p>
              </div>
              <ChevronDown aria-hidden="true" className={'h-3.5 w-3.5 shrink-0 text-muted-foreground transition motion-reduce:transition-none ' + (open ? 'rotate-180' : '')} />
            </button>

            {open ? (
              <div id="topbar-user-options" className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[256px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[10px] border border-border bg-surface p-1.5 text-foreground shadow-lg dark:border-white/10 dark:bg-[#1E293B] dark:text-[#F1F5F9]">
                <div className="mb-1 rounded-lg bg-surface-muted p-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                      {user.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold">{user.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{ROLE_LABELS[role]}</p>
                    </div>
                  </div>
                </div>

                <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">Current Role</div>
                <div className="max-h-[320px] overflow-y-auto">
                  {ROLE_OPTIONS.map((option) => {
                    const active = option === role
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setRole(option)
                          setOpen(false)
                          triggerRef.current?.focus()
                        }}
                        className={`mb-1 flex w-full items-start gap-2 rounded-lg p-2 text-left text-[12px] outline-none transition focus-visible:ring-2 focus-visible:ring-primary ${
                          active
                            ? 'bg-primary/10 text-primary dark:bg-[#286CFF]/25 dark:text-white'
                            : 'text-foreground hover:bg-surface-muted dark:hover:bg-white/5'
                        }`}
                      >
                        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                          active
                            ? 'border-primary/15 bg-white/70 dark:border-[#4F98FF]/50 dark:bg-[#286CFF]/30'
                            : 'border-border-soft bg-white dark:border-white/10 dark:bg-[#243244]'
                        }`}>
                          <CircleUserRound className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-semibold leading-tight">{ROLE_LABELS[option]}</p>
                          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground dark:text-slate-300">
                            {ROLE_DESCRIPTIONS[option]}
                          </p>
                        </div>
                        {active ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}
                      </button>
                    )
                  })}
                </div>

                <div className="-mx-1 my-1 h-px bg-border dark:bg-white/10" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[12px] outline-none transition hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-white/5"
                >
                  <BriefcaseBusiness className="h-4 w-4" />
                  Manage Profile
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
