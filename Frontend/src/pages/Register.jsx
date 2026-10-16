import { useState } from 'react';
import { Link } from 'react-router-dom';
import { register } from '../api/students';

export default function Register() {
  const [formData, setFormData] = useState({
    national_id: '',
    full_name: '',
    email: '',
    phone: '',
    academic_year: '1',
    major_id: '',
    password: '',
    confirm_password: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const { confirm_password, ...data } = formData;
      const result = await register({
        ...data,
        academic_year: String(data.academic_year),
        major_id: parseInt(data.major_id)
      });
      setSuccess('Registration successful! Check terminal for verification link.');
      console.log('Verify token:', result.verifyToken);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Register</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}

      <form onSubmit={handleSubmit}>
        <input
          placeholder="National ID (14 digits)"
          value={formData.national_id}
          onChange={(e) => setFormData({...formData, national_id: e.target.value})}
          maxLength={14}
          required
        />
        <input
          placeholder="Full Name"
          value={formData.full_name}
          onChange={(e) => setFormData({...formData, full_name: e.target.value})}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          required
        />
        <input
          placeholder="Phone"
          value={formData.phone}
          onChange={(e) => setFormData({...formData, phone: e.target.value})}
          required
        />
        <select
          value={formData.academic_year}
          onChange={(e) => setFormData({...formData, academic_year: e.target.value})}
        >
          <option value="1">Year 1</option>
          <option value="2">Year 2</option>
          <option value="3">Year 3</option>
          <option value="4">Year 4</option>
        </select>
        <input
          type="number"
          placeholder="Major ID"
          value={formData.major_id}
          onChange={(e) => setFormData({...formData, major_id: e.target.value})}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={formData.password}
          onChange={(e) => setFormData({...formData, password: e.target.value})}
          required
        />
        <input
          type="password"
          placeholder="Confirm Password"
          value={formData.confirm_password}
          onChange={(e) => setFormData({...formData, confirm_password: e.target.value})}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Register'}
        </button>
      </form>

      <p>Already have an account? <Link to="/login">Login</Link></p>
    </div>
  );
}