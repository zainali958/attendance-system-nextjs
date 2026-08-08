"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#f8f9fa",
      }}
    >
      <div className="text-center">
        <div style={{ fontSize: "6rem", fontWeight: "bold", color: "#dc3545" }}>500</div>
        <h3>Something Went Wrong</h3>
        <p className="text-muted">
          An unexpected error occurred. Please try again.
        </p>
        <button className="btn btn-primary" onClick={() => reset()}>
          Try Again
        </button>
      </div>
    </div>
  );
}
