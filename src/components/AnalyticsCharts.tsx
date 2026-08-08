"use client";

import { useCallback, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  BarChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type {
  AttendanceTrendPoint,
  DepartmentStat,
  PunctualityStats,
} from "@/lib/sheetsDb";

interface AnalyticsData {
  days: number;
  trends: AttendanceTrendPoint[];
  departments: DepartmentStat[];
  punctuality: PunctualityStats;
}

const PIE_COLORS = ["#28a745", "#dc3545"];
const DEPT_COLORS = [
  "#667eea",
  "#764ba2",
  "#28a745",
  "#17a2b8",
  "#ffc107",
  "#dc3545",
  "#20c997",
  "#6f42c1",
];

function formatDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AnalyticsCharts({
  initialData,
}: {
  initialData: AnalyticsData;
}) {
  const [data, setData] = useState(initialData);
  const [period, setPeriod] = useState(initialData.days);
  const [loading, setLoading] = useState(false);

  const loadPeriod = useCallback(async (days: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?days=${days}`);
      const json = await res.json();
      setData(json);
      setPeriod(json.days);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const { trends, departments, punctuality } = data;

  const trendChartData = trends.map((t) => ({
    ...t,
    label: formatDateLabel(t.date),
  }));

  const pieData = [
    { name: "On Time", value: punctuality.on_time },
    { name: "Late", value: punctuality.late },
  ];

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h3 className="mb-0">
          <i className="bi bi-graph-up" /> Analytics
        </h3>
        <div className="btn-group">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              className={`btn btn-sm ${period === d ? "btn-primary" : "btn-outline-primary"}`}
              disabled={loading}
              onClick={() => loadPeriod(d)}
            >
              Last {d} days
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div
            className="text-white mb-3"
            style={{
              background: "linear-gradient(135deg, #28a745, #20c997)",
              borderRadius: 15,
              padding: 25,
            }}
          >
            <h6>On-Time Rate</h6>
            <h2>{punctuality.on_time_percentage}%</h2>
            <small>
              {punctuality.on_time} on-time / {punctuality.late} late (default cutoff{" "}
              {punctuality.expected_start.slice(0, 5)} + {punctuality.grace_minutes}m grace,
              overridable per department/employee)
            </small>
          </div>
        </div>
        <div className="col-md-4">
          <div
            className="text-white mb-3"
            style={{
              background: "linear-gradient(135deg, #667eea, #764ba2)",
              borderRadius: 15,
              padding: 25,
            }}
          >
            <h6>Avg Daily Attendance</h6>
            <h2>
              {trendChartData.length
                ? Math.round(
                    (trendChartData.reduce((s, t) => s + t.attendance_percentage, 0) /
                      trendChartData.length) *
                      100
                  ) / 100
                : 0}
              %
            </h2>
            <small>Over the last {period} days</small>
          </div>
        </div>
        <div className="col-md-4">
          <div
            className="text-white mb-3"
            style={{
              background: "linear-gradient(135deg, #17a2b8, #0dcaf0)",
              borderRadius: 15,
              padding: 25,
            }}
          >
            <h6>Departments Tracked</h6>
            <h2>{departments.length}</h2>
            <small>
              Top: {departments[0]?.department ?? "N/A"} ({departments[0]?.attendance_rate ?? 0}%)
            </small>
          </div>
        </div>
      </div>

      {/* Attendance trend */}
      <div className="card mb-4">
        <div className="card-header bg-white">
          <h5 className="mb-0">
            <i className="bi bi-calendar-week" /> Attendance Trend
          </h5>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" allowDecimals={false} />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="checked_in"
                name="Checked In"
                fill="#667eea"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                yAxisId="left"
                dataKey="checked_out"
                name="Checked Out"
                fill="#20c997"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="attendance_percentage"
                name="Attendance %"
                stroke="#dc3545"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="row mb-4">
        {/* Department comparison */}
        <div className="col-md-7">
          <div className="card h-100">
            <div className="card-header bg-white">
              <h5 className="mb-0">
                <i className="bi bi-building" /> Department Comparison
              </h5>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={departments}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="department" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="attendance_rate"
                    name="Attendance Rate (%)"
                    radius={[4, 4, 0, 0]}
                  >
                    {departments.map((_, i) => (
                      <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                    ))}
                  </Bar>
                  <Bar
                    yAxisId="right"
                    dataKey="avg_daily_hours"
                    name="Avg Daily Hours"
                    fill="#2c3e50"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
              {departments.length === 0 && (
                <p className="text-muted text-center mb-0">No department data yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Punctuality pie */}
        <div className="col-md-5">
          <div className="card h-100">
            <div className="card-header bg-white">
              <h5 className="mb-0">
                <i className="bi bi-clock" /> Punctuality
              </h5>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Punctuality by department */}
      <div className="card mb-4">
        <div className="card-header bg-white">
          <h5 className="mb-0">
            <i className="bi bi-stopwatch" /> On-Time Rate by Department
          </h5>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={punctuality.by_department}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip />
              <Bar dataKey="on_time_percentage" name="On-Time %" radius={[4, 4, 0, 0]}>
                {punctuality.by_department.map((_, i) => (
                  <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {punctuality.by_department.length === 0 && (
            <p className="text-muted text-center mb-0">No check-in data yet.</p>
          )}
        </div>
      </div>

      <p className="text-muted small">
        <i className="bi bi-info-circle" /> &quot;On time&quot; = checked in at or before the
        employee&apos;s expected start time (per-employee or per-department override, if set)
        plus their grace period. Departments/employees with no override use the system default of{" "}
        {punctuality.expected_start.slice(0, 5)} + {punctuality.grace_minutes}m, set via the{" "}
        <code>EXPECTED_START_TIME</code> and <code>EXPECTED_GRACE_MINUTES</code> environment
        variables. Manage overrides from the admin Settings tab.
      </p>
    </div>
  );
}
