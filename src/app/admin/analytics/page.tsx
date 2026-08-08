import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/sheetsDb";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import FlashBanner from "@/components/FlashBanner";

export const metadata = { title: "Analytics - Admin Panel" };
export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  await requireAdmin();
  const db = await getDb();

  const [trends, departments, punctuality] = await Promise.all([
    db.getAttendanceTrends(30),
    db.getDepartmentStats(30),
    db.getPunctualityStats(30),
  ]);

  return (
    <div className="container mt-4">
      <nav className="mb-4">
        <Link href="/admin" className="btn btn-outline-primary">
          <i className="bi bi-arrow-left" /> Back to Admin Panel
        </Link>
      </nav>

      <FlashBanner />

      <AnalyticsCharts
        initialData={{ days: 30, trends, departments, punctuality }}
      />
    </div>
  );
}
