import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import EngineerDashboard from './pages/EngineerDashboard';
import HeadDashboard from './pages/HeadDashboard';
import DeanDashboard from './pages/DeanDashboard';
import PendingStudents from './pages/PendingStudents';
import AcceptInvitation from './pages/AcceptInvitation';
import DoctorReports from './pages/DoctorReports';
import PersonalQR from './pages/PersonalQR';
import Warnings from './pages/Warnings';
import StudentScan from './pages/StudentScan';

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/invite/:token" element={<AcceptInvitation />} />

          <Route path="/student" element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentDashboard />
            </ProtectedRoute>
          } />

          <Route path="/student/personal-qr" element={
            <ProtectedRoute allowedRoles={['student']}>
              <PersonalQR />
            </ProtectedRoute>
          } />

          <Route path="/student/scan" element={<ProtectedRoute allowedRoles={['student']}><StudentScan /></ProtectedRoute>} />
          <Route path="/student/warnings" element={<ProtectedRoute allowedRoles={['student']}><Warnings /></ProtectedRoute>} />

          <Route path="/doctor" element={
            <ProtectedRoute allowedRoles={['doctor', 'head', 'dean']}>
              <DoctorDashboard />
            </ProtectedRoute>
          } />

          <Route path="/engineer" element={
            <ProtectedRoute allowedRoles={['engineer', 'dean']}>
              <EngineerDashboard />
            </ProtectedRoute>
          } />

          <Route path="/head" element={
            <ProtectedRoute allowedRoles={['head', 'dean']}>
              <HeadDashboard />
            </ProtectedRoute>
          } />

          <Route path="/head/pending-students" element={
            <ProtectedRoute allowedRoles={['head', 'dean']}>
              <PendingStudents />
            </ProtectedRoute>
          } />

          <Route path="/doctor/reports" element={
            <ProtectedRoute allowedRoles={['doctor', 'engineer', 'head', 'dean']}>
              <DoctorReports />
            </ProtectedRoute>
          } />

          <Route path="/dean" element={
            <ProtectedRoute allowedRoles={['dean']}>
              <DeanDashboard />
            </ProtectedRoute>
          } />

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;