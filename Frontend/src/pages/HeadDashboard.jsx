import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function HeadDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('courses');
  const [courses, setCourses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseForm, setCourseForm] = useState({ course_code: '', course_name: '', academic_year: '1' });

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningToCourse, setAssigningToCourse] = useState(null);
  const [assignForm, setAssignForm] = useState({ staff_id: '', role_in_course: 'doctor', is_primary: false });

  // Invite form state
  const [inviteForm, setInviteForm] = useState({ full_name: '', email: '', national_id: '', role: 'doctor' });
  const [inviteStatus, setInviteStatus] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [coursesRes, staffRes, overviewRes] = await Promise.all([
        client.get('/head/courses'),
        client.get('/head/staff'),
        client.get('/head/major/overview')
      ]);
      setCourses(coursesRes.data);
      setStaff(staffRes.data);
      setOverview(overviewRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ============================
  // Course CRUD
  // ============================
  const openAddCourseModal = () => {
    setEditingCourse(null);
    setCourseForm({ course_code: '', course_name: '', academic_year: '1' });
    setShowCourseModal(true);
  };

  const openEditCourseModal = (course) => {
    setEditingCourse(course);
    setCourseForm({
      course_code: course.course_code,
      course_name: course.course_name,
      academic_year: course.academic_year
    });
    setShowCourseModal(true);
  };

  const saveCourse = async (e) => {
    e.preventDefault();
    try {
      if (editingCourse) {
        await client.put(`/head/courses/${editingCourse.id}`, courseForm);
      } else {
        await client.post('/head/courses', courseForm);
      }
      setShowCourseModal(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save course');
    }
  };

  // ============================
  // Assign Staff
  // ============================
  const openAssignModal = (course, role = 'doctor') => {
    setAssigningToCourse(course);
    setAssignForm({ staff_id: '', role_in_course: role, is_primary: false });
    setShowAssignModal(true);
  };

  const saveAssignment = async (e) => {
    e.preventDefault();
    try {
      await client.post(`/head/courses/${assigningToCourse.id}/staff`, {
        staff_id: parseInt(assignForm.staff_id),
        role_in_course: assignForm.role_in_course,
        is_primary: assignForm.is_primary
      });
      setShowAssignModal(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign staff');
    }
  };

  const removeStaff = async (courseId, assignmentId) => {
    if (!window.confirm('Remove this staff member from the course?')) return;
    try {
      await client.delete(`/head/courses/${courseId}/staff/${assignmentId}`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove staff');
    }
  };

  // ============================
  // Send Invite
  // ============================
  const sendInvite = async (e) => {
    e.preventDefault();
    setInviteStatus('');
    try {
      await client.post('/invitations', inviteForm);
      setInviteStatus(`✅ Invitation sent to ${inviteForm.email}!`);
      setInviteForm({ full_name: '', email: '', national_id: '', role: 'doctor' });
      loadData();
    } catch (err) {
      setInviteStatus(`❌ ${err.response?.data?.message || 'Failed to send invitation'}`);
    }
  };

  if (loading) return <div>Loading...</div>;

  // Filter doctors and engineers separately
  const doctors = staff.filter(s => s.role === 'doctor' || s.role === 'head');
  const engineers = staff.filter(s => s.role === 'engineer');

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
        <h1>Head Dashboard</h1>
        <p>Welcome, {user?.full_name}</p>
        <button onClick={() => navigate('/doctor')} style={{ background: 'blue', color: 'white', padding: '8px' }}>🩺 Doctor View</button>
        <button onClick={() => navigate('/head/pending-students')} style={{ background: 'orange', color: 'white', padding: '8px' }}>📋 Pending Students</button>
        <button onClick={logout}>Logout</button>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => setActiveTab('overview')} style={{ fontWeight: activeTab === 'overview' ? 'bold' : 'normal' }}>Overview</button>
        <button onClick={() => setActiveTab('courses')} style={{ fontWeight: activeTab === 'courses' ? 'bold' : 'normal' }}>Manage Courses</button>
        <button onClick={() => setActiveTab('invite')} style={{ fontWeight: activeTab === 'invite' ? 'bold' : 'normal' }}>Invite Staff</button>
      </div>

      {/* ============================ */}
      {/* TAB: Overview */}
      {/* ============================ */}
      {activeTab === 'overview' && overview && (
        <section>
          <h2>{overview.major.name}</h2>
          <p>Students: {overview.stats.total_students}</p>
          <p>Courses: {overview.stats.total_courses}</p>
          <p>Sessions: {overview.stats.total_sessions}</p>
        </section>
      )}

      {/* ============================ */}
      {/* TAB: Courses */}
      {/* ============================ */}
      {activeTab === 'courses' && (
        <section>
          <button onClick={openAddCourseModal} style={{ padding: '10px', background: 'green', color: 'white', marginBottom: '20px' }}>
            + Add Course
          </button>

          <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#f0f0f0' }}>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Year</th>
                <th>Students</th>
                <th>Doctor 👨‍🏫</th>
                <th>Engineers 👷‍♂️</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map(c => {
                const courseDoctor = c.staff?.find(s => s.role_in_course === 'doctor');
                const courseEngineers = c.staff?.filter(s => s.role_in_course === 'engineer') || [];

                return (
                  <tr key={c.id}>
                    <td>{c.course_code}</td>
                    <td>{c.course_name}</td>
                    <td>{c.academic_year}</td>
                    <td>{c.students}</td>
                    
                    <td>
                      {courseDoctor ? (
                        <div>
                          <b>Dr. {courseDoctor.full_name}</b>
                          {courseDoctor.is_primary && <span style={{ color: 'green' }}> (Primary)</span>}
                          <button 
                            onClick={() => removeStaff(c.id, courseDoctor.assignment_id)}
                            style={{ marginLeft: '10px', color: 'red', fontSize: '12px' }}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => openAssignModal(c, 'doctor')} style={{ color: 'blue' }}>
                          + Assign Doctor
                        </button>
                      )}
                    </td>

                    <td>
                      {courseEngineers.length > 0 ? (
                        courseEngineers.map(eng => (
                          <div key={eng.assignment_id} style={{ marginBottom: '5px' }}>
                            <b>Eng. {eng.full_name}</b>
                            <button 
                              onClick={() => removeStaff(c.id, eng.assignment_id)}
                              style={{ marginLeft: '10px', color: 'red', fontSize: '12px' }}
                            >
                              Remove
                            </button>
                          </div>
                        ))
                      ) : (
                        <span style={{ color: 'gray' }}>None</span>
                      )}
                      <button onClick={() => openAssignModal(c, 'engineer')} style={{ color: 'blue', marginTop: '5px', display: 'block' }}>
                        + Assign Engineer
                      </button>
                    </td>

                    <td>
                      <button onClick={() => openEditCourseModal(c)} style={{ marginRight: '5px' }}>Edit</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* ============================ */}
      {/* TAB: Invite Staff */}
      {/* ============================ */}
      {activeTab === 'invite' && (
        <section style={{ maxWidth: '500px' }}>
          <h2>Invite Doctor / Engineer</h2>
          <form onSubmit={sendInvite} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input 
              placeholder="Full Name" 
              value={inviteForm.full_name} 
              onChange={e => setInviteForm({...inviteForm, full_name: e.target.value})} 
              required 
              style={{ padding: '8px' }}
            />
            <input 
              type="email" 
              placeholder="Email" 
              value={inviteForm.email} 
              onChange={e => setInviteForm({...inviteForm, email: e.target.value})} 
              required 
              style={{ padding: '8px' }}
            />
            <input 
              placeholder="National ID (14 digits)" 
              value={inviteForm.national_id} 
              onChange={e => setInviteForm({...inviteForm, national_id: e.target.value})} 
              required 
              style={{ padding: '8px' }}
            />
            <select 
              value={inviteForm.role} 
              onChange={e => setInviteForm({...inviteForm, role: e.target.value})}
              style={{ padding: '8px' }}
            >
              <option value="doctor">Doctor</option>
              <option value="engineer">Engineer</option>
            </select>
            <button type="submit" style={{ padding: '10px', background: 'green', color: 'white' }}>
              Send Invitation
            </button>
          </form>
          {inviteStatus && <p style={{ marginTop: '15px' }}>{inviteStatus}</p>}
        </section>
      )}

      {/* ============================ */}
      {/* Course Modal */}
      {/* ============================ */}
      {showCourseModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '8px', minWidth: '400px' }}>
            <h2>{editingCourse ? 'Edit Course' : 'Add New Course'}</h2>
            <form onSubmit={saveCourse} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input 
                placeholder="Course Code (e.g. CS101)" 
                value={courseForm.course_code} 
                onChange={e => setCourseForm({...courseForm, course_code: e.target.value})} 
                required 
                style={{ padding: '8px' }}
              />
              <input 
                placeholder="Course Name" 
                value={courseForm.course_name} 
                onChange={e => setCourseForm({...courseForm, course_name: e.target.value})} 
                required 
                style={{ padding: '8px' }}
              />
              <select 
                value={courseForm.academic_year} 
                onChange={e => setCourseForm({...courseForm, academic_year: e.target.value})}
                style={{ padding: '8px' }}
              >
                <option value="1">Year 1</option>
                <option value="2">Year 2</option>
                <option value="3">Year 3</option>
                <option value="4">Year 4</option>
              </select>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" style={{ background: 'green', color: 'white', padding: '10px', flex: 1 }}>
                  {editingCourse ? 'Save Changes' : 'Create'}
                </button>
                <button type="button" onClick={() => setShowCourseModal(false)} style={{ padding: '10px', flex: 1 }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================ */}
      {/* Assign Staff Modal */}
      {/* ============================ */}
      {showAssignModal && assigningToCourse && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '8px', minWidth: '400px' }}>
            <h2>Assign {assignForm.role_in_course === 'doctor' ? 'Doctor' : 'Engineer'}</h2>
            <p>Course: <b>{assigningToCourse.course_code} - {assigningToCourse.course_name}</b></p>
            
            <form onSubmit={saveAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
              
              <select 
                value={assignForm.role_in_course} 
                onChange={e => setAssignForm({...assignForm, role_in_course: e.target.value, staff_id: ''})}
                style={{ padding: '8px' }}
              >
                <option value="doctor">Doctor</option>
                <option value="engineer">Engineer</option>
              </select>

              <label>Select Staff Member:</label>
              <select 
                value={assignForm.staff_id} 
                onChange={e => setAssignForm({...assignForm, staff_id: e.target.value})} 
                required
                style={{ padding: '8px' }}
              >
                <option value="">-- Choose --</option>
                {assignForm.role_in_course === 'doctor' 
                  ? doctors.map(d => (
                      <option key={d.id} value={d.id}>
                        Dr. {d.full_name} {d.id === user.id ? '(You)' : ''}
                      </option>
                    ))
                  : engineers.map(e => (
                      <option key={e.id} value={e.id}>
                        Eng. {e.full_name}
                      </option>
                    ))
                }
              </select>

              {assignForm.role_in_course === 'doctor' && (
                <label>
                  <input 
                    type="checkbox" 
                    checked={assignForm.is_primary} 
                    onChange={e => setAssignForm({...assignForm, is_primary: e.target.checked})} 
                  />
                  Is Primary Doctor?
                </label>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" style={{ background: 'green', color: 'white', padding: '10px', flex: 1 }}>
                  Assign
                </button>
                <button type="button" onClick={() => setShowAssignModal(false)} style={{ padding: '10px', flex: 1 }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}