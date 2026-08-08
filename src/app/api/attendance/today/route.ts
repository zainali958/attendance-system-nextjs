import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/sheetsDb";

export async function GET() {
  await requireUser();
  const db = await getDb();
  const today = await db.getTodayAllAttendance();
  return NextResponse.json(today);
}
