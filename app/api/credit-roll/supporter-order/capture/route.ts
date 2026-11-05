import {
  captureApprovedSupporterOrder,
  getCreditRollSettlementState,
  type SupporterOrderCaptureInput,
} from '@/lib/credit-roll-settlement';

export async function POST(request: Request): Promise<Response> {
  let body: SupporterOrderCaptureInput = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text) as SupporterOrderCaptureInput;
    }
  } catch {
    return Response.json(
      {
        ok: false,
        statusCode: 400,
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

  const result = await captureApprovedSupporterOrder(body);
  return Response.json(result, {
    status: result.statusCode,
    headers: { 'Cache-Control': 'no-store' },
  });
}
