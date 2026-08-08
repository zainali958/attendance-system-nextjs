"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AttendanceDateFilter({
  initialDate,
  compact = false,
}: {
  initialDate: string;
  compact?: boolean;
}) {
  const [date, setDate] = useState(initialDate);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    router.push(`/admin/attendance/${date}`);
  }

  return (
    <form
      className={compact ? "row g-2 justify-content-end" : "row g-3 mb-4"}
      onSubmit={handleSubmit}
    >
      {!compact && (
        <div className="col-auto">
          <label className="form-label fw-bold">Select Date</label>
          <input
            type="date"
            className="form-control"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      )}
      {compact && (
        <div className="col-auto">
          <input
            type="date"
            className="form-control"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      )}
      <div className="col-auto">
        {!compact && <label className="form-label">&nbsp;</label>}
        <button type="submit" className="btn btn-primary d-block">
          <i className="bi bi-search" /> {compact ? "View" : "View Records"}
        </button>
      </div>
    </form>
  );
}
