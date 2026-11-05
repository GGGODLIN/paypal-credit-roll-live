'use client';

import { useEffect, useEffectEvent, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

// Building blocks for the cutting-room shell: hardware-style keys, a modal dialog and a small
// popover menu. Styling only; behaviour stays in the callers.

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-cr-bone text-cr-void shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_2px_0_rgba(0,0,0,0.5)] hover:bg-white disabled:bg-cr-graphite disabled:text-cr-ash disabled:shadow-none',
  secondary:
    'border border-cr-hairline-strong bg-cr-graphite text-cr-bone hover:border-cr-smoke disabled:border-cr-hairline disabled:text-cr-ash',
  ghost: 'text-cr-splice hover:bg-cr-splice/10 disabled:text-cr-ash',
  danger: 'bg-cr-grease text-cr-void hover:brightness-110',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  const sizing = size === 'sm' ? 'h-8 px-3.5 text-[13px]' : 'h-10 px-5 text-[14px]';
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-[4px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cr-splice disabled:cursor-not-allowed ${sizing} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function IconButton({ label, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-[4px] text-cr-bone transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-cr-splice disabled:cursor-not-allowed disabled:text-cr-ash disabled:hover:bg-transparent ${className}`}
      {...props}
    />
  );
}

export function Dialog({
  open,
  title,
  children,
  actions,
  onClose,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  actions: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Callers pass a new onClose each render; this keeps the backdrop listener from re-attaching.
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // A click whose target is the <dialog> itself landed on the backdrop. This is a pointer-only
    // shortcut: keyboard users close with Esc, which the native dialog turns into its close event.
    const onBackdropClick = (event: MouseEvent) => {
      if (event.target === dialog) close();
    };
    dialog.addEventListener('click', onBackdropClick);
    return () => dialog.removeEventListener('click', onBackdropClick);
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-[6px] border border-cr-hairline-strong bg-cr-carbon p-0 font-grotesk text-cr-bone shadow-[0_30px_80px_rgba(0,0,0,0.7)] backdrop:bg-black/70 backdrop:backdrop-blur-[2px]"
    >
      {open && (
        <div className="p-6">
          <h2 id={titleId} className="font-display text-[24px] leading-tight text-cr-bone">
            {title}
          </h2>
          <div className="mt-3 text-[14px] leading-relaxed text-cr-smoke">{children}</div>
          <div className="mt-6 flex flex-wrap justify-end gap-3">{actions}</div>
        </div>
      )}
    </dialog>
  );
}

export function Menu({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Callers pass a new onClose each render; this keeps the listeners below from re-attaching.
  const close = useEffectEvent(onClose);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      ref={ref}
      role="menu"
      className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-[4px] border border-cr-hairline-strong bg-cr-graphite py-1 shadow-[0_12px_30px_rgba(0,0,0,0.6)]"
    >
      {children}
    </div>
  );
}

export function MenuItem({ danger, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`block w-full px-4 py-2 text-left text-[13px] hover:bg-white/5 ${danger ? 'text-cr-grease' : 'text-cr-bone'}`}
      {...props}
    />
  );
}
