'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { CreditRollWordmark } from '../../credit-roll-wordmark';
import { BellIcon, HelpIcon } from './ui/icons';
import { AgStudioLogo } from './ui/logo';

// The app frame: a projection-booth bar across the top, the report bins down the left and the
// editing desk in the middle. Shared by the dashboard, its loading skeleton and its error page.

function BrandLockup() {
  return (
    <div className="flex items-center gap-4">
      <Link href="/" className="cr-focus rounded-sm" aria-label="CreditRoll Live dossier (home)">
        <CreditRollWordmark />
      </Link>
      <span className="h-6 w-px bg-cr-hairline-strong" aria-hidden />
      <span className="flex items-center gap-2 text-cr-smoke">
        <AgStudioLogo className="-my-2 h-10 w-auto text-cr-bone" />
        <span aria-hidden className="text-xs">×</span>
        <span className="text-[13px] font-bold italic tracking-tight">
          <span className="text-cr-bone">Pay</span>
          <span className="text-[#41b3ef]">Pal</span>
        </span>
        <span className="cr-label text-[8.5px] text-cr-ash">Sandbox</span>
      </span>
    </div>
  );
}

function TopBar() {
  return (
    <header className="relative flex h-14 shrink-0 items-center gap-6 border-b border-black bg-[linear-gradient(180deg,#171512,#0e0d0b)] px-5 shadow-[inset_0_-1px_0_var(--cr-hairline)]">
      <BrandLockup />
      <div className="ml-auto flex items-center gap-1 text-cr-smoke">
        <Link
          href="/"
          className="cr-label cr-focus mr-3 rounded-sm px-1 py-1 text-[9px] text-cr-smoke transition-colors hover:text-cr-splice"
        >
          ← Dossier
        </Link>
        <span className="inline-flex size-9 items-center justify-center rounded-full" title="Help">
          <HelpIcon />
        </span>
        <span className="inline-flex size-9 items-center justify-center rounded-full" title="Notifications">
          <BellIcon />
        </span>
        <span className="ml-2 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full border border-cr-splice/50 bg-cr-graphite font-display text-[13px] italic text-cr-splice">
            EP
          </span>
          <span className="hidden text-[13px] font-semibold text-cr-bone sm:inline">Executive producer</span>
        </span>
      </div>
    </header>
  );
}

export function AppShell({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col bg-cr-soot font-grotesk text-cr-bone">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <nav
          className="flex w-60 shrink-0 flex-col border-r border-black bg-[#0c0b09] shadow-[inset_-1px_0_0_var(--cr-hairline)]"
          aria-label="Reports"
        >
          {sidebar}
        </nav>
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
