import { aiModels, aiResponsesUrl, openAiKey } from './ai';
import { DEFAULT_CREDIT_ROLL_SCENARIO, reconcileCreditRoll } from './credit-roll-reconciler';

export interface CreditRollAiReview {
  analysis: string;
  model: string | null;
  requestId: string | null;
  responseId: string | null;
  usage: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | null;
  fallback: 'deterministic-local' | null;
}

export async function reviewCreditRoll(signal?: AbortSignal): Promise<CreditRollAiReview> {
  const scenario = DEFAULT_CREDIT_ROLL_SCENARIO;
  const reconciled = reconcileCreditRoll(scenario);
  const key = openAiKey();
  if (!key) {
    return {
      analysis: reconciled.crewSettlements.map((row) => `${row.stageName}: ${row.reconciliationStatus}; ${row.contractAmountCents} locked cents`).join('\n'),
      model: null, requestId: null, responseId: null, usage: null,
      fallback: 'deterministic-local',
    };
  }
  // 只送示範合約與字幕；收款地址不參與語意核對，也不交給模型。
  const contracts = scenario.contracts.map(({ receiverEmail, ...contract }) => {
    void receiverEmail;
    return contract;
  });
  const upstream = await fetch(aiResponsesUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: aiModels()[0],
      store: false,
      max_output_tokens: 1200,
      input: `Review these fictional production credit cues against approved contracts. Identify stage-name evidence, contributors cut in v2 whose fees remain owed, and ambiguous aliases requiring human review. Cite cue/contract IDs. Never authorize payment or change amounts or recipients. Provide a concise readable audit.\n${JSON.stringify({ contracts, cues: scenario.cues })}`,
    }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000),
    cache: 'no-store',
    redirect: 'error',
  });
  if (!upstream.ok) throw new Error(`AI provider returned HTTP ${upstream.status}; no AI result was produced.`);
  const data = await upstream.json() as {
    id?: string; model?: string; status?: string;
    output?: { content?: { type?: string; text?: string }[] }[];
    usage?: CreditRollAiReview['usage'];
  };
  const analysis = data.output?.flatMap((item) => item.content ?? [])
    .filter((part) => part.type === 'output_text').map((part) => part.text ?? '').join('\n').trim();
  if (!analysis || !data.model || !data.id || (data.status && data.status !== 'completed')) {
    throw new Error('AI provider returned an incomplete review; no fallback was substituted.');
  }
  return {
    analysis, model: data.model, responseId: data.id,
    requestId: upstream.headers.get('x-request-id'), usage: data.usage ?? null,
    fallback: null,
  };
}
