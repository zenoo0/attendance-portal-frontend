import React from 'react';
import QrDisplay from './QrDisplay';

// Public, admin-login ke bina accessible full-screen QR display —
// reception desk/projector/tablet par permanently khula rakhne ke liye.
// URL: <site>/?display=qr
export default function QrDisplayPage() {
  return (
    <div className="page-dark">
      <header className="navbar-dark">
        <div className="brand">
          <span className="brand-logo-dot">C</span>
          <span>CEGA — Attendance Check-In</span>
        </div>
      </header>

      <main className="page-center">
        <div className="card-dark qr-panel" style={{ width: '100%', maxWidth: 480 }}>
          <QrDisplay />
        </div>
      </main>
    </div>
  );
}
