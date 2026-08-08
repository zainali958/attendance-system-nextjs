import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/sheetsDb";

export async function GET(req: NextRequest) {
  await requireAdmin();
  const db = await getDb();

  const daysParam = parseInt(req.nextUrl.searchParams.get("days") || "30", 10);
  const days = [7, 30, 90].includes(daysParam) ? daysParam : 30;

  const [trends, departments, punctuality] = await Promise.all([
    db.getAttendanceTrends(days),
    db.getDepartmentStats(days),
    db.getPunctualityStats(days),
  ]);

  return NextResponse.json({ days, trends, departments, punctuality });
}
