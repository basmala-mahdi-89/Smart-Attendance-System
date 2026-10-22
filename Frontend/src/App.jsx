import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import HeadDashboard from './pages/HeadDashboard';
import DeanDashboard from './pages/DeanDashboard';
import PendingStudents from './pages/PendingStudents';
import AcceptInvitation from './pages/AcceptInvitation';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/invite/:token" element={<AcceptInvitation />} />

          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/doctor"
            element={
              <ProtectedRoute allowedRoles={['doctor', 'engineer' , 'head']}>
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/head"
            element={
              <ProtectedRoute allowedRoles={['head']}>
                <HeadDashboard />
              </ProtectedRoute>
            }
          />
          <Route
  path="/head/pending-students"
  element={
    <ProtectedRoute allowedRoles={['head']}>
      <PendingStudents />
    </ProtectedRoute>
  }
/>

          <Route
            path="/dean"
            element={
              <ProtectedRoute allowedRoles={['dean']}>
                <DeanDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;