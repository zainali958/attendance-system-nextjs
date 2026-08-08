import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/sheetsDb";

export async function GET() {
  const session = await requireUser();
  const db = await getDb();
  const status = await db.getUserWorkingHoursToday(session.username);
  return NextResponse.json(status);
}
