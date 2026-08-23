import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import { getCourseBadge } from './courseBadge';
import QrDisplay from './QrDisplay';

export default function AdminDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('attendance');
  const [attendance, setAttendance] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // Registration Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({
    student_id: '',
    full_name: '',
    course_id: '',
    email: ''
  });

  useEffect(() => {
    fetchData();

    // Realtime Auto-Fetch on New Attendance Insert
    const attendanceSub = supabase
      .channel('public:attendance_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_logs' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceSub);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Courses
      const { data: coursesData } = await supabase.from('courses').select('*');
      if (coursesData) {
        setCourses(coursesData);
        if (coursesData.length > 0) {
          setNewStudent(prev => ({ ...prev, course_id: coursesData[0].id }));
        }
      }

      // 2. Fetch Attendance Records
      const { data: attendanceData, error: attError } = await supabase
        .from('attendance_logs')
        .select(`
          id,
          student_id,
          student_name,
          image_url,
          captured_at,
          course_id,
          courses ( code, name )
        `)
        .order('captured_at', { ascending: false });

      if (attError) console.warn('Attendance fetch warning:', attError);
      setAttendance(attendanceData || []);

      // 3. Fetch Registered Students
      const { data: studentsData, error: stuError } = await supabase
        .from('students')
        .select(`
          id,
          student_id,
          full_name,
          email,
          course_id,
          courses ( code, name )
        `)
        .order('student_id', { ascending: true });

      if (stuError) console.warn('Students fetch warning:', stuError);
      setStudents(studentsData || []);

    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Manual Student Registration Handler
  const handleRegisterStudent = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('students')
        .insert([
          {
            student_id: newStudent.student_id,
            full_name: newStudent.full_name,
            course_id: newStudent.course_id || (courses[0]?.id || null),
            email: newStudent.email,
          }
        ])
        .select(`
          id,
          student_id,
          full_name,
          email,
          course_id,
          courses ( code, name )
        `);

      if (error) throw error;

      if (data) {
        setStudents(prev => [...prev, ...data]);
      }
      setIsModalOpen(false);
      setNewStudent({
        student_id: '',
        full_name: '',
        course_id: courses[0]?.id || '',
        email: ''
      });
      fetchData();
    } catch (err) {
      alert('Failed to register student: ' + err.message);
    }
  };

  // Filter calculations
  const filteredAttendance = selectedCourse === 'ALL'
    ? attendance
    : attendance.filter(item => item.course_id === selectedCourse);

  const filteredStudents = selectedCourse === 'ALL'
    ? students
    : students.filter(item => item.course_id === selectedCourse);

  // Export Function
  const exportToExcel = () => {
    const exportData = filteredAttendance.map((record, index) => ({
      'S.No': index + 1,
      'Student ID': record.student_id,
      'Student Name': record.student_name,
      'Course Code': record.courses?.code || 'N/A',
      'Course Name': record.courses?.name || 'N/A',
      'Date & Time': new Date(record.captured_at).toLocaleString(),
      'Verification Image URL': record.image_url,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Report');
    XLSX.writeFile(workbook, `Attendance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="admin-shell">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-logo-dot">🏛️</span>
          <h2 className="sidebar-title">CEGA Admin</h2>
        </div>

        <nav className="sidebar-nav">
          <button
            onClick={() => setActiveTab('attendance')}
            className={activeTab === 'attendance' ? 'sidebar-nav-item active' : 'sidebar-nav-item'}
          >
            📊 Attendance Log
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={activeTab === 'students' ? 'sidebar-nav-item active' : 'sidebar-nav-item'}
          >
            🎓 Registered Students
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={activeTab === 'qr' ? 'sidebar-nav-item active' : 'sidebar-nav-item'}
          >
            📱 Today's QR
          </button>
        </nav>

        <button onClick={onLogout} className="btn btn-ghost-red">
          🚪 Logout
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="topbar">
          <div>
            <h1 className="h1">
              {activeTab === 'attendance' && 'Student Attendance Records'}
              {activeTab === 'students' && 'Registered Students Directory'}
              {activeTab === 'qr' && "Today's QR Code"}
            </h1>
            <p className="text-muted" style={{ marginTop: 'var(--space-1)' }}>
              CEGA Educational Administration Panel
            </p>
          </div>

          <div>
            {activeTab === 'attendance' && (
              <button onClick={exportToExcel} className="btn btn-outline-blue">
                📥 Export to Excel
              </button>
            )}
            {activeTab === 'students' && (
              <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
                ➕ Register New Student
              </button>
            )}
          </div>
        </header>

        {activeTab === 'qr' ? (
          <>
            <div className="card-dark qr-panel">
              <QrDisplay />
            </div>
            <p className="text-muted" style={{ marginTop: 'var(--space-4)', fontSize: 13 }}>
              💡 Reception/projector ke liye standalone full-screen link (admin login ke bina):{' '}
              <code style={{ fontFamily: 'var(--font-mono)' }}>{window.location.origin}/?display=qr</code>
            </p>
          </>
        ) : (
          <>
            {/* Filter Bar */}
            <div className="card-light filter-card">
              <label className="field-label field-label-light">Filter by Course:</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="input-light select-light"
              >
                <option value="ALL">All Modules &amp; Courses</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
              <span className="pill pill-blue-tint count-pill">
                {activeTab === 'attendance' ? `${filteredAttendance.length} Records Found` : `${filteredStudents.length} Students Registered`}
              </span>
            </div>

        {/* Table Card */}
        <div className="card-light table-card">
          {loading ? (
            <div className="state-msg">
              <div className="spinner" />
              Loading data from server...
            </div>
          ) : activeTab === 'attendance' ? (
            /* Attendance Log Table */
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Student ID</th>
                    <th>Name</th>
                    <th>Course</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendance.length > 0 ? (
                    filteredAttendance.map((item) => {
                      const badge = getCourseBadge(item.courses?.name || item.courses?.code || '');
                      return (
                        <tr key={item.id}>
                          <td>
                            {item.image_url ? (
                              <img src={item.image_url} alt="Capture" className="avatar-thumb" />
                            ) : (
                              <span className="no-img-chip">No Img</span>
                            )}
                          </td>
                          <td className="td-bold">{item.student_id}</td>
                          <td>{item.student_name}</td>
                          <td>
                            <span className="course-pill" style={{ color: badge.text, background: badge.bg }}>
                              {item.courses?.code || 'N/A'}
                            </span>
                          </td>
                          <td className="mono-muted">
                            {new Date(item.captured_at).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" className="state-msg">No attendance logs found for this filter.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Registered Students Table */
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Full Name</th>
                    <th>Assigned Course</th>
                    <th>Email Address</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((stu) => {
                      const badge = getCourseBadge(stu.courses?.name || stu.courses?.code || '');
                      return (
                        <tr key={stu.id || stu.student_id}>
                          <td className="td-bold">{stu.student_id}</td>
                          <td>{stu.full_name}</td>
                          <td>
                            <span className="course-pill" style={{ color: badge.text, background: badge.bg }}>
                              {stu.courses?.code || 'N/A'} - {stu.courses?.name || ''}
                            </span>
                          </td>
                          <td className="mono-muted">{stu.email || 'N/A'}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="4" className="state-msg">No registered students found for this course.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
          </>
        )}
      </main>

      {/* Student Registration Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="card-light modal-card">
            <h2 className="h2" style={{ marginBottom: 'var(--space-6)' }}>Register New Student</h2>
            <form onSubmit={handleRegisterStudent}>
              <div className="field-group">
                <label className="field-label field-label-light">Student ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CEGA-24-01"
                  value={newStudent.student_id}
                  onChange={(e) => setNewStudent({ ...newStudent, student_id: e.target.value })}
                  className="input-light"
                />
              </div>

              <div className="field-group">
                <label className="field-label field-label-light">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Muhammad Ali"
                  value={newStudent.full_name}
                  onChange={(e) => setNewStudent({ ...newStudent, full_name: e.target.value })}
                  className="input-light"
                />
              </div>

              <div className="field-group">
                <label className="field-label field-label-light">Course</label>
                <select
                  value={newStudent.course_id}
                  onChange={(e) => setNewStudent({ ...newStudent, course_id: e.target.value })}
                  className="input-light select-light"
                  style={{ width: '100%' }}
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label className="field-label field-label-light">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="student@cega.edu"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                  className="input-light"
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary-light">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
