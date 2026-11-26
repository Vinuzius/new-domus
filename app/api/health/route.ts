import { NextResponse } from 'next/server';
import { getServerConfigStatus } from '@/lib/env';

export async function GET() {
  const status = getServerConfigStatus();
  return NextResponse.json({
    ok: true,
    configured: status.isReady,
  });
}
