"use client";

import { useState } from "react";

export default function MonthDownloadLinks({
  username,
  initialMonth,
}: {
  username: string;
  initialMonth: string;
}) {
  const [month, setMonth] = useState(initialMonth);
  const encoded = encodeURIComponent(username);

  return (
    <div className="d-flex gap-2 align-items-center">
      <label className="mb-0 small text-muted">Download month:</label>
      <input
        type="month"
        className="form-control form-control-sm"
        style={{ width: 160 }}
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        required
      />
      <a
        className="btn btn-sm btn-outline-success"
        href={`/api/admin/user/${encoded}/export?month=${month}`}
      >
        <i className="bi bi-download" /> Download CSV
      </a>
      <a
        className="btn btn-sm btn-outline-primary"
        href={`/api/admin/user/${encoded}/export-docx?month=${month}`}
      >
        <i className="bi bi-file-earmark-word" /> Download DOCX
      </a>
    </div>
  );
}
