import { BriefcaseBusiness, Check, ChevronDown, CircleUserRound, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  return (
    <header className="sticky top-0 z-40 border-b border-border-soft bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(248,250,252,0.88)_100%)] backdrop-blur-xl dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.92)_0%,rgba(15,23,42,0.9)_100%)]">
      <div className="flex min-h-[76px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Insurance Platform
          </p>
          <h1 className="text-[17px] font-semibold tracking-[-0.02em] lg:text-[20px]">
            Executive operations workspace
          </h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 self-end lg:self-auto">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh current page"
            onClick={refreshPage}
            className="border border-border-soft bg-white text-foreground shadow-soft hover:bg-surface-muted dark:border-white/10 dark:bg-surface dark:text-foreground dark:hover:bg-surface-soft"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <ThemeToggle />
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              className="flex items-center gap-3 rounded-[18px] border border-border-soft bg-surface px-3 py-2 shadow-soft transition hover:border-primary/20 hover:shadow-[0_10px_26px_rgba(15,23,42,0.08)] dark:hover:shadow-[0_14px_30px_rgba(2,6,23,0.28)]"
            >
              <div className="text-right">
                <p className="text-[13px] font-semibold">{user.name}</p>
                <p className="text-[12px] text-muted-foreground">{ROLE_LABELS[role]}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                {user.initials}
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? 'rotate-180' : ''}`} />
            </button>

            {open ? (
              <div className="absolute right-0 top-[calc(100%+0.85rem)] z-50 w-[280px] overflow-hidden rounded-2xl border border-border bg-surface p-2 text-foreground shadow-lg dark:border-white/10 dark:bg-[#1E293B] dark:text-[#F1F5F9]">
                <div className="mb-1 rounded-xl bg-surface-muted p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                      {user.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
                    </div>
                  </div>
                </div>

                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Current Role</div>
                <div className="max-h-[320px] overflow-y-auto pr-1">
                  {ROLE_OPTIONS.map((option) => {
                    const active = option === role
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setRole(option)
                          setOpen(false)
                        }}
                        className={`mb-1 flex w-full items-start gap-2 rounded-xl p-3 text-left text-sm transition ${
                          active
                            ? 'bg-primary/10 text-primary dark:bg-[#286CFF]/25 dark:text-white'
                            : 'text-foreground hover:bg-surface-muted dark:hover:bg-white/5'
                        }`}
                      >
                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                          active
                            ? 'border-primary/15 bg-white/70 dark:border-[#4F98FF]/50 dark:bg-[#286CFF]/30'
                            : 'border-border-soft bg-white dark:border-white/10 dark:bg-[#243244]'
                        }`}>
                          <CircleUserRound className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-tight">{ROLE_LABELS[option]}</p>
                          <p className="mt-1 text-xs leading-tight text-muted-foreground dark:text-slate-300">
                            {ROLE_DESCRIPTIONS[option]}
                          </p>
                        </div>
                        {active ? <Check className="mt-1 h-4 w-4 shrink-0" /> : null}
                      </button>
                    )
                  })}
                </div>

                <div className="-mx-1 my-1 h-px bg-border dark:bg-white/10" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-sm transition hover:bg-surface-muted dark:hover:bg-white/5"
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
