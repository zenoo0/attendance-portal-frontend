import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://attendance-portal-backend-production.up.railway.app';

// Shared "Today's QR" panel — Admin Dashboard ke QR tab aur standalone
// public /?display=qr page, dono isi ek component ko reuse karte hain.
// Sirf public GET /api/v1/qr/today call karta hai — koi admin-only data
// (attendance records, students list) yahan touch nahi hota.
export default function QrDisplay() {
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [qrError, setQrError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const fetchQr = async () => {
      setQrError('');
      try {
        const response = await fetch(`${BACKEND_URL}/api/v1/qr/today`);
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || 'QR code load nahi ho saka.');
        }
        const data = await response.json();
        if (!cancelled) setQrData(data);
      } catch (err) {
        if (!cancelled) setQrError(err.message || 'QR code load nahi ho saka.');
      } finally {
        if (!cancelled) setQrLoading(false);
      }
    };

    setQrLoading(true);
    fetchQr();
    // Har 60s me re-check — raat 12 baje (naya din) naya QR khud-ba-khud
    // is screen par bhi bina manual refresh ke aa jayega.
    const interval = setInterval(fetchQr, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="card-dark qr-panel">
      {qrLoading ? (
        <div className="state-msg">
          <div className="spinner" />
          QR code generate ho raha hai...
        </div>
      ) : qrError ? (
        <div className="alert alert-error" style={{ maxWidth: 360 }}>{qrError}</div>
      ) : qrData ? (
        <>
          <div className="qr-frame">
            <span className="qr-corner-l" />
            <span className="qr-corner-r" />
            <QRCodeSVG
              value={`${window.location.origin}/?token=${qrData.token}`}
              size={260}
              bgColor="#ffffff"
              fgColor="#0B0F14"
              level="M"
            />
          </div>
          <p className="label-mono qr-meta">Valid for</p>
          <p className="qr-date">{qrData.valid_date} · until midnight (PKT)</p>
          <p className="text-body" style={{ color: '#9CA3AF', marginTop: 'var(--space-4)', maxWidth: 360 }}>
            Ye QR code screen/projector par display karein — students apne
            phone se scan karke seedha attendance form par pahunch jayenge.
            Raat 12 baje ye khud-ba-khud expire ho kar naya QR ban jayega.
          </p>
        </>
      ) : null}
    </div>
  );
}
