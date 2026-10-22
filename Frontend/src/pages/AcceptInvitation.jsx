import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getInvitation, acceptInvitation } from '../api/students';

export default function AcceptInvitation() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [invitation, setInvitation] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    try {
      const data = await getInvitation(token);
      setInvitation(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await acceptInvitation(token, password);
      alert('Account created successfully! Please login.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept invitation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading invitation...</div>;

  if (error && !invitation) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Invalid Invitation</h1>
        <p style={{ color: 'red' }}>{error}</p>
        <Link to="/login">Go to Login</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h1>Accept Invitation</h1>
      
      {invitation && (
        <div style={{ background: '#f0f0f0', padding: '15px', marginBottom: '20px' }}>
          <p><b>Name:</b> {invitation.full_name}</p>
          <p><b>Email:</b> {invitation.email}</p>
          <p><b>Role:</b> {invitation.role}</p>
          {invitation.major_name && <p><b>Major:</b> {invitation.major_name}</p>}
        </div>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Confirm Password:</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>

        <button 
          type="submit" 
          disabled={submitting}
          style={{ padding: '10px 20px', background: 'green', color: 'white', border: 'none' }}
        >
          {submitting ? 'Creating account...' : 'Create Account & Login'}
        </button>
      </form>

      <p style={{ marginTop: '20px' }}>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}