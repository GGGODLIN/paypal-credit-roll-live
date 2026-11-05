import { AppShell } from './app-shell';

// Placeholder for the dashboard while PayPal data loads (./loading.tsx) and while saved
// reports are read from this browser.

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[4px] bg-cr-graphite ${className}`} />;
}

export function SidebarSkeleton() {
  return (
    <div className="space-y-3 p-4 pt-6">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-10 rounded-full" />
      {['w-28', 'w-32', 'w-36', 'w-24'].map((width) => (
        <Skeleton key={width} className={`ml-10 h-7 rounded-full ${width}`} />
      ))}
      <Skeleton className="h-10 rounded-full" />
    </div>
  );
}

export function ContentSkeleton() {
  return (
    <>
      <div className="border-b border-black bg-[#121110] px-8 pb-4 pt-5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-2 h-8 w-56" />
        <Skeleton className="mt-3 h-3 w-48" />
      </div>
      <div className="grid flex-1 grid-cols-4 grid-rows-[112px_1fr_1fr] gap-4 p-4" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-[6px] border border-cr-hairline bg-cr-carbon p-5">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="mt-4 h-3 w-16" />
          </div>
        ))}
        <div className="col-span-2 rounded-[6px] border border-cr-hairline bg-cr-carbon p-5">
          <Skeleton className="h-full" />
        </div>
        <div className="col-span-2 rounded-[6px] border border-cr-hairline bg-cr-carbon p-5">
          <Skeleton className="h-full" />
        </div>
        <div className="col-span-4 rounded-[6px] border border-cr-hairline bg-cr-carbon p-5">
          <Skeleton className="h-full" />
        </div>
      </div>
      <p className="sr-only" role="status">
        Threading the reel: loading PayPal data…
      </p>
    </>
  );
}

export function DashboardSkeleton() {
  return (
    <AppShell sidebar={<SidebarSkeleton />}>
      <ContentSkeleton />
    </AppShell>
  );
}
