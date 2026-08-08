"use client";

import { editAttendanceAction } from "@/lib/actions";

export default function EditAttendanceModal({
  username,
  date,
  checkIn,
  checkOut,
  returnTo,
}: {
  username: string;
  date: string;
  checkIn: string;
  checkOut: string;
  returnTo: string;
}) {
  const modalId = `editAttendance-${username}`;

  return (
    <>
      <button
        type="button"
        className="btn btn-sm btn-outline-primary"
        data-bs-toggle="modal"
        data-bs-target={`#${modalId}`}
      >
        <i className="bi bi-pencil" /> Edit
      </button>

      <div className="modal fade" id={modalId} tabIndex={-1}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header bg-primary">
              <h5 className="modal-title text-white">
                <i className="bi bi-pencil" /> Edit Attendance for {username}
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" />
            </div>
            <form action={editAttendanceAction}>
              <div className="modal-body">
                <input type="hidden" name="username" value={username} />
                <input type="hidden" name="date" value={date} />
                <input type="hidden" name="return_to" value={returnTo} />
                <div className="mb-3">
                  <label className="form-label fw-bold">Check-In Time</label>
                  <input
                    type="text"
                    name="check_in_time"
                    className="form-control"
                    placeholder="HH:MM or HH:MM:SS"
                    defaultValue={checkIn}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Check-Out Time</label>
                  <input
                    type="text"
                    name="check_out_time"
                    className="form-control"
                    placeholder="HH:MM or HH:MM:SS"
                    defaultValue={checkOut}
                  />
                </div>
                <small className="text-muted">
                  Working Hours is recalculated automatically from these two times — no need to
                  enter it.
                </small>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <i className="bi bi-check-circle" /> Save
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
