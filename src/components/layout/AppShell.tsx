import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { TopHeader } from './TopHeader'
import { ScrollToTop } from '../system/ScrollToTop'

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  return (
    <div className="min-h-screen bg-background text-foreground">
      <ScrollToTop />
      <div className="min-h-screen">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((current) => !current)} />
        <div className={`flex min-h-screen min-w-0 flex-1 flex-col transition-[padding] duration-300 motion-reduce:transition-none ${sidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'}`}>
          <TopHeader />
          <main className="flex-1 p-4 lg:p-6">
            <div className="space-y-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
