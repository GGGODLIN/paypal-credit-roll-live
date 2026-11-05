import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatUsdCents } from '@/lib/format-usd';
import { CreditRollWordmark } from './credit-roll-wordmark';
import { buildDossier, type CutPresence, type Dossier, type DossierRow, type RollCredit } from './dossier';

// One page per PayPal endpoint the demo calls, each in app/(endpoints).
const endpoints = [
  { href: '/products', reel: 'R1', label: 'Catalog products', detail: 'GET /v1/catalogs/products' },
  { href: '/plans', reel: 'R2', label: 'Billing plans', detail: 'GET /v1/billing/plans' },
  { href: '/invoices', reel: 'R3', label: 'Invoices', detail: 'GET /v2/invoicing/invoices' },
  { href: '/transactions', reel: 'R4', label: 'Transactions', detail: 'GET /v1/reporting/transactions' },
  { href: '/balances', reel: 'R5', label: 'Balances', detail: 'GET /v1/reporting/balances' },
];

const SECTIONS = [
  { href: '#exhibits', label: 'The problem' },
  { href: '#cue-sheet', label: 'Cue sheet' },
  { href: '#settlement', label: 'Settlement loop' },
  { href: '#endpoints', label: 'Endpoints' },
];

const ROLL_STAMP: Record<RollCredit['tone'], { status: string; label: string }> = {
  credited: { status: 'READY', label: 'Ready' },
  ghost: { status: 'UNPAID_GHOST', label: 'Still owed' },
  hold: { status: 'NEEDS_REVIEW', label: 'Needs review' },
};

const VERDICT_STAMP: Record<DossierRow['verdict'], { status: string; label: string }> = {
  VERIFIED: { status: 'PAID', label: 'Verified' },
  GHOST_CUT: { status: 'UNPAID_GHOST', label: 'Ghost cut' },
  NEEDS_REVIEW: { status: 'NEEDS_REVIEW', label: 'Needs review' },
};

export default function Home() {
  const dossier = buildDossier();
  return (
    <div className="relative flex min-h-dvh flex-1 flex-col overflow-x-clip bg-cr-void font-grotesk text-cr-bone selection:bg-cr-splice selection:text-cr-void">
      <SiteHeader />
      <main className="flex-1">
        <Hero dossier={dossier} />
        <Exhibits dossier={dossier} />
        <CueSheet dossier={dossier} />
        <SettlementLoop dossier={dossier} />
        <EndpointVault />
      </main>
      <EndCredits />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="relative z-20 border-b border-white/[0.06] bg-cr-void/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between px-5 lg:px-10">
        <Link href="/" className="cr-focus rounded-sm" aria-label="CreditRoll Live home">
          <CreditRollWordmark />
        </Link>
        <nav aria-label="Dossier sections" className="flex items-center gap-8">
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="cr-label cr-focus hidden rounded-sm text-[9.5px] text-cr-smoke transition-colors hover:text-cr-bone lg:inline"
            >
              {section.label}
            </a>
          ))}
          <Link
            href="/dashboard"
            className="cr-focus inline-flex h-9 items-center gap-2 rounded-[4px] border border-cr-splice/70 px-3.5 text-[12.5px] font-semibold text-cr-splice transition-colors hover:bg-cr-splice hover:text-cr-void"
          >
            Open AG Studio <span aria-hidden>→</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero({ dossier }: { dossier: Dossier }) {
  return (
    <section aria-labelledby="hero-title" className="relative isolate flex min-h-[calc(100dvh-4rem)] flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-48 -top-64 -z-10 size-[1000px] rounded-full bg-[radial-gradient(circle,rgba(242,180,64,0.15),transparent_62%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(80%_60%_at_8%_100%,rgba(108,217,209,0.06),transparent_70%)]"
      />
      <div className="mx-auto grid w-full max-w-[1360px] flex-1 grid-cols-1 items-center gap-x-12 gap-y-14 px-5 py-10 lg:grid-cols-12 lg:gap-y-0 lg:px-10">
        <div className="lg:col-span-7">
          <p className="cr-label cr-reveal text-[10px] text-cr-splice">
            PayPal AI Hackathon 2026 · AG Studio 3.0 · PayPal Sandbox
          </p>
          <h1
            id="hero-title"
            className="cr-reveal mt-6 font-display text-[clamp(38px,6.1vw,88px)] font-normal leading-[0.94] tracking-[-0.015em] [--cr-delay:90ms]"
          >
            The credits roll.
            <br />
            <em className="text-cr-splice">The ledger doesn’t.</em>
          </h1>
          <p className="cr-reveal mt-7 max-w-[35rem] text-[18px] leading-[1.6] text-cr-smoke [--cr-delay:180ms]">
            CreditRoll Live turns a film’s end credits into an auditable payout map inside AG Studio.
            When the director’s cut drops a scene, the name leaves the roll — the contract fee stays on
            the books, and PayPal Sandbox settles it.
          </p>
          <div className="cr-reveal mt-9 flex flex-wrap items-center gap-5 [--cr-delay:260ms]">
            <Link
              href="/dashboard"
              className="cr-focus group relative inline-flex items-center gap-4 rounded-[4px] bg-cr-splice py-3.5 pl-5 pr-4 text-cr-void shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_14px_40px_-12px_rgba(242,180,64,0.55)] transition-transform hover:-translate-y-0.5"
            >
              <span className="flex flex-col">
                <span className="text-[16px] font-bold leading-tight">Enter the cutting room</span>
                <span className="cr-label mt-1 text-[8.5px] opacity-70">AG Studio workspace · /dashboard</span>
              </span>
              <span
                aria-hidden
                className="flex size-9 items-center justify-center rounded-[3px] bg-cr-void/90 text-[18px] text-cr-splice transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
            <a
              href="#cue-sheet"
              className="cr-focus inline-flex items-center gap-2 rounded-sm text-[14px] font-semibold text-cr-bone underline decoration-cr-hairline-strong decoration-1 underline-offset-[6px] transition-colors hover:decoration-cr-splice"
            >
              Read the cue sheet <span aria-hidden>↓</span>
            </a>
          </div>
          <dl className="cr-reveal mt-12 grid max-w-[40rem] grid-cols-1 divide-y divide-white/[0.08] border-y border-white/[0.08] [--cr-delay:340ms] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <HeroFigure
              value={formatUsdCents(dossier.executableCents)}
              label="Executable"
              note={`${dossier.executableCount} verified contracts via PayPal Payouts`}
              tone="text-cr-bone"
            />
            <HeroFigure
              value={formatUsdCents(dossier.ghostCents)}
              label="Ghost-cut retained"
              note={`${dossier.ghostNames.join(' & ')} — cut from v2, still owed`}
              tone="text-cr-splice"
            />
            <HeroFigure
              value={`${dossier.heldAliases.length} alias`}
              label="Held for review"
              note={`“${dossier.heldAliases.join(', ')}” matches ${dossier.heldCandidateCount} contracts`}
              tone="text-cr-hold"
            />
          </dl>
        </div>
        <div className="lg:col-span-5">
          <FilmGate dossier={dossier} />
        </div>
      </div>
      <EdgeCodeBand dossier={dossier} />
    </section>
  );
}

function HeroFigure({ value, label, note, tone }: { value: string; label: string; note: string; tone: string }) {
  return (
    <div className="py-4 sm:px-5 sm:first:pl-0">
      <dt className="cr-label text-[8.5px] text-cr-ash">{label}</dt>
      <dd className={`cr-numerals mt-1.5 font-display text-[30px] leading-none ${tone}`}>{value}</dd>
      <dd className="mt-2 text-[12px] leading-snug text-cr-smoke">{note}</dd>
    </div>
  );
}

function FilmGate({ dossier }: { dossier: Dossier }) {
  return (
    <figure className="cr-reveal relative [--cr-delay:200ms]" data-cut="v2">
      <div className="relative overflow-hidden rounded-[10px] bg-[#070605] shadow-[0_60px_120px_-30px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between border-b border-black bg-[linear-gradient(180deg,#1d1a16,#100e0c)] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <span className="cr-vfd text-[15px]">
            TC 01:58:12:
            <span className="cr-frame-counter" data-running="true" />
          </span>
          <span className="cr-label text-[8.5px] text-cr-smoke">Reel 6 · End roll · Cut v2</span>
        </div>
        <div aria-hidden className="relative flex h-[540px]">
          <div data-running="true" className="cr-sprockets w-6 shrink-0 border-r border-black" />
          <EdgeCodeColumn label={dossier.projectId} />
          <div className="relative min-w-0 flex-1 overflow-hidden bg-[radial-gradient(120%_70%_at_50%_45%,#1e1914_0%,#0a0907_70%)] [mask-image:linear-gradient(transparent,#000_11%,#000_89%,transparent)]">
            <div className="cr-roll">
              <RollReel dossier={dossier} />
              <RollReel dossier={dossier} />
            </div>
          </div>
          <EdgeCodeColumn label={dossier.senderBatchId} />
          <div data-running="true" className="cr-sprockets w-6 shrink-0 border-l border-black" />
          <div className="cr-flicker pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_42%,rgba(255,228,170,0.07),transparent_72%)] mix-blend-screen" />
        </div>
      </div>
      <figcaption className="mt-3 flex items-center justify-between gap-4 text-[12px] text-cr-ash">
        <span>
          <span className="cr-label mr-2 text-[8.5px] text-cr-splice">Fig. 1</span>
          The Director’s Cut end roll, read as a ledger.
        </span>
        <span className="font-mono text-[10.5px]">{dossier.projectId}</span>
      </figcaption>
    </figure>
  );
}

function EdgeCodeColumn({ label }: { label: string }) {
  return (
    <div className="w-3.5 shrink-0 overflow-hidden bg-[#0d0b09]">
      <p className="whitespace-nowrap py-3 font-mono text-[7.5px] uppercase tracking-[0.3em] text-cr-splice/55 [writing-mode:vertical-rl]">
        CRL 5219 ▸ 23 4567+04 ▸ {label} ▸ CRL 5219 ▸ 23 4568+16 ▸ {label}
      </p>
    </div>
  );
}

function RollReel({ dossier }: { dossier: Dossier }) {
  const [film, cut] = dossier.projectTitle.split(':').map((part) => part.trim());
  return (
    <div className="px-6 pb-28 pt-20 text-center">
      <p className="cr-label text-[8.5px] text-cr-ash">A CreditRoll Live settlement of</p>
      <p className="mt-3 font-display text-[30px] uppercase leading-none tracking-[0.16em] text-cr-bone">{film}</p>
      {cut && <p className="mt-2.5 font-display text-[15px] italic text-cr-splice">{cut}</p>}
      <ul className="mt-14 space-y-10">
        {dossier.roll.map((credit) => (
          <RollLine key={credit.cueId} credit={credit} />
        ))}
      </ul>
      <p className="cr-label mt-16 text-[8.5px] text-cr-ash">Settled through</p>
      <p className="mt-2 font-display text-[19px] italic text-cr-bone">PayPal Sandbox</p>
      <p className="mx-auto mt-12 max-w-[16rem] font-display text-[13px] italic leading-relaxed text-cr-smoke">
        No crew member was erased from the ledger in the making of this film.
      </p>
    </div>
  );
}

function RollLine({ credit }: { credit: RollCredit }) {
  const stamp = ROLL_STAMP[credit.tone];
  const nameTone =
    credit.tone === 'ghost' ? 'cr-ghost-name' : credit.tone === 'hold' ? 'text-cr-hold' : 'text-cr-bone';
  return (
    <li className="relative grid grid-cols-[1fr_1px_1fr] gap-x-5">
      <span className="flex flex-col items-end pt-1 text-right">
        <span className="cr-label text-[8.5px] leading-relaxed text-cr-smoke">{credit.role}</span>
        {credit.tone === 'ghost' && (
          <span className="mt-1 font-type text-[11px] italic text-cr-grease">✕ cut in v2</span>
        )}
      </span>
      <span className="w-px bg-white/10" />
      <span className="flex flex-col items-start gap-2 text-left">
        <span className={`font-display text-[23px] leading-none ${nameTone}`}>{credit.name}</span>
        <span className="flex items-center gap-2">
          <span
            className={`cr-numerals font-mono text-[11px] ${
              credit.tone === 'ghost' ? 'text-cr-splice' : credit.tone === 'hold' ? 'text-cr-hold' : 'text-cr-smoke'
            }`}
          >
            {credit.tone === 'hold' ? 'Held' : formatUsdCents(credit.amountCents)}
          </span>
          <span className="cr-stamp" data-status={stamp.status}>
            {stamp.label}
          </span>
        </span>
      </span>
      {credit.tone === 'ghost' && <span className="cr-tape cr-tape--lead left-[47%] top-[-7px] h-[12px] w-[74px]" />}
    </li>
  );
}

function EdgeCodeBand({ dossier }: { dossier: Dossier }) {
  const codes = [
    'CRL 5219',
    dossier.projectId,
    'Reel 6 · end roll',
    `Executable ${formatUsdCents(dossier.executableCents)}`,
    `Ghost-cut retained ${formatUsdCents(dossier.ghostCents)}`,
    `Hold · ${dossier.heldAliases.join(', ')}`,
    dossier.senderBatchId,
  ];
  const strip = `${codes.join('   ▸   ')}   ▸   `;
  return (
    <div aria-hidden className="relative h-10 shrink-0 overflow-hidden border-y border-black bg-[#0b0a08]">
      <div className="cr-sprockets-x absolute inset-x-0 top-0 h-2.5 opacity-50" />
      <div className="cr-marquee-track flex w-max whitespace-pre pt-3 font-mono text-[10px] uppercase leading-6 tracking-[0.2em] text-cr-splice/75">
        <span>{strip.repeat(2)}</span>
        <span>{strip.repeat(2)}</span>
      </div>
    </div>
  );
}

function SectionHeading({
  id,
  gallery,
  title,
  lede,
}: {
  id: string;
  gallery: string;
  title: ReactNode;
  lede: string;
}) {
  return (
    <header className="grid grid-cols-1 gap-x-12 gap-y-4 lg:grid-cols-12 lg:gap-y-0">
      <p className="cr-label pt-3 text-[9.5px] text-cr-splice lg:col-span-3">{gallery}</p>
      <div className="lg:col-span-9">
        <h2 id={id} className="font-display text-[36px] font-normal leading-[1.02] tracking-[-0.01em] md:text-[52px]">
          {title}
        </h2>
        <p className="mt-5 max-w-[46rem] text-[16px] leading-relaxed text-cr-smoke">{lede}</p>
      </div>
    </header>
  );
}

function Exhibits({ dossier }: { dossier: Dossier }) {
  const ghostRows = dossier.rows.filter((row) => row.verdict === 'GHOST_CUT');
  const heldRows = dossier.rows.filter((row) => row.verdict === 'NEEDS_REVIEW');
  return (
    <section id="exhibits" aria-labelledby="exhibits-title" className="mx-auto max-w-[1360px] scroll-mt-16 px-5 py-28 lg:px-10">
      <SectionHeading
        id="exhibits-title"
        gallery="Gallery 1 — The problem"
        title={
          <>
            Three ways a crew member vanishes from the money,{' '}
            <em className="text-cr-splice">not just from the screen.</em>
          </>
        }
        lede="Independent productions run credits, contracts, cut changes and payouts in separate spreadsheets. These are the gaps CreditRoll Live closes, shown with the Neon Nocturne records the app ships with."
      />
      <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-[6px] border border-white/[0.08] bg-white/[0.08] lg:grid-cols-3">
        <Placard
          accession="Exhibit A · CUE-02, CUE-03"
          title="The ghost-credit cut"
          artifact={<CutStripArtifact credits={dossier.roll.filter((credit) => credit.tone !== 'hold')} />}
          medium={ghostRows.map((row) => `${row.contractId} ${formatUsdCents(row.feeCents)}`).join(' · ')}
        >
          {ghostRows.map((row) => row.creditedAs).join(' and ')} worked scenes the director trimmed between the
          rough cut and the director’s cut. Their names leave the v2 roll; their approved fixed fees do not. The
          reconciler keeps them on the books as UNPAID_GHOST credits.
        </Placard>
        <Placard
          accession="Exhibit B · CUE-05"
          title="The stage-name alias"
          artifact={<AliasArtifact rows={heldRows} />}
          medium={heldRows.map((row) => `${row.contractId} ${row.legalName}`).join(' · ')}
        >
          “DJ Owl” resolves to one verified contract. “{dossier.heldAliases.join(', ')}” matches {heldRows.length}{' '}
          — {heldRows.map((row) => row.role).join(' and ')} — so the reconciler refuses to guess and places the
          credit on a NEEDS_REVIEW hold. Nothing is paid to an unverified name.
        </Placard>
        <Placard
          accession="Exhibit C · Payouts v1"
          title="Submitted is not settled"
          artifact={<ReadBackArtifact />}
          medium="POST /v1/payments/payouts · GET /v1/payments/payouts/{batch_id}"
        >
          A batch PayPal accepts can still hold items that come back PENDING, UNCLAIMED or FAILED. Every write is
          read back with GET, and a credit turns PAID only when its own payout item returns SUCCESS.
        </Placard>
      </div>
    </section>
  );
}

function Placard({
  accession,
  title,
  artifact,
  medium,
  children,
}: {
  accession: string;
  title: string;
  artifact: ReactNode;
  medium: string;
  children: ReactNode;
}) {
  return (
    <article className="flex flex-col bg-[#0d0c0a] p-8">
      <div aria-hidden className="flex h-[168px] items-center justify-center rounded-[4px] bg-[radial-gradient(80%_80%_at_50%_40%,#1a1612,#0b0a08)]">
        {artifact}
      </div>
      <p className="cr-label mt-8 text-[8.5px] text-cr-splice">{accession}</p>
      <h3 className="mt-2 font-display text-[30px] leading-[1.05]">{title}</h3>
      <p className="mt-4 text-[14.5px] leading-relaxed text-cr-smoke">{children}</p>
      <p className="mt-auto border-t border-white/[0.07] pt-4 font-type text-[11.5px] leading-relaxed text-cr-ash">
        <span className="cr-label mr-2 text-[8px] text-cr-smoke">Medium</span>
        {medium}
      </p>
    </article>
  );
}

function CutStripArtifact({ credits }: { credits: RollCredit[] }) {
  return (
    <div className="relative w-[316px] -rotate-2 shadow-[0_18px_30px_rgba(0,0,0,0.6)]">
      <div className="cr-sprockets-x h-3.5" />
      <div className="flex gap-1 bg-[#0a0907] px-1">
        {credits.map((credit) => {
          const cut = credit.tone === 'ghost';
          return (
            <div
              key={credit.cueId}
              className={`relative flex h-[74px] flex-1 flex-col items-center justify-center rounded-[2px] ${
                cut ? 'bg-[#2a1d0c]' : 'bg-[#1d1a15]'
              }`}
            >
              <span className="font-mono text-[8px] text-cr-ash">{credit.cueId}</span>
              <span className={`mt-1 font-display text-[13px] ${cut ? 'cr-ghost-name' : 'text-cr-bone'}`}>
                {credit.name}
              </span>
              {cut && (
                <span className="absolute inset-0 flex items-center justify-center font-type text-[38px] leading-none text-cr-grease/60">
                  ✕
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="cr-sprockets-x h-3.5" />
      <span className="cr-tape cr-tape--tail left-[24%] top-[80px] h-[12px] w-[52%]" />
    </div>
  );
}

function AliasArtifact({ rows }: { rows: DossierRow[] }) {
  return (
    <div className="relative flex w-[300px] flex-col items-center">
      <span className="rounded-[3px] border border-cr-hold/50 bg-cr-hold/10 px-4 py-1.5 font-display text-[19px] text-cr-bone">
        {rows[0]?.creditedAs ?? 'Alias'}
      </span>
      <svg viewBox="0 0 200 34" className="h-[34px] w-[200px] text-cr-hold/70" fill="none" stroke="currentColor" strokeWidth={1.2}>
        <path d="M100 0 C100 18 40 14 34 32" />
        <path d="M100 0 C100 18 160 14 166 32" />
      </svg>
      <div className="grid w-full grid-cols-2 gap-3">
        {rows.map((row) => (
          <span key={row.contractId} className="rounded-[3px] bg-white/[0.04] px-2 py-1.5 text-center">
            <span className="block text-[12px] font-semibold text-cr-bone">{row.legalName}</span>
            <span className="block font-mono text-[9px] text-cr-ash">{row.contractId}</span>
          </span>
        ))}
      </div>
      <span className="cr-stamp absolute -right-1 top-1 rotate-[8deg] text-[11px]" data-status="NEEDS_REVIEW">
        Hold
      </span>
    </div>
  );
}

function ReadBackArtifact() {
  return (
    <div className="w-[300px] space-y-2.5 font-mono text-[10px]">
      <p className="flex items-center gap-2 text-cr-bone">
        <span className="rounded-[2px] bg-cr-bond px-1.5 py-0.5 text-[9px] font-bold text-white">POST</span>
        /v1/payments/payouts
      </p>
      <p className="flex items-center gap-2 text-cr-bone">
        <span className="rounded-[2px] bg-cr-paid-ink px-1.5 py-0.5 text-[9px] font-bold text-white">GET</span>
        /v1/payments/payouts/{'{batch_id}'}
      </p>
      <div className="flex flex-wrap gap-1.5 pt-1.5">
        {['SUCCESS', 'PENDING', 'UNCLAIMED', 'FAILED'].map((status) => (
          <span key={status} className="cr-stamp" data-status={status}>
            {status}
          </span>
        ))}
      </div>
    </div>
  );
}

function CueSheet({ dossier }: { dossier: Dossier }) {
  return (
    <section id="cue-sheet" aria-labelledby="cue-sheet-title" className="scroll-mt-16 bg-[#0c0b09] py-28">
      <div className="mx-auto max-w-[1360px] px-5 lg:px-10">
        <SectionHeading
          id="cue-sheet-title"
          gallery="Gallery 2 — The evidence"
          title="The cue sheet, read against the contract roster."
          lede="Each row is a signed contract; each column is a cut. Fees come from the locked roster in integer cents — an AI-proposed amount is never used — and every figure on this page comes from the same reconciler that drives the dashboard."
        />
        <article className="cr-paper relative mt-14 -rotate-[0.25deg] rounded-[3px] px-5 pb-10 pt-8 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9),0_0_0_1px_rgba(0,0,0,0.4)] lg:px-10">
          <header className="grid grid-cols-1 items-end gap-6 border-b-2 border-cr-ink pb-4 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="cr-label text-[9px] text-cr-ink-soft">Music, effects &amp; picture cue sheet · contract roster</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2 font-display text-[30px] leading-tight">
                {dossier.projectTitle}
                <span className="cr-stamp rotate-[-5deg] px-2.5 py-1.5 text-[12px]" data-status="UNPAID_GHOST">
                  Cut ≠ waived
                </span>
              </p>
            </div>
            <dl className="grid grid-cols-3 gap-x-8 font-type text-[12px]">
              <SheetField label="Project" value={dossier.projectId} />
              <SheetField label="Revision" value={`Rev ${dossier.revision}`} />
              <SheetField label="Compared" value="Cut v1 ↔ Cut v2" />
            </dl>
          </header>
          {/* Below the desktop breakpoint the sheet keeps its columns and scrolls sideways. */}
          <div className="overflow-x-auto lg:overflow-visible">
            <table className="mt-2 w-full min-w-[1080px] border-collapse text-left lg:min-w-0">
              <thead>
                <tr className="cr-label text-[8.5px] text-cr-ink-soft">
                  <th scope="col" className="py-3 pr-4 font-semibold">Credited as</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Legal name</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Role</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Contract</th>
                  <th scope="col" className="py-3 pr-6 text-right font-semibold">Fixed fee</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Rough cut v1</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Director’s cut v2</th>
                  <th scope="col" className="py-3 font-semibold">Reconciler</th>
                </tr>
              </thead>
              <tbody>
                {dossier.rows.map((row) => (
                  <CueSheetRow key={row.contractId} row={row} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
            <p className="font-type text-[11.5px] leading-relaxed text-cr-ink-soft lg:col-span-5">
              <span className="cr-label mr-2 text-[8px]">Proposal hash</span>
              <span className="break-all text-cr-bond-navy">{dossier.proposalHash}</span>
            </p>
            <ul className="space-y-1.5 lg:col-span-7">
              <SheetTotal
                label={`Executable via PayPal Payouts · ${dossier.executableCount} items`}
                value={formatUsdCents(dossier.executableCents)}
                tone="text-cr-bond"
              />
              <SheetTotal
                label={`of which ghost-cut retained · ${dossier.ghostNames.join(', ')}`}
                value={formatUsdCents(dossier.ghostCents)}
                tone="text-cr-splice-dim"
              />
              <SheetTotal
                label={`Held for human review · “${dossier.heldAliases.join(', ')}”, ${dossier.heldCandidateCount} candidate contracts`}
                value="Hold"
                tone="text-cr-hold-ink"
              />
            </ul>
          </div>
        </article>
      </div>
    </section>
  );
}

function SheetField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="cr-label text-[8px] text-cr-ink-soft">{label}</dt>
      <dd className="mt-0.5 whitespace-nowrap">{value}</dd>
    </div>
  );
}

function SheetTotal({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <li className="flex items-baseline gap-3 text-[13px]">
      <span className="min-w-0 font-semibold text-cr-ink">{label}</span>
      <span aria-hidden className="min-w-6 flex-1 -translate-y-1 border-b border-dotted border-cr-ink/40" />
      <span className={`cr-numerals shrink-0 font-mono text-[15px] font-bold ${tone}`}>{value}</span>
    </li>
  );
}

function CueSheetRow({ row }: { row: DossierRow }) {
  const stamp = VERDICT_STAMP[row.verdict];
  const tint =
    row.verdict === 'GHOST_CUT'
      ? 'bg-[linear-gradient(90deg,rgba(242,180,64,0.2),rgba(242,180,64,0.08))]'
      : row.verdict === 'NEEDS_REVIEW'
        ? 'bg-[rgba(90,60,176,0.06)]'
        : '';
  return (
    <tr className={`border-t border-dashed border-cr-ink/20 align-middle ${tint}`}>
      <th scope="row" className="whitespace-nowrap py-3.5 pl-2 pr-4 font-display text-[19px] font-normal leading-tight">
        {row.creditedAs}
      </th>
      <td className="whitespace-nowrap py-3.5 pr-4 text-[13px]">{row.legalName}</td>
      <td className="py-3.5 pr-4 text-[12.5px] text-cr-ink-soft">{row.role}</td>
      <td className="whitespace-nowrap py-3.5 pr-4 font-mono text-[11.5px]">{row.contractId}</td>
      <td className="cr-numerals py-3.5 pr-6 text-right font-mono text-[13px] font-semibold">{formatUsdCents(row.feeCents)}</td>
      <td className="whitespace-nowrap py-3.5 pr-4">
        <Presence presence={row.roughCut} />
      </td>
      <td className="whitespace-nowrap py-3.5 pr-4">
        <Presence presence={row.directorsCut} />
      </td>
      <td className="py-3.5 pr-2">
        <span className="cr-stamp" data-status={stamp.status}>
          {stamp.label}
        </span>
        <span className="mt-1 block font-type text-[10.5px] leading-snug text-cr-ink-soft">{row.note}</span>
      </td>
    </tr>
  );
}

function Presence({ presence }: { presence: CutPresence }) {
  switch (presence.kind) {
    case 'in-cut':
      return (
        <span className="flex items-center gap-1.5 font-type text-[12.5px]">
          <span aria-hidden className="size-1.5 rounded-full bg-cr-ink" />
          {presence.timestamp}
        </span>
      );
    case 'cut':
      return (
        <span className="font-type text-[13px] font-bold italic text-cr-fail-ink">
          ✕ <span className="line-through decoration-2">Cut</span>
        </span>
      );
    case 'unresolved':
      return <span className="font-type text-[12.5px] text-cr-hold-ink">? {presence.cueId}</span>;
    default:
      return <span className="font-type text-[12.5px] text-cr-ink-soft">—</span>;
  }
}

function SettlementLoop({ dossier }: { dossier: Dossier }) {
  const vouchers = [
    {
      step: '01',
      api: 'Orders v2 · capture',
      title: 'Behind-the-scenes supporter pack',
      figure: '$25.00',
      calls: ['POST /v2/checkout/orders', 'POST /v2/checkout/orders/{id}/capture', 'GET /v2/checkout/orders/{id}'],
      outcome: 'A supporter funds the production from the credit roll; the order is captured, then read back.',
      paper: 'bg-[#fbf8f0]',
    },
    {
      step: '02',
      api: 'Invoicing v2 · QR',
      title: 'Ghost-cut obligation invoice',
      figure: 'QR',
      calls: [
        'POST /v2/invoicing/invoices',
        'POST /v2/invoicing/invoices/{id}/send',
        'POST /v2/invoicing/invoices/{id}/generate-qr-code',
        'GET /v2/invoicing/invoices/{id}',
      ],
      outcome: 'An executive producer receives a scannable invoice for a fee the cut left behind.',
      paper: 'bg-[#f7efcb]',
    },
    {
      step: '03',
      api: 'Payouts v1 · batch',
      title: 'Human-approved crew settlement',
      figure: formatUsdCents(dossier.executableCents),
      calls: ['POST /v1/payments/payouts', 'GET /v1/payments/payouts/{batch_id}'],
      outcome: 'One idempotent batch for every verified contract; each item is stamped from its own read-back.',
      paper: 'bg-[#f5e4de]',
    },
  ];
  return (
    <section id="settlement" aria-labelledby="settlement-title" className="mx-auto max-w-[1360px] scroll-mt-16 px-5 py-28 lg:px-10">
      <SectionHeading
        id="settlement-title"
        gallery="Gallery 3 — The money"
        title={
          <>
            A two-way PayPal Sandbox loop, <em className="text-cr-splice">read back after every write.</em>
          </>
        }
        lede="Credentials never leave the server. Every write carries a PayPal-Request-Id and the payout batch is keyed to the proposal version, so a double click returns the batch that already exists instead of paying anyone twice — and crew payouts stay locked until a producer flips the approval switch in the Patchbay."
      />
      <ol className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {vouchers.map((voucher) => (
          <li key={voucher.step} className={`cr-perf-top relative rounded-b-[3px] px-7 pb-7 pt-8 text-cr-ink ${voucher.paper}`}>
            <div className="flex items-start justify-between gap-4">
              <span className="font-display text-[46px] leading-none text-cr-ink/85">{voucher.step}</span>
              <span className="cr-numerals pt-2 font-mono text-[17px] font-bold text-cr-bond">{voucher.figure}</span>
            </div>
            <p className="cr-label mt-5 text-[8.5px] text-cr-ink-soft">{voucher.api}</p>
            <h3 className="mt-1 font-display text-[24px] leading-tight">{voucher.title}</h3>
            <ul className="mt-5 space-y-1.5 border-y border-dashed border-cr-ink/25 py-4 font-mono text-[10.5px] text-cr-bond-navy">
              {voucher.calls.map((call) => (
                <li key={call}>{call}</li>
              ))}
            </ul>
            <p className="mt-4 font-type text-[12px] leading-relaxed text-cr-ink-soft">{voucher.outcome}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function EndpointVault() {
  return (
    <section id="endpoints" aria-labelledby="endpoints-title" className="scroll-mt-16 border-t border-white/[0.06] bg-[#0c0b09] py-28">
      <div className="mx-auto grid max-w-[1360px] grid-cols-1 gap-x-12 gap-y-10 px-5 lg:grid-cols-12 lg:gap-y-0 lg:px-10">
        <div className="lg:col-span-4">
          <p className="cr-label text-[9.5px] text-cr-splice">Gallery 4 — The vault</p>
          <h2 id="endpoints-title" className="mt-4 font-display text-[44px] font-normal leading-[1.04]">
            The raw reels.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-cr-smoke">
            One AG Grid per PayPal REST endpoint the demo reads, straight from the sandbox account — the source
            footage behind the AG Studio reports.
          </p>
          <Link
            href="/dashboard"
            className="cr-focus mt-8 inline-flex items-center gap-2 rounded-[4px] bg-cr-bone px-4 py-2.5 text-[13.5px] font-semibold text-cr-void transition-colors hover:bg-white"
          >
            Open the AG Studio workspace <span aria-hidden>→</span>
          </Link>
        </div>
        <ul className="divide-y divide-white/[0.07] border-y border-white/[0.07] lg:col-span-8">
          {endpoints.map((endpoint) => (
            <li key={endpoint.href}>
              <Link
                href={endpoint.href}
                className="cr-focus group grid grid-cols-[40px_1fr_24px] items-baseline gap-4 py-5 transition-colors hover:bg-white/[0.02] md:grid-cols-[64px_1fr_auto_32px]"
              >
                <span className="font-mono text-[12px] text-cr-splice">{endpoint.reel}</span>
                <span className="font-display text-[26px] leading-none text-cr-bone transition-colors group-hover:text-cr-splice">
                  {endpoint.label}
                </span>
                <code className="hidden font-mono text-[12px] text-cr-smoke md:block">{endpoint.detail}</code>
                <span aria-hidden className="text-right text-cr-ash transition-transform group-hover:translate-x-1 group-hover:text-cr-splice">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function EndCredits() {
  const credits = [
    { role: 'Built for', name: 'PayPal AI Hackathon 2026' },
    { role: 'Studio', name: 'AG Grid & AG Studio 3.0 custom widgets' },
    { role: 'Payments', name: 'PayPal Sandbox — Orders v2, Invoicing v2, Payouts v1' },
    { role: 'Framework', name: 'Next.js 16 · React 19' },
    { role: 'License', name: 'MIT' },
  ];
  return (
    <footer className="border-t border-white/[0.06] bg-cr-void py-20 text-center">
      <CreditRollWordmark className="justify-center" />
      <dl className="mx-auto mt-10 max-w-[44rem] space-y-3">
        {credits.map((credit) => (
          <div key={credit.role} className="grid grid-cols-2">
            <dt className="cr-label border-r border-white/10 pr-6 text-right text-[9px] leading-5 text-cr-ash">
              {credit.role}
            </dt>
            <dd className="pl-6 text-left font-display text-[16px] leading-5 text-cr-bone">{credit.name}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-12 font-display text-[14px] italic text-cr-smoke">
        No crew member was erased from the ledger in the making of this film.
      </p>
    </footer>
  );
}
