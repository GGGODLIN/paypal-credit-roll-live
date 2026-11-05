import { InboxIcon } from './ui/icons';

// Shown in place of Studio when the sandbox account has nothing to report on.
export function EmptyData() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-full border border-cr-hairline-strong bg-cr-graphite text-cr-splice">
        <InboxIcon className="size-7" />
      </span>
      <h2 className="mt-4 font-display text-[26px] text-cr-bone">No PayPal data yet</h2>
      <p className="mt-2 max-w-md text-[14px] leading-relaxed text-cr-smoke">
        This sandbox account has no invoices, products, plans or transactions. Create some in the PayPal sandbox, then
        refresh to build reports from them.
      </p>
      <a
        href="https://developer.paypal.com/dashboard/"
        target="_blank"
        rel="noreferrer"
        className="mt-6 inline-flex h-10 items-center rounded-[4px] bg-cr-bone px-5 font-semibold text-cr-void hover:bg-white"
      >
        Open PayPal Developer Dashboard
      </a>
    </div>
  );
}
