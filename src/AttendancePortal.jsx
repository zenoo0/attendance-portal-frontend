import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { supabase } from './supabaseClient';
import { getCourseBadge } from './courseBadge';
import QrDisplay from './QrDisplay';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://attendance-portal-backend-production.up.railway.app';

export default function AttendancePortal({ onOpenAdmin, qrToken }) {
  const webcamRef = useRef(null);

  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  useEffect(() => {
    async function fetchCourses() {
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('id, code, name');

        if (error) {
          console.error('Supabase fetch error:', error);
        } else if (data && data.length > 0) {
          setCourses(data);
        }
      } catch (err) {
        console.error('Fetch exception:', err);
      }
    }
    fetchCourses();
  }, []);

  const dataURLtoBlob = (dataurl) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const imageSrc = webcamRef.current?.getScreenshot();

    if (!qrToken) {
      setStatus({ type: 'error', message: "Aaj ka QR code scan karein attendance mark karne ke liye." });
      return;
    }

    if (!selectedCourse || !studentId || !studentName || !imageSrc) {
      setStatus({ type: 'error', message: 'Please fill all fields and enable webcam.' });
      return;
    }

    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      const cleanStudentId = studentId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const imageBlob = dataURLtoBlob(imageSrc);
      const fileName = `${selectedCourse}/${cleanStudentId}_${Date.now()}.jpg`;

      // 1. Storage Upload
      const { error: uploadError } = await supabase.storage
        .from('attendance-captures')
        .upload(fileName, imageBlob, { contentType: 'image/jpeg' });

      if (uploadError) throw new Error('Storage Upload Failed: ' + uploadError.message);

      // 2. Public URL
      const { data: publicUrlData } = supabase.storage
        .from('attendance-captures')
        .getPublicUrl(fileName);

      const imageUrl = publicUrlData.publicUrl;

      // 3. Backend Call
      const response = await fetch(`${BACKEND_URL}/api/v1/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId.trim(),
          student_name: studentName.trim(),
          course_id: selectedCourse,
          image_url: imageUrl,
          token: qrToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const serverDetail = typeof errorData.detail === 'string'
          ? errorData.detail
          : JSON.stringify(errorData.detail) || 'Server error occurred.';
        // 400-series = expected/validated errors (already friendly Urdu/English
        // text from backend, e.g. "Ye Student ID registered nahi hai...") —
        // dikhao as-is. 500-series = genuine server error, technical prefix rakho.
        throw new Error(response.status < 500 ? serverDetail : `Server Error (${response.status}): ${serverDetail}`);
      }

      const resultData = await response.json().catch(() => ({}));

      setStatus({
        type: 'success',
        message: resultData.warning
          ? `Attendance marked successfully! ⚠ ${resultData.warning}`
          : 'Attendance marked successfully!',
      });
      setStudentId('');
      setStudentName('');
      setSelectedCourse('');
    } catch (err) {
      console.error('Submission error:', err);
      setStatus({ type: 'error', message: err.message || 'Network error / Server unreachable.' });
    } finally {
      setLoading(false);
    }
  };

  const selectedCourseObj = courses.find((c) => c.id === selectedCourse);
  const selectedBadge = selectedCourseObj ? getCourseBadge(selectedCourseObj.name) : null;
  const canSubmit = Boolean(selectedCourse) && studentId.trim() !== '' && studentName.trim() !== '' && !loading;

  return (
    <div className="page-dark">
      <header className="navbar-dark">
        <div className="brand">
          <span className="brand-logo-dot">C</span>
          <span>CEGA</span>
        </div>
        <button type="button" className="btn btn-outline-dark btn-sm" onClick={onOpenAdmin}>
          🔒 Admin Login
        </button>
      </header>

      <main className="page-center">
        <div className="card-dark form-card">
          <div className="form-header">
            <h1 className="h1">Student<br />Attendance</h1>
            <p className="muted-mono">CEGA Official Verification Portal</p>
          </div>

          {status.message && (
            <div className={status.type === 'success' ? 'alert alert-success' : 'alert alert-error'}>
              {status.message}
            </div>
          )}

          {!qrToken ? (
            <div className="qr-blocked-state">
              <p className="h2" style={{ fontSize: '18px', marginBottom: 'var(--space-4)' }}>
                Scan Today's QR Code
              </p>
              <QrDisplay size={220} hint={false} />
            </div>
          ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="field-group">
              <label className="field-label" htmlFor="course-select">Select Course</label>
              <div
                className="select-accent-wrap"
                style={selectedBadge ? { '--accent': selectedBadge.text } : undefined}
              >
                <select
                  id="course-select"
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="input-dark select-dark"
                  required
                >
                  <option value="">Select active module...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {selectedCourseObj && (
                <span
                  className="course-pill"
                  style={{ color: selectedBadge.text, background: selectedBadge.bg, alignSelf: 'flex-start' }}
                >
                  {selectedCourseObj.code}
                </span>
              )}
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="student-id">Student ID</label>
              <input
                id="student-id"
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. CEGA-24-001"
                className="input-dark"
                required
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="student-name">Full Name</label>
              <input
                id="student-name"
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="As registered in the system"
                className="input-dark"
                required
              />
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label">Biometric Verification</label>
                <span className="live-badge">
                  <span className="live-dot" />
                  Live
                </span>
              </div>

              <div className="webcam-frame">
                <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" />
                <span className="scan-corner tl" />
                <span className="scan-corner tr" />
                <span className="scan-corner bl" />
                <span className="scan-corner br" />
              </div>
              <p className="scan-caption">Align face within frame</p>
            </div>

            <button type="submit" disabled={!canSubmit} className="btn btn-primary btn-block btn-lg">
              {loading ? 'Processing…' : (
                <>
                  <span>👤✓</span>
                  Mark Attendance
                </>
              )}
            </button>
          </form>
          )}
        </div>
      </main>
    </div>
  );
}
