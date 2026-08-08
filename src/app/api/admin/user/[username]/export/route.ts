import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/sheetsDb";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  await requireAdmin();
  const { username } = await params;
  const db = await getDb();

  const user = await db.getUserByUsername(username);
  if (!user) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  const yearMonth = req.nextUrl.searchParams.get("month")?.trim();
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    return NextResponse.redirect(
      new URL(`/admin/user/${encodeURIComponent(username)}`, req.url)
    );
  }

  const records = await db.getUserAttendanceByMonth(username, yearMonth);
  const withLateness = await db.annotateLateness(records);

  const headerRow = [
    "Date",
    "Username",
    "Full Name",
    "Department",
    "Check-In Time",
    "Late",
    "Check-Out Time",
    "Working Hours",
  ];
  const csvEscape = (v: string) =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

  const lines = [headerRow.join(",")];
  for (const r of withLateness) {
    lines.push(
      [
        r.Date || "",
        r.Username || "",
        r["Full Name"] || "",
        r.Department || "",
        r["Check-In Time"] || "",
        r["Check-In Time"] ? (r.is_late ? "Yes" : "No") : "",
        r["Check-Out Time"] || "",
        r["Working Hours"] || "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  const filename = `${username}_attendance_${yearMonth}.csv`;

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
