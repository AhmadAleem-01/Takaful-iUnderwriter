import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, Shield } from 'lucide-react'
import { APP_ROUTES } from '../../lib/constants'
import { cn } from '../../lib/cn'
import { useRole } from '../../hooks/useRole'

const GROUP_ORDER = [
  'Main',
  'Leads Management',
  'Policy Management',
  'Product Management',
  'Reinsurance',
  'Administration',
]

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { hasAccess, user } = useRole()
  const location = useLocation()
  const groupEntries = useMemo(() => {
    const grouped = APP_ROUTES.filter((route) => !route.disabled || hasAccess(route.bucket)).reduce<
      Record<string, typeof APP_ROUTES>
    >((accumulator, route) => {
      if (route.bucket && !hasAccess(route.bucket)) return accumulator
      accumulator[route.group] ??= []
      accumulator[route.group].push(route)
      return accumulator
    }, {})

    return Object.entries(grouped).sort(([left], [right]) => {
      const leftIndex = GROUP_ORDER.indexOf(left)
      const rightIndex = GROUP_ORDER.indexOf(right)
      if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right)
      if (leftIndex === -1) return 1
      if (rightIndex === -1) return -1
      return leftIndex - rightIndex
    })
  }, [hasAccess])
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setExpandedGroups((current) => {
      const next = { ...current }
      groupEntries.forEach(([group, routes], index) => {
        const hasActiveRoute = routes.some((route) => isRouteActive(location.pathname, location.search, route.path))
        if (next[group] === undefined) next[group] = index < 3 || hasActiveRoute
        if (hasActiveRoute) next[group] = true
      })
      return next
    })
  }, [groupEntries, location.pathname, location.search])

  return (
    <aside className={cn('hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:flex-col lg:border-r lg:border-[#19324C] lg:bg-[#071827] lg:text-white transition-[width] duration-300 motion-reduce:transition-none', collapsed ? 'lg:w-[80px]' : 'lg:w-[280px]')}>
      <button type="button" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={cn('border-b border-white/10 py-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary', collapsed ? 'px-[18px]' : 'px-5')}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-primary text-white shadow-[0_12px_24px_rgba(40,108,255,0.2)]">
            <Shield className="h-5 w-5" />
          </div>
          <div className={cn('min-w-0', collapsed && 'hidden')}>
            <h2 className="truncate text-[20px] font-bold leading-none tracking-[-0.03em]">InsureAI</h2>
            <p className="mt-1 truncate text-[11px] font-medium text-slate-400">Executive Insurance Platform</p>
          </div>
        </div>
      </button>

      <nav aria-label="Main navigation" className={cn('scrollbar-hidden flex-1 overflow-y-auto py-4', collapsed ? 'px-3' : 'px-4')}>
        <div className="space-y-4">
          {groupEntries.map(([group, routes]) => {
            const isExpanded = expandedGroups[group] ?? false
            const activeCount = routes.filter((route) => isRouteActive(location.pathname, location.search, route.path)).length
            return (
              <div key={group} className="space-y-1.5">
                <button
                  type="button"
                  className={cn(
                    'group flex w-full items-center justify-between gap-3 rounded-[12px] px-2 py-1.5 text-left transition duration-200',
                    collapsed && 'hidden',
                    isExpanded ? 'text-slate-200' : 'text-slate-500 hover:text-slate-300',
                  )}
                  onClick={() => setExpandedGroups((current) => ({ ...current, [group]: !isExpanded }))}
                  aria-expanded={isExpanded}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        'block truncate text-[10px] font-bold uppercase tracking-[0.18em] transition',
                        activeCount || isExpanded ? 'text-slate-300' : 'text-slate-500',
                      )}
                    >
                      {group}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold transition',
                        activeCount
                          ? 'bg-primary/15 text-primary-light'
                          : 'bg-white/[0.045] text-slate-500',
                      )}
                    >
                      {routes.length}
                    </span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-500 transition group-hover:bg-white/5 group-hover:text-slate-300">
                      <ChevronDown className={cn('h-3.5 w-3.5 transition duration-200', isExpanded && 'rotate-180')} />
                    </span>
                  </span>
                </button>

                <div
                  className={cn(
                    'grid transition-all duration-300 ease-out',
                    collapsed || isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                  )}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="space-y-1 pt-1">
                      {routes.map((route) => {
                        const active = isRouteActive(location.pathname, location.search, route.path)
                        return (
                          <NavLink
                            key={route.path}
                            to={route.path}
                            title={collapsed ? route.label : undefined}
                            aria-label={collapsed ? route.label : undefined}
                            className={cn(
                              'group relative flex h-10 items-center gap-3 rounded-[14px] border px-2.5 text-[13px] font-semibold transition duration-200',
                              active
                                ? 'border-primary/30 bg-primary text-white shadow-[0_10px_24px_rgba(40,108,255,0.22)]'
                                : 'border-transparent text-slate-400 hover:bg-white/[0.06] hover:text-white',
                              route.disabled && 'opacity-55',
                              collapsed && 'justify-center px-0',
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-[11px] transition duration-200',
                                active
                                  ? 'bg-white/16 text-white'
                                  : 'bg-white/[0.045] text-slate-400 group-hover:bg-white/10 group-hover:text-white',
                              )}
                            >
                              <route.icon className="h-[15px] w-[15px] text-current" />
                            </span>
                            <span className={cn('min-w-0 truncate', collapsed && 'hidden')}>{route.label}</span>
                          </NavLink>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </nav>

      <div className={cn('border-t border-white/10 py-4', collapsed ? 'px-3' : 'px-4')}>
        <div title={collapsed ? `${user.name} - ${user.roleLabel}` : undefined} className={cn('rounded-[16px] border border-white/10 bg-white/[0.055]', collapsed ? 'p-1.5' : 'p-3')}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-primary text-sm font-bold text-white">
              {user.initials}
            </div>
            <div className={cn('min-w-0', collapsed && 'hidden')}>
              <p className="truncate text-[13px] font-bold">{user.name}</p>
              <p className="truncate text-[12px] text-slate-400">{user.roleLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

function isRouteActive(pathname: string, search: string, target: string) {
  const [targetPath, targetQuery = ''] = target.split('?')
  if (pathname !== targetPath && !pathname.startsWith(`${targetPath}/`)) return false
  const current = search.startsWith('?') ? search.slice(1) : search
  return targetQuery ? current === targetQuery : true
}
