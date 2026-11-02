import {
  executeCrewBatchPayoutAndReadBack,
  getCreditRollSettlementState,
  type CrewBatchSettlementRequestInput,
} from '@/lib/credit-roll-settlement';

export async function POST(request: Request): Promise<Response> {
  let body: CrewBatchSettlementRequestInput;
  try {
    body = (await request.json()) as CrewBatchSettlementRequestInput;
  } catch {
    return Response.json(
      {
        ok: false,
        statusCode: 400,
        idempotentReplay: false,
        error: {
          code: 'INVALID_JSON_BODY',
          message: 'Request body must be valid JSON.',
          paypalStatus: null,
          debugId: null,
        },
        state: getCreditRollSettlementState(),
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const result = await executeCrewBatchPayoutAndReadBack(body);
  return Response.json(result, {
    status: result.statusCode,
    headers: { 'Cache-Control': 'no-store' },
  });
}
