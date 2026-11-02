// The AG Studio AI assistant. The adapter calls `${endpoint}/responses`, i.e. this app's proxy at
// app/api/ai/responses, which holds the OpenAI key, so nothing secret is sent from the browser.

import { createAiHarness, type AgAiHarnessSetup, type AgAiPromptStarter } from 'ag-studio';
import { openaiAdapter } from './openai-adapter';

// Suggestions shown in a new AI conversation, before anything has been typed.
export const PROMPT_STARTERS: AgAiPromptStarter[] = [
  {
    label: 'Audit Ghost-Cut crew obligations',
    prompt:
      'Which crew members were removed in Cut v2 (GHOST_CUT / UNPAID_GHOST) and still retain 100% of their fixed-fee contract obligation?',
  },
  {
    label: 'Verify stage names & alias holds',
    prompt:
      'Show how credit-roll stage names and aliases map to legal contracts in crewSettlements, and explain why homonymous aliases are flagged NEEDS_REVIEW.',
  },
  {
    label: 'Summarise this page',
    prompt: 'Summarise what this page shows: every widget, the fields it reads, and what stands out.',
  },
  {
    label: 'Overdue invoices',
    prompt: 'Which customers owe the most on overdue invoices?',
  },
  {
    label: 'Revenue by month',
    prompt: 'Add a chart of paid invoice revenue by month.',
  },
];

// `models` are the ids allowed by OPENAI_MODELS on the server; the first is the default, and the
// picker only shows for two or more.
export function buildAi(models: string[]): AgAiHarnessSetup {
  const adapter = openaiAdapter({ endpoint: '/api/ai', model: models[0] });

  return ({ api }) =>
    createAiHarness(api, {
      adapter,
      promptStarters: PROMPT_STARTERS,
      models: models.length > 1 ? models.map((id) => ({ id, label: id })) : undefined,
    });
}
