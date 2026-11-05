// PayPal REST client: every call this demo makes to PayPal goes through here. It covers
// catalog products, billing plans, invoicing, Transaction Search and balances, with plain
// fetch and no SDK. Server-side only: it reads the client secret from the environment.

const BASE_URL = 'https://api-m.sandbox.paypal.com';
const MAX_ATTEMPTS = 4;

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type PayPalCallOptions = {
  fetchImpl?: FetchLike;
  clientId?: string;
  clientSecret?: string;
};

export function redactPayPalSecrets(text: string, explicitSecret?: string): string {
  let out = text;
  const candidates = [explicitSecret, process.env.PAYPAL_SECRET].filter(
    (s): s is string => typeof s === 'string' && s.trim().length > 0,
  );
  for (const secret of candidates) {
    out = out.split(secret).join('[REDACTED_PAYPAL_SECRET]');
  }
  return out;
}

function extractDebugId(body: string, headerDebugId?: string | null): string | null {
  if (headerDebugId && headerDebugId.trim().length > 0) {
    return headerDebugId.trim();
  }
  try {
    const parsed = JSON.parse(body) as { debug_id?: unknown };
    if (typeof parsed.debug_id === 'string' && parsed.debug_id.trim().length > 0) {
      return parsed.debug_id.trim();
    }
  } catch {
    // Non-JSON upstream error body; fall back to null.
  }
  return null;
}

export class PayPalApiError extends Error {
  readonly status: number;
  readonly path: string;
  readonly debugId: string | null;
  readonly rawBody: string;

  constructor(
    status: number,
    path: string,
    body: string,
    debugId?: string | null,
    secretToRedact?: string,
  ) {
    const safeBody = redactPayPalSecrets(body, secretToRedact);
    const resolvedDebugId = extractDebugId(safeBody, debugId);
    super(`PayPal ${status} on ${path}: ${safeBody.slice(0, 300)}`);
    this.name = 'PayPalApiError';
    this.status = status;
    this.path = path;
    this.debugId = resolvedDebugId;
    this.rawBody = safeBody;
  }
}

let cachedToken: { value: string; expiresAt: number; fetchRef: FetchLike; clientId: string } | undefined;

async function accessToken(options?: PayPalCallOptions): Promise<string> {
  const fetchFn: FetchLike = options?.fetchImpl ?? fetch;
  const id = options?.clientId ?? process.env.PAYPAL_CLIENT_ID;
  const secret = options?.clientSecret ?? process.env.PAYPAL_SECRET;
  if (!id || !secret) throw new Error('PAYPAL_CLIENT_ID and PAYPAL_SECRET must be set (see .env.local)');

  if (
    cachedToken &&
    cachedToken.fetchRef === fetchFn &&
    cachedToken.clientId === id &&
    Date.now() < cachedToken.expiresAt
  ) {
    return cachedToken.value;
  }

  let res: Response;
  try {
    res = await fetchFn(`${BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      cache: 'no-store',
    });
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const wrapped = new Error(redactPayPalSecrets(rawMsg, secret));
    wrapped.name = err instanceof Error ? err.name : 'Error';
    throw wrapped;
  }

  if (!res.ok) {
    throw new PayPalApiError(
      res.status,
      '/v1/oauth2/token',
      await res.text(),
      res.headers.get('paypal-debug-id'),
      secret,
    );
  }

  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  // Refresh a minute early so an in-flight request never carries an expired token.
  cachedToken = {
    value: access_token,
    expiresAt: Date.now() + (expires_in - 60) * 1000,
    fetchRef: fetchFn,
    clientId: id,
  };
  return access_token;
}

async function get<T>(path: string, options?: PayPalCallOptions): Promise<T> {
  const fetchFn: FetchLike = options?.fetchImpl ?? fetch;
  const secret = options?.clientSecret ?? process.env.PAYPAL_SECRET;

  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetchFn(`${BASE_URL}${path}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${await accessToken(options)}` },
        cache: 'no-store',
      });
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const wrapped = new Error(redactPayPalSecrets(rawMsg, secret));
      wrapped.name = err instanceof Error ? err.name : 'Error';
      throw wrapped;
    }
    if (res.ok) return (await res.json()) as T;

    // A revoked or expired token: drop it and mint a new one once.
    if (res.status === 401 && attempt === 1) {
      cachedToken = undefined;
      continue;
    }
    if (!options?.fetchImpl && (res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 250));
      continue;
    }
    throw new PayPalApiError(
      res.status,
      path,
      await res.text(),
      res.headers.get('paypal-debug-id'),
      secret,
    );
  }
}

async function postJson<T>(
  path: string,
  body: Record<string, unknown>,
  requestId: string,
  options?: PayPalCallOptions,
): Promise<{ data: T; headers: Headers }> {
  const fetchFn: FetchLike = options?.fetchImpl ?? fetch;
  const secret = options?.clientSecret ?? process.env.PAYPAL_SECRET;
  const trimmedRequestId = requestId.trim();
  if (!trimmedRequestId) {
    throw new Error(`PayPal-Request-Id is required for POST ${path}`);
  }

  let res: Response;
  try {
    res = await fetchFn(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await accessToken(options)}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': trimmedRequestId,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const wrapped = new Error(redactPayPalSecrets(rawMsg, secret));
    wrapped.name = err instanceof Error ? err.name : 'Error';
    throw wrapped;
  }

  const rawText = await res.text();
  if (!res.ok) {
    throw new PayPalApiError(
      res.status,
      path,
      rawText,
      res.headers.get('paypal-debug-id'),
      secret,
    );
  }

  if (!rawText.trim()) {
    return { data: {} as T, headers: res.headers };
  }

  try {
    return { data: JSON.parse(rawText) as T, headers: res.headers };
  } catch {
    return { data: ({ rawText } as unknown) as T, headers: res.headers };
  }
}

// `path` must already carry whatever flag makes the endpoint report `total_pages`.
async function listAll<T>(path: string, key: string, pageSize: number): Promise<T[]> {
  const items: T[] = [];
  const sep = path.includes('?') ? '&' : '?';
  for (let page = 1; ; page++) {
    const res = await get<{ total_pages?: number } & Record<string, unknown>>(
      `${path}${sep}page_size=${pageSize}&page=${page}`,
    );
    items.push(...((res[key] as T[] | undefined) ?? []));
    if (page >= (res.total_pages ?? 1)) return items;
  }
}

export type Money = { value: string; currency_code: string };

// PayPal sends amounts as decimal strings; missing amounts count as 0.
export const amountOf = (m?: Money | null) => (m?.value === undefined ? 0 : Number(m.value));

// --- Catalog products & billing plans ------------------------------------------

export type Product = {
  id: string;
  name: string;
  description?: string;
  type?: 'PHYSICAL' | 'DIGITAL' | 'SERVICE';
  category?: string;
  create_time: string;
};

export type IntervalUnit = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export type BillingCycle = {
  frequency: { interval_unit: IntervalUnit; interval_count: number };
  tenure_type: 'REGULAR' | 'TRIAL';
  sequence: number;
  total_cycles: number;
  pricing_scheme?: { fixed_price?: Money };
};

export type Plan = {
  id: string;
  product_id: string;
  name: string;
  status: 'CREATED' | 'INACTIVE' | 'ACTIVE';
  create_time: string;
  billing_cycles: BillingCycle[];
  payment_preferences?: { setup_fee?: Money };
};

// The list endpoints return summaries (no product type/category, no billing cycles),
// so each record is fetched in full.
export async function listProducts(): Promise<Product[]> {
  const summaries = await listAll<{ id: string }>('/v1/catalogs/products?total_required=true', 'products', 20);
  return Promise.all(summaries.map((p) => get<Product>(`/v1/catalogs/products/${encodeURIComponent(p.id)}`)));
}

export async function listPlans(): Promise<Plan[]> {
  const summaries = await listAll<{ id: string }>('/v1/billing/plans?total_required=true', 'plans', 20);
  return Promise.all(summaries.map((p) => get<Plan>(`/v1/billing/plans/${encodeURIComponent(p.id)}`)));
}

// --- Invoicing -------------------------------------------------------------------

export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'SCHEDULED'
  | 'UNPAID'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'MARKED_AS_PAID'
  | 'PARTIALLY_PAID'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'MARKED_AS_REFUNDED'
  | 'CANCELLED';

export type Invoice = {
  id: string;
  status: InvoiceStatus;
  detail: {
    invoice_number: string;
    currency_code: string;
    invoice_date?: string;
    payment_term?: { term_type?: string; due_date?: string };
  };
  primary_recipients?: {
    billing_info?: {
      name?: { full_name?: string };
      business_name?: string;
      email_address?: string;
    };
  }[];
  items?: {
    id?: string;
    name: string;
    quantity: string;
    unit_amount: Money;
    unit_of_measure?: string;
    tax?: { percent?: string; amount?: Money };
    discount?: { percent?: string; amount?: Money };
  }[];
  amount?: Money & { breakdown?: { tax_total?: Money; shipping?: { amount?: Money } } };
  due_amount?: Money;
  payments?: {
    paid_amount?: Money;
    transactions?: { payment_id?: string; payment_date?: string; method?: string; amount: Money }[];
  };
  refunds?: {
    refund_amount?: Money;
    transactions?: { recipient_transaction_id?: string; refund_date?: string; method?: string; amount: Money }[];
  };
};

// The list omits line items, payments and refunds; the detail endpoint has them.
export async function listInvoices(): Promise<Invoice[]> {
  const summaries = await listAll<{ id: string }>('/v2/invoicing/invoices?total_required=true', 'items', 100);
  return Promise.all(summaries.map((i) => get<Invoice>(`/v2/invoicing/invoices/${encodeURIComponent(i.id)}`)));
}

// --- Transaction Search & balances -------------------------------------------------

export type Transaction = {
  transaction_info: {
    transaction_id: string;
    paypal_reference_id?: string;
    transaction_event_code?: string;
    transaction_initiation_date?: string;
    transaction_amount?: Money;
    fee_amount?: Money;
    transaction_status?: string;
    ending_balance?: Money;
    transaction_subject?: string;
    transaction_note?: string;
    custom_field?: string;
  };
  payer_info?: { email_address?: string };
};

// Transaction Search allows ranges of at most 31 days and rejects fractional seconds.
export const TRANSACTION_SEARCH_MAX_DAYS = 31;

export function searchTransactions(start: Date, end: Date): Promise<Transaction[]> {
  const iso = (d: Date) => `${d.toISOString().slice(0, 19)}Z`;
  return listAll<Transaction>(
    `/v1/reporting/transactions?start_date=${iso(start)}&end_date=${iso(end)}&fields=all`,
    'transaction_details',
    500,
  );
}

export type Balances = {
  as_of_time?: string;
  balances?: { currency: string; total_balance?: Money; available_balance?: Money; withheld_balance?: Money }[];
};

export function getBalances(): Promise<Balances> {
  return get<Balances>('/v1/reporting/balances');
}

// --- CreditRoll Live Write & Read-Back Operations --------------------------------

export const formatCentsAsUsdString = (cents: number): string => {
  const safeCents = Math.round(cents);
  const whole = Math.trunc(safeCents / 100);
  const remainder = Math.abs(safeCents % 100);
  return `${whole}.${String(remainder).padStart(2, '0')}`;
};

export type PayPalOrderStatus =
  | 'CREATED'
  | 'SAVED'
  | 'APPROVED'
  | 'VOIDED'
  | 'COMPLETED'
  | 'PAYER_ACTION_REQUIRED';

export type PayPalOrderResponse = {
  id: string;
  status: PayPalOrderStatus;
  intent?: 'CAPTURE' | 'AUTHORIZE';
  purchase_units?: {
    reference_id?: string;
    description?: string;
    custom_id?: string;
    amount?: Money;
  }[];
  links?: { href: string; rel: string; method?: string }[];
};

export type CreateAndCaptureOrderInput = {
  amountCents: number;
  currencyCode?: 'USD';
  description?: string;
  customId?: string;
  referenceId?: string;
  requestId: string;
  capture?: boolean;
};

export type CreateAndCaptureOrderResult = {
  createOrderResponse: PayPalOrderResponse;
  readBackOrder: PayPalOrderResponse;
};

export async function createAndCaptureOrder(
  input: CreateAndCaptureOrderInput,
  options?: PayPalCallOptions,
): Promise<CreateAndCaptureOrderResult> {
  const currencyCode = input.currencyCode ?? 'USD';
  const { data: createOrderResponse } = await postJson<PayPalOrderResponse>(
    '/v2/checkout/orders',
    {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: input.referenceId ?? 'BTS-SUPPORTER-PACK',
          description: input.description ?? 'Neon Nocturne — Behind-the-Scenes Digital Supporter Pack',
          ...(input.customId ? { custom_id: input.customId } : {}),
          amount: {
            currency_code: currencyCode,
            value: formatCentsAsUsdString(input.amountCents),
          },
        },
      ],
    },
    input.requestId,
    options,
  );

  const orderId = createOrderResponse.id;
  if (!orderId) {
    throw new PayPalApiError(502, '/v2/checkout/orders', 'Missing order id in PayPal response');
  }

  if (input.capture ?? true) {
    try {
      await postJson<PayPalOrderResponse>(
        `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
        {},
        `${input.requestId}-CAPTURE`,
        options,
      );
    } catch (err) {
      // A CAPTURE order has no funding until the payer approves it at its 'approve' link, and
      // PayPal answers the capture with 422 ORDER_NOT_APPROVED until then (seen on the live
      // sandbox). That order is pending, not failed: leave it uncaptured and let the read-back
      // below report its real status and approve link. Any other refusal still fails the call.
      if (!(err instanceof PayPalApiError && err.status === 422 && err.rawBody.includes('ORDER_NOT_APPROVED'))) {
        throw err;
      }
    }
  }

  const readBackOrder = await get<PayPalOrderResponse>(
    `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
    options,
  );

  return {
    createOrderResponse,
    readBackOrder,
  };
}

export type CreateObligationInvoiceInput = {
  invoiceNumber: string;
  recipientEmail: string;
  recipientName: string;
  itemName: string;
  itemDescription?: string;
  amountCents: number;
  currencyCode?: 'USD';
  invoiceDate?: string;
  note?: string;
  requestId: string;
};

export type CreateObligationInvoiceResult = {
  invoiceId: string;
  qrCodeBase64: string;
  readBackInvoice: Invoice;
};

function parseInvoiceIdFromCreateResponse(
  data: { id?: string; href?: string },
  headers: Headers,
): string | null {
  if (typeof data.id === 'string' && data.id.trim().length > 0) {
    return data.id.trim();
  }
  const hrefCandidate = data.href ?? headers.get('location') ?? '';
  if (hrefCandidate.includes('/')) {
    const lastSegment = hrefCandidate.split('/').filter(Boolean).at(-1);
    if (lastSegment) return lastSegment.trim();
  }
  return null;
}

function parseQrBase64Payload(data: Record<string, unknown>): string {
  const candidates = [data.qr_code, data.image, data.base64, data.rawText];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      const cleaned = candidate.trim().replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
      // Strip MIME multipart framing if PayPal returns a multipart body in rawText
      const lines = cleaned
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(
          (line) =>
            line.length > 0 &&
            !line.startsWith('--') &&
            !line.toLowerCase().startsWith('content-'),
        );
      return lines.join('');
    }
  }
  return '';
}

export async function createSendAndReadBackInvoiceWithQr(
  input: CreateObligationInvoiceInput,
  options?: PayPalCallOptions,
): Promise<CreateObligationInvoiceResult> {
  const currencyCode = input.currencyCode ?? 'USD';
  const invoiceDate = input.invoiceDate ?? new Date().toISOString().slice(0, 10);

  const { data: createData, headers: createHeaders } = await postJson<{ id?: string; href?: string }>(
    '/v2/invoicing/invoices',
    {
      detail: {
        invoice_number: input.invoiceNumber,
        currency_code: currencyCode,
        invoice_date: invoiceDate,
        note: input.note ?? 'CreditRoll Live Production Obligation Invoice',
        payment_term: { term_type: 'DUE_ON_RECEIPT' },
      },
      primary_recipients: [
        {
          billing_info: {
            name: { full_name: input.recipientName },
            email_address: input.recipientEmail,
          },
        },
      ],
      items: [
        {
          name: input.itemName,
          description: input.itemDescription ?? input.note ?? 'Approved production contract obligation',
          quantity: '1',
          unit_amount: {
            currency_code: currencyCode,
            value: formatCentsAsUsdString(input.amountCents),
          },
        },
      ],
    },
    input.requestId,
    options,
  );

  const invoiceId = parseInvoiceIdFromCreateResponse(createData, createHeaders);
  if (!invoiceId) {
    throw new PayPalApiError(502, '/v2/invoicing/invoices', 'Missing invoice id in PayPal response');
  }

  await postJson<Record<string, unknown>>(
    `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/send`,
    {
      send_to_invoicer: false,
      send_to_recipient: true,
    },
    `${input.requestId}-SEND`,
    options,
  );

  const { data: qrData } = await postJson<Record<string, unknown>>(
    `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/generate-qr-code`,
    {
      width: 300,
      height: 300,
      action: 'pay',
    },
    `${input.requestId}-QR`,
    options,
  );

  const qrCodeBase64 = parseQrBase64Payload(qrData);

  const readBackInvoice = await get<Invoice>(
    `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`,
    options,
  );

  return {
    invoiceId,
    qrCodeBase64,
    readBackInvoice,
  };
}

export type PayPalPayoutTransactionStatus =
  | 'SUCCESS'
  | 'PENDING'
  | 'UNCLAIMED'
  | 'FAILED'
  | 'ONHOLD'
  | 'BLOCKED'
  | 'REFUNDED'
  | 'RETURNED'
  | 'REVERSED'
  | 'CANCELED'
  | 'NEW'
  | 'PROCESSING';

export type PayPalPayoutBatchItem = {
  payout_item_id: string;
  transaction_id?: string;
  transaction_status: PayPalPayoutTransactionStatus;
  payout_batch_id?: string;
  payout_item: {
    recipient_type: string;
    amount: { value: string; currency?: string; currency_code?: string };
    receiver: string;
    note?: string;
    sender_item_id: string;
  };
};

export type PayPalPayoutBatchResponse = {
  batch_header: {
    payout_batch_id: string;
    batch_status: string;
    sender_batch_header?: {
      sender_batch_id?: string;
      email_subject?: string;
      email_message?: string;
    };
  };
  items?: PayPalPayoutBatchItem[];
};

export type CreatePayoutBatchInput = {
  senderBatchId: string;
  requestId: string;
  emailSubject: string;
  emailMessage: string;
  items: {
    receiverEmail: string;
    amountCents: number;
    currencyCode?: 'USD';
    note: string;
    senderItemId: string;
  }[];
};

export async function createAndReadBackPayoutBatch(
  input: CreatePayoutBatchInput,
  options?: PayPalCallOptions,
): Promise<{
  createBatchResponse: PayPalPayoutBatchResponse;
  readBackBatch: PayPalPayoutBatchResponse;
}> {
  const { data: createBatchResponse } = await postJson<PayPalPayoutBatchResponse>(
    '/v1/payments/payouts',
    {
      sender_batch_header: {
        sender_batch_id: input.senderBatchId,
        email_subject: input.emailSubject,
        email_message: input.emailMessage,
      },
      items: input.items.map((item) => ({
        recipient_type: 'EMAIL',
        amount: {
          value: formatCentsAsUsdString(item.amountCents),
          currency: item.currencyCode ?? 'USD',
        },
        receiver: item.receiverEmail,
        note: item.note,
        sender_item_id: item.senderItemId,
      })),
    },
    input.requestId,
    options,
  );

  const payoutBatchId = createBatchResponse.batch_header?.payout_batch_id;
  if (!payoutBatchId) {
    throw new PayPalApiError(502, '/v1/payments/payouts', 'Missing payout_batch_id in PayPal response');
  }

  const readBackBatch = await get<PayPalPayoutBatchResponse>(
    `/v1/payments/payouts/${encodeURIComponent(payoutBatchId)}`,
    options,
  );

  return {
    createBatchResponse,
    readBackBatch,
  };
}

