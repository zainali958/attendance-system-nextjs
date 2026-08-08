import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDb, todayStr, getTimeZone } from "@/lib/sheetsDb";

export async function GET(req: NextRequest) {
  await requireUser();
  const db = await getDb();
  const dateParam =
    req.nextUrl.searchParams.get("date") || todayStr(getTimeZone());
  const stats = await db.getAttendanceStats(dateParam);
  return NextResponse.json(stats);
}
