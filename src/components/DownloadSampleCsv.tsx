"use client";

export default function DownloadSampleCsv() {
  function download() {
    const csvContent =
      "Username,Password,Full Name,Email,Department,Designation,Phone,Expected Start Time,Grace Minutes\n" +
      "john,password123,John Doe,john@company.com,Engineering,Developer,+1234567890,09:00,15\n" +
      "jane,password123,Jane Smith,jane@company.com,Marketing,Manager,+0987654321,,\n" +
      "bob,Welcome123,Bob Wilson,bob@company.com,Sales,Executive,+1122334455,08:30,10";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_users.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  return (
    <button className="btn btn-sm btn-outline-secondary" onClick={download}>
      <i className="bi bi-download" /> Download Sample CSV
    </button>
  );
}
