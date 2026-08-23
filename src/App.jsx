import React, { useState } from 'react';
import AttendancePortal from './AttendancePortal';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';

export default function App() {
  const [currentPage, setCurrentPage] = useState('student');

  // Daily QR code student ko '/?token=XYZ' par le aata hai — root URL hi
  // Student Attendance page hai, is liye sirf query param parse karna kaafi hai.
  const [qrToken] = useState(() => new URLSearchParams(window.location.search).get('token'));

  return (
    <div>
      {currentPage === 'student' && (
        <AttendancePortal onOpenAdmin={() => setCurrentPage('admin-login')} qrToken={qrToken} />
      )}

      {currentPage === 'admin-login' && (
        <AdminLogin 
          onBackToStudent={() => setCurrentPage('student')}
          onLoginSuccess={() => setCurrentPage('admin-dashboard')}
        />
      )}

      {currentPage === 'admin-dashboard' && (
        <AdminDashboard onLogout={() => setCurrentPage('student')} />
      )}
    </div>
  );
}