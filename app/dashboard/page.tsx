import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { PrimaryButton } from '@/components/ui/primary-button'
import { PageHeader } from '@/components/ui/page-header'

export default function Dashboard() {
  return (
    <DashboardPage 
      title="Dashboard" 
      subtitle="Operational overview. Is the system healthy right now?"
      titleSize="lg"
    >

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="font-label text-sm text-brand/70 mb-2">Videos Rendered</p>
            <p className="text-3xl font-serif font-normal text-brand">1,247</p>
            <p className="font-label text-xs text-brand/50 mt-1">of 5,000 monthly</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="font-label text-sm text-brand/70 mb-2">Active Jobs</p>
            <p className="text-3xl font-serif font-normal text-brand">8</p>
            <p className="font-label text-xs text-brand/50 mt-1">12 in queue</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="font-label text-sm text-brand/70 mb-2">Avg Cost/Video</p>
            <p className="text-3xl font-serif font-normal text-brand">$0.42</p>
            <p className="font-label text-xs text-brand/50 mt-1">Avg time: 2.3 min</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="font-label text-sm text-brand/70 mb-2">Failure Alerts</p>
            <p className="text-3xl font-serif font-normal text-brand">3</p>
            <p className="font-label text-xs text-brand/50 mt-1">Anchor issues, drift</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Queue Status & Failure Alerts */}
          <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm">
            <PageHeader title="Queue Status & Failure Alerts" spacing="md" />
            <div className="space-y-4">
              <div className="flex items-start gap-4 pb-4 border-b border-brand/10">
                <div className="w-2 h-2 rounded-full bg-red-500 mt-2"></div>
                <div className="flex-1">
                  <p className="font-label text-sm font-medium text-brand">
                    Anchor drift detected
                  </p>
                  <p className="font-label text-xs text-brand/70 mt-1">
                    Identity "John Doe" showing 12% variance - review required
                  </p>
                  <p className="font-label text-xs text-brand/50 mt-1">
                    15 minutes ago
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 pb-4 border-b border-brand/10">
                <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2"></div>
                <div className="flex-1">
                  <p className="font-label text-sm font-medium text-brand">
                    Generation retry failed
                  </p>
                  <p className="font-label text-xs text-brand/70 mt-1">
                    Job #1247 failed after 3 retries - anchor issue
                  </p>
                  <p className="font-label text-xs text-brand/50 mt-1">
                    1 hour ago
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 pb-4 border-b border-brand/10">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                <div className="flex-1">
                  <p className="font-label text-sm font-medium text-brand">
                    Queue processing normally
                  </p>
                  <p className="font-label text-xs text-brand/70 mt-1">
                    8 active jobs, 12 queued - all systems operational
                  </p>
                  <p className="font-label text-xs text-brand/50 mt-1">
                    Just now
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <PageHeader title="Quick Actions" spacing="md" />
            <div className="space-y-3">
              <PrimaryButton className="w-full rounded-md px-4 py-3 text-left">
                Resume Queue
              </PrimaryButton>
              <button className="w-full rounded-md border border-brand px-4 py-3 text-sm font-medium text-brand font-label text-left">
                Pause Model
              </button>
              <button className="w-full rounded-md border border-brand px-4 py-3 text-sm font-medium text-brand font-label text-left">
                Review Failures
              </button>
            </div>
          </div>
        </div>
    </DashboardPage>
  )
}

