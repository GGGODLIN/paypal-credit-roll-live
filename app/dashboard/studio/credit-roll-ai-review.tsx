'use client';

import { useState } from 'react';
import type { CreditRollAiReview } from '@/lib/credit-roll-ai';

export function CreditRollAiReviewPanel() {
  const [review, setReview] = useState<CreditRollAiReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runReview = async () => {
    setBusy(true);
    setError(null);
    setReview(null);
    try {
      const response = await fetch('/api/ai/responses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'credit-roll-review' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? 'AI review failed.');
      setReview(result as CreditRollAiReview);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'AI review failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="border-t border-dashed border-cr-ink/20 px-3 py-2 text-cr-ink">
      <button type="button" disabled={busy} onClick={() => { void runReview(); }} className="cr-label rounded-[2px] bg-cr-bond px-3 py-2 text-[9px] text-white disabled:opacity-50">
        {busy ? 'Reviewing credits…' : 'AI · Review credits & contracts'}
      </button>
      <p className="mt-1 text-[10px]">Advisory only · locked fees and recipient checks remain authoritative.</p>
      <div role="status" aria-live="polite" className="mt-1 whitespace-pre-wrap break-words text-[11px]">
        {error && <p>{error}</p>}
        {review && <>
          <p className="font-mono text-[10px]">{review.fallback ? `fallback: ${review.fallback} · no model call` : `Model: ${review.model}`}</p>
          <p>{review.analysis}</p>
          {!review.fallback && <p className="mt-1 break-all font-mono text-[9px]">
            Response: {review.responseId} · Request: {review.requestId ?? 'not supplied by provider'}
            {'\n'}Tokens in/out/total: {review.usage?.input_tokens ?? 'not supplied'} / {review.usage?.output_tokens ?? 'not supplied'} / {review.usage?.total_tokens ?? 'not supplied'}
          </p>}
        </>}
      </div>
    </section>
  );
}
