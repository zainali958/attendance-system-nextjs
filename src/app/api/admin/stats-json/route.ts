import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/sheetsDb";

export async function GET() {
  await requireAdmin();
  const db = await getDb();
  const stats = await db.getAttendanceStats();
  const attendanceRaw = await db.getTodayAllAttendance();
  const attendance = await db.annotateLateness(attendanceRaw);
  return NextResponse.json({ stats, attendance });
}
