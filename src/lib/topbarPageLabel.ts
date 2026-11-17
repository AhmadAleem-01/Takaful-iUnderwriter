import { APP_ROUTES } from './constants'

const ADDITIONAL_SECTIONS = [
  { path: '/admin/plans', label: 'Plans' },
  { path: '/admin/benefits', label: 'Benefits' },
  { path: '/admin/inclusions', label: 'Inclusions' },
  { path: '/admin/exclusions', label: 'Exclusions' },
  { path: '/admin/warranties', label: 'Warranties' },
  { path: '/admin/deductibles', label: 'Deductibles' },
  { path: '/admin/brokers', label: 'Brokers' },
  { path: '/policies', label: 'Policies' },
  { path: '/access-denied', label: 'Access Denied' },
]

export function topbarPageLabel(pathname: string, search = ''): string {
  const currentQuery = new URLSearchParams(search)
  const candidates = [...APP_ROUTES, ...ADDITIONAL_SECTIONS]
    .filter(({ path }) => {
      const [base, query] = path.split('?')
      if (pathname !== base && (base === '/' || !pathname.startsWith(base + '/'))) return false
      return !query || (pathname === base && [...new URLSearchParams(query)].every(
        ([key, value]) => currentQuery.get(key) === value,
      ))
    })
    .sort((left, right) => right.path.length - left.path.length)

  return candidates[0]?.label ?? 'Insure AI'
}
