// src/app/api/export/full/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  return NextResponse.json(
    { ok: true, route: "/api/export/full", note: "placeholder - implement export full here" },
    { status: 200 }
  );
}