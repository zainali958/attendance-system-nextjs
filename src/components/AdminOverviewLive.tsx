"use client";

import { useEffect, useState, useCallback } from "react";
import type { AttendanceRecordWithLateness, AttendanceStats } from "@/lib/sheetsDb";

export default function AdminOverviewLive({
  initialStats,
  initialAttendance,
  today,
}: {
  initialStats: AttendanceStats;
  initialAttendance: AttendanceRecordWithLateness[];
  today: string;
}) {
  const [stats, setStats] = useState(initialStats);
  const [attendance, setAttendance] = useState(initialAttendance);

  const refresh = useCallback(async () => {
    // Don't disrupt the admin if a modal is open or they're typing.
    const modalOpen = document.querySelector(".modal.show");
    const active = document.activeElement;
    const isTyping =
      active &&
      ["INPUT", "TEXTAREA", "SELECT"].includes((active as HTMLElement).tagName);
    if (modalOpen || isTyping) return;

    try {
      const res = await fetch("/api/admin/stats-json");
      const data = await res.json();
      setStats(data.stats);
      setAttendance(data.attendance);
    } catch (err) {
      console.error("Dashboard refresh failed:", err);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, 60000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <>
      <div className="row mb-4">
        <div className="col-md-4">
          <div
            className="position-relative text-white mb-3"
            style={{
              background: "linear-gradient(135deg, #667eea, #764ba2)",
              borderRadius: 15,
              padding: 25,
            }}
          >
            <i className="bi bi-people position-absolute" style={{ fontSize: "3rem", opacity: 0.3, top: 10, right: 20 }} />
            <h6>Total Users</h6>
            <h2>{stats.total_users}</h2>
            <small>Registered employees</small>
          </div>
        </div>
        <div className="col-md-4">
          <div
            className="position-relative text-white mb-3"
            style={{
              background: "linear-gradient(135deg, #28a745, #20c997)",
              borderRadius: 15,
              padding: 25,
            }}
          >
            <i className="bi bi-check-circle position-absolute" style={{ fontSize: "3rem", opacity: 0.3, top: 10, right: 20 }} />
            <h6>Checked In</h6>
            <h2>{stats.checked_in}</h2>
            <small>{stats.attendance_percentage}% attendance</small>
          </div>
        </div>
        <div className="col-md-4">
          <div
            className="position-relative text-white mb-3"
            style={{
              background: "linear-gradient(135deg, #17a2b8, #0dcaf0)",
              borderRadius: 15,
              padding: 25,
            }}
          >
            <i className="bi bi-check-circle-fill position-absolute" style={{ fontSize: "3rem", opacity: 0.3, top: 10, right: 20 }} />
            <h6>Checked Out</h6>
            <h2>{stats.checked_out}</h2>
            <small>Completed day</small>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <i className="bi bi-calendar-check" /> Today&apos;s Attendance ({today})
          </h5>
          <div>
            <span className="badge bg-success me-2">{stats.checked_in} Checked In</span>
            <span className="badge bg-info me-2">{stats.checked_out} Checked Out</span>
            <button className="btn btn-sm btn-outline-primary" onClick={refresh}>
              <i className="bi bi-arrow-clockwise" /> Refresh
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Check-In Time</th>
                  <th>Check-Out Time</th>
                  <th>Working Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((record, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{record["Full Name"]}</strong>
                      <br />
                      <small className="text-muted">{record.Username}</small>
                    </td>
                    <td>{record.Department || "N/A"}</td>
                    <td>
                      {record["Check-In Time"] ? (
                        <>
                          <span className="text-success fw-bold">{record["Check-In Time"]}</span>
                          {record.is_late ? (
                            <span
                              className="badge bg-danger ms-2"
                              title={`Expected by ${record.expected_start.slice(0, 5)}`}
                            >
                              Late
                            </span>
                          ) : (
                            <span className="badge bg-success ms-2">On time</span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      {record["Check-Out Time"] ? (
                        <span className="text-danger fw-bold">{record["Check-Out Time"]}</span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      {record["Working Hours"] ? (
                        <span className="badge bg-success">{record["Working Hours"]}</span>
                      ) : (
                        <span className="text-muted">In progress</span>
                      )}
                    </td>
                    <td>
                      {record["Check-Out Time"] ? (
                        <span className="badge bg-info">✓ Completed</span>
                      ) : record["Check-In Time"] ? (
                        <span className="badge bg-success">● Working</span>
                      ) : (
                        <span className="badge bg-warning text-dark">○ Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
                {attendance.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      <i className="bi bi-info-circle" /> No attendance records for today yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
