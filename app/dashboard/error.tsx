'use client';

import { useEffect } from 'react';
import { AlertIcon } from './components/ui/icons';
import { AppShell } from './components/app-shell';
import { SidebarSkeleton } from './components/skeleton';
import { Button } from './components/ui/ui';

// Shown when the PayPal API can't be reached, or rejects the request, while loading the page.
export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <AppShell sidebar={<SidebarSkeleton />}>
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-lg rounded-[6px] border border-cr-hairline-strong bg-cr-carbon p-8 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full border border-cr-grease/40 bg-cr-grease/10 text-cr-grease">
            <AlertIcon className="size-7" />
          </span>
          <h1 className="mt-4 font-display text-[28px] leading-tight text-cr-bone">We couldn&apos;t load your PayPal data</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-cr-smoke">
            The PayPal sandbox didn&apos;t respond as expected. Check the API credentials in{' '}
            <code className="rounded bg-cr-soot px-1 text-cr-bone">.env.local</code> and try again.
          </p>
          {error.message && (
            <p className="mt-4 break-words rounded-[4px] bg-cr-soot px-4 py-3 text-left font-mono text-xs text-cr-smoke">
              {error.message}
              {error.digest && <span className="block pt-1">Reference: {error.digest}</span>}
            </p>
          )}
          <Button variant="primary" className="mt-6" onClick={retry}>
            Try again
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
