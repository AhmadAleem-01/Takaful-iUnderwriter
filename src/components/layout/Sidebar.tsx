import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
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
  const { hasAccess } = useRole()
  const location = useLocation()
  const [logoFailed, setLogoFailed] = useState(false)
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
    <aside className={cn('hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:flex-col lg:border-r lg:border-white/10 lg:bg-[#194F90] dark:lg:bg-[#071827] lg:text-white transition-[width] duration-300 motion-reduce:transition-none', collapsed ? 'lg:w-[80px]' : 'lg:w-[280px]')}>
      <button type="button" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={cn('shrink-0 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80', collapsed ? 'px-5' : 'px-3')}>
        <div className={cn('flex items-center justify-center rounded-[12px]', collapsed ? 'h-10 w-10 p-1.5' : 'h-12 w-full py-1')}>
          {logoFailed ? <span className="text-sm font-bold text-white">{collapsed ? 'T' : 'Takaful'}</span> : <img
            src="/takaful-logo.png"
            alt="Abu Dhabi National Takaful"
            className="max-h-full max-w-full object-contain"
            onError={() => setLogoFailed(true)}
          />}
        </div>
      </button>

      <nav aria-label="Main navigation" className={cn('sidebar-scrollbar min-h-0 flex-1 overflow-y-auto pb-6 pt-1', collapsed ? 'px-3' : 'px-4')}>
        <div className="space-y-3">
          {groupEntries.map(([group, routes]) => {
            const isExpanded = expandedGroups[group] ?? false
            const activeCount = routes.filter((route) => isRouteActive(location.pathname, location.search, route.path)).length
            return (
              <div key={group} className="space-y-1.5">
                <button
                  type="button"
                  className={cn(
                    'group flex w-full items-center justify-between gap-3 rounded-[12px] px-2 py-1.5 text-left outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-white/80 motion-reduce:transition-none',
                    collapsed && 'hidden',
                    isExpanded ? 'text-[#B8CFEA] dark:text-[#94A3B8]' : 'text-[#B8CFEA] hover:text-white dark:text-[#94A3B8] dark:hover:text-white',
                  )}
                  onClick={() => setExpandedGroups((current) => ({ ...current, [group]: !isExpanded }))}
                  aria-expanded={isExpanded}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        'block truncate text-[12px] font-medium uppercase tracking-normal transition',
                        'text-[#B8CFEA] dark:text-[#94A3B8]',
                      )}
                    >
                      {group}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium transition',
                        activeCount
                          ? 'bg-white/15 text-white'
                          : 'bg-white/10 text-[#C2D6F0] dark:text-[#B8C7DB]',
                      )}
                    >
                      {routes.length}
                    </span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg text-[#B8CFEA] transition group-hover:bg-white/10 group-hover:text-white dark:text-[#94A3B8] dark:group-hover:text-white">
                      <ChevronDown className={cn('h-3.5 w-3.5 transition duration-200', isExpanded && 'rotate-180')} />
                    </span>
                  </span>
                </button>

                <div
                  className={cn(
                    'grid transition-all duration-300 ease-out motion-reduce:transition-none',
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
                              'group relative flex h-[40px] items-center gap-3 rounded-[9px] border px-3 text-[12px] font-medium outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#194F90] dark:focus-visible:ring-offset-[#071827] motion-reduce:transition-none',
                              active
                                ? 'border-white bg-white text-[#1855A0] dark:border-[#286CFF] dark:bg-[#286CFF] dark:text-white'
                                : 'border-transparent text-[#C2D6F0] hover:bg-white/10 hover:text-white dark:text-[#B8C7DB] dark:hover:text-white',
                              route.disabled && 'opacity-55',
                              collapsed && 'justify-center px-0',
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-6 w-6 shrink-0 items-center justify-center transition duration-200',
                                active
                                  ? 'text-[#1855A0] dark:text-white'
                                  : 'text-[#C2D6F0] group-hover:text-white dark:text-[#B8C7DB] dark:group-hover:text-white',
                              )}
                            >
                              <route.icon className="h-[19px] w-[19px] text-current" />
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


    </aside>
  )
}

function isRouteActive(pathname: string, search: string, target: string) {
  const [targetPath, targetQuery = ''] = target.split('?')
  if (pathname !== targetPath && !pathname.startsWith(`${targetPath}/`)) return false
  const current = search.startsWith('?') ? search.slice(1) : search
  return targetQuery ? current === targetQuery : true
}
