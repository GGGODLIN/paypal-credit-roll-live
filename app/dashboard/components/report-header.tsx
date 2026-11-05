'use client';

import { useSyncExternalStore, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { EditIcon, EyeIcon, RedoIcon, RefreshIcon, UndoIcon } from './ui/icons';
import { Button, IconButton } from './ui/ui';

// The bar above Studio: which report and page you're on, how fresh the data is, and the
// Edit / Save / Discard controls.
export function ReportHeader({
  reportName,
  pageTitle,
  asOf,
  editing,
  pageIsEmpty,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onDiscard,
  onEditingChange,
}: {
  reportName: string;
  pageTitle?: string;
  asOf: string;
  editing: boolean;
  pageIsEmpty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onEditingChange: (editing: boolean) => void;
}) {
  return (
    <div className="relative flex shrink-0 flex-wrap items-end gap-x-6 gap-y-3 border-b border-black bg-[linear-gradient(180deg,#15130f,#0f0e0c)] px-8 pb-3 pt-3.5 shadow-[inset_0_-1px_0_var(--cr-hairline)]">
      {/* Clapperboard stripes: the header is the slate for whichever report is on the desk. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] bg-[repeating-linear-gradient(135deg,var(--cr-bone)_0_9px,var(--cr-void)_9px_18px)] opacity-50"
      />
      <div className="min-w-0 flex-1">
        <p className="cr-label truncate text-[9.5px] text-cr-ash">
          Report <span className="text-cr-smoke">{reportName}</span>
        </p>
        <h1 className="mt-1 truncate font-display text-[30px] leading-none text-cr-bone">{pageTitle}</h1>
        <DataFreshness asOf={asOf} />
      </div>
      <div className="flex items-center gap-2">
        {editing && pageIsEmpty && (
          <p className="mr-2 text-[13px] text-cr-smoke">
            Drag a widget from <span className="font-semibold text-cr-bone">Compose</span> to get started.
          </p>
        )}
        {editing && (
          <>
            <IconButton label="Undo" disabled={!canUndo} onClick={onUndo}>
              <UndoIcon />
            </IconButton>
            <IconButton label="Redo" disabled={!canRedo} onClick={onRedo}>
              <RedoIcon />
            </IconButton>
            <span className="mx-2 h-6 w-px bg-cr-hairline-strong" aria-hidden />
            <Button onClick={onDiscard} size="sm">
              Discard
            </Button>
            <Button variant="primary" size="sm" onClick={onSave}>
              Save
            </Button>
          </>
        )}
        {editing ? (
          <Button variant="ghost" size="sm" onClick={() => onEditingChange(false)}>
            <EyeIcon className="size-4" /> View
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => onEditingChange(true)}>
            <EditIcon className="size-4" /> Edit
          </Button>
        )}
      </div>
    </div>
  );
}

// --- Data freshness -----------------------------------------------------------------

const MINUTE_MS = 60_000;
let now = 0;
const subscribeNow = (listener: () => void) => {
  now = Date.now();
  const id = setInterval(() => {
    now = Date.now();
    listener();
  }, 30_000);
  return () => clearInterval(id);
};

// asOf is an ISO-8601 UTC string from the server. Slicing it, rather than formatting it with the
// viewer's locale and timezone, gives the same text wherever the header renders.
const utcStamp = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
const utcClock = (iso: string) => `${iso.slice(11, 16)} UTC`;

function relativeTime(iso: string, at: number) {
  const minutes = Math.floor((at - Date.parse(iso)) / MINUTE_MS);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h ago` : iso.slice(0, 10);
}

function DataFreshness({ asOf }: { asOf: string }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const at = useSyncExternalStore(subscribeNow, () => now, () => 0);

  return (
    <p className="mt-1.5 flex items-center gap-2 text-[12.5px] text-cr-smoke">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-cr-paid shadow-[0_0_6px_var(--cr-paid)]" aria-hidden />
        PayPal sandbox
      </span>
      <span aria-hidden className="text-cr-ash">·</span>
      <span title={utcStamp(asOf)} className="font-mono text-[11.5px]">
        {refreshing ? 'Refreshing…' : `Updated ${at ? relativeTime(asOf, at) : utcClock(asOf)}`}
      </span>
      <button
        type="button"
        onClick={() => startRefresh(() => router.refresh())}
        disabled={refreshing}
        aria-label="Refresh data"
        title="Refresh data"
        className="inline-flex size-7 items-center justify-center rounded-full text-cr-splice hover:bg-cr-splice/10 disabled:text-cr-ash"
      >
        <RefreshIcon className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
      </button>
    </p>
  );
}
