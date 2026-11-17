import { useSyncExternalStore, type ComponentPropsWithoutRef } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Calculator, Car, ClipboardList, FolderOpen, HeartPulse, History, Mail, ReceiptText, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '../ui/Tabs'

const DESKTOP_QUERY = '(min-width: 1024px)'

function desktopSnapshot() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP_QUERY).matches
}

function subscribeDesktop(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {}
  const media = window.matchMedia(DESKTOP_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

type InquiryWorkspaceTabsProps = Omit<ComponentPropsWithoutRef<typeof Tabs>, 'orientation'> & {
  isMotorInsurance: boolean
  isHealthInsurance: boolean
  showQuotes: boolean
}

export function InquiryWorkspaceTabs({ children, isMotorInsurance, isHealthInsurance, showQuotes, ...props }: InquiryWorkspaceTabsProps) {
  const desktop = useSyncExternalStore(subscribeDesktop, desktopSnapshot, () => false)
  const tabs = [
    { value: 'details', label: 'Details', icon: ClipboardList },
    { value: 'coverages', label: 'Coverages', icon: ShieldCheck },
    ...(isMotorInsurance || isHealthInsurance ? [{ value: 'product-info', label: isMotorInsurance ? 'Driver & Vehicle' : 'Health Information', icon: isMotorInsurance ? Car : HeartPulse }] : []),
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'actions', label: 'Actions', icon: ShieldAlert },
    ...(showQuotes ? [{ value: 'quotes', label: 'Quotes', icon: ReceiptText }] : []),
    { value: 'ri-capacity', label: 'RI Capacity Checks', icon: Calculator },
    { value: 'documents', label: 'Documents', icon: FolderOpen },
    { value: 'history', label: 'History', icon: History },
  ]

  return (
    <Tabs {...props} orientation={desktop ? 'vertical' : 'horizontal'}>
      <div className="min-w-0 lg:fixed lg:bottom-6 lg:right-4 lg:top-[88px] lg:z-30 lg:flex lg:w-14 lg:items-center">
        <Tooltip.Provider delayDuration={200} skipDelayDuration={100}>
          <TabsList aria-label="Inquiry sections" className="scrollbar-sleek flex-nowrap justify-start gap-1.5 overflow-x-auto rounded-xl bg-white p-1.5 lg:max-h-full lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto dark:bg-surface">
            {tabs.map(({ value, label, icon: Icon }) => (
              <Tooltip.Root key={value}>
                <Tooltip.Trigger asChild>
                  <TabsTrigger value={value} aria-label={label} icon={Icon} className="h-10 min-h-10 w-10 flex-none gap-0 rounded-lg px-0 py-0 text-muted-foreground outline-none hover:bg-primary/[0.06] hover:text-primary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary aria-selected:bg-primary aria-selected:text-white aria-selected:hover:bg-primary aria-selected:hover:text-white dark:aria-selected:hover:bg-primary dark:aria-selected:hover:text-white motion-reduce:transition-none dark:hover:bg-white/10 dark:hover:text-white [&>span]:sr-only [&_svg]:h-[18px] [&_svg]:w-[18px]">
                    {label}
                  </TabsTrigger>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content side={desktop ? 'left' : 'top'} sideOffset={10} collisionPadding={12} className="z-[60] max-w-[240px] rounded-lg border border-white/10 bg-[#142D4C] px-3 py-2 font-sans text-[12px] font-normal leading-5 text-white shadow-lg">
                    {label}
                    <Tooltip.Arrow className="fill-[#142D4C]" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            ))}
          </TabsList>
        </Tooltip.Provider>
      </div>
      {children}
    </Tabs>
  )
}
