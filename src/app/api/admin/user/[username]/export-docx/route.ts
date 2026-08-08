import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
} from "docx";
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
  const monthLabel = new Date(`${yearMonth}-01T00:00:00`).toLocaleString(
    "en-US",
    { month: "long", year: "numeric" }
  );

  const headers = [
    "Date",
    "Username",
    "Full Name",
    "Department",
    "Check-In Time",
    "Late",
    "Check-Out Time",
    "Working Hours",
  ];

  const headerRow = new TableRow({
    children: headers.map(
      (h) =>
        new TableCell({
          width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [new TextRun({ text: h, bold: true, size: 20 })],
            }),
          ],
        })
    ),
  });

  const dataRows = withLateness.map(
    (r) =>
      new TableRow({
        children: [
          r.Date || "",
          r.Username || "",
          r["Full Name"] || "",
          r.Department || "",
          r["Check-In Time"] || "",
          r["Check-In Time"] ? (r.is_late ? "Yes" : "No") : "",
          r["Check-Out Time"] || "",
          r["Working Hours"] || "",
        ].map(
          (v) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: String(v), size: 20 })],
                }),
              ],
            })
        ),
      })
  );

  const children: Paragraph[] = [];
  const bodyChildren: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Attendance Report" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${user["Full Name"] || username}  |  ${
            user.Department || ""
          }  |  ${monthLabel}`,
          italics: true,
          size: 22,
        }),
      ],
    }),
    new Paragraph({ text: "" }),
  ];

  if (records.length > 0) {
    bodyChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headerRow, ...dataRows],
      })
    );
  } else {
    bodyChildren.push(
      new Paragraph({ text: "No attendance records found for this month." })
    );
  }

  const doc = new Document({
    sections: [{ children: bodyChildren }],
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `${username}_attendance_${yearMonth}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
