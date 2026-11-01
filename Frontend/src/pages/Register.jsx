import { useState } from 'react';
import { Link } from 'react-router-dom';
import { register } from '../api/students';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import { Input, PasswordInput, Select } from '../components/ui/Field';
import { Alert } from '../components/ui/Feedback';
import Icon from '../components/ui/Icon';

function passwordScore(value) {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(score, 4);
}

export default function Register() {
  const [formData, setFormData] = useState({
    national_id: '',
    full_name: '',
    email: '',
    phone: '',
    academic_year: '1',
    major_id: '',
    password: '',
    confirm_password: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const score = passwordScore(formData.password);
  const mismatch =
    formData.confirm_password.length > 0 && formData.password !== formData.confirm_password;

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
        major_id: parseInt(data.major_id),
      });
      setSuccess(
        'Registration successful! Check your email inbox — or the server console in development — for the verification link.'
      );
      console.log('Verify token:', result.verifyToken);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const set = (key) => (e) => setFormData({ ...formData, [key]: e.target.value });

  return (
    <AuthLayout wide>
      <div className="auth__head">
        <span className="eyebrow">
          <Icon name="graduation-cap" size={14} /> Student onboarding
        </span>
        <h1>Create your account</h1>
        <p>Register once, then wait for your Head of Department to approve you.</p>
      </div>

      <form className="auth__form" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <div className="form-section">
          <div className="form-section__title">Personal details</div>
          <div className="form-grid">
            <Input
              label="National ID"
              icon="id-card"
              placeholder="14 digits"
              value={formData.national_id}
              onChange={set('national_id')}
              maxLength={14}
              inputMode="numeric"
              required
            />
            <Input
              label="Full English Name"
              icon="user"
              placeholder="As written in university records"
              value={formData.full_name}
              onChange={set('full_name')}
              required
            />
            <Input
              label="Email"
              icon="mail"
              type="email"
              placeholder="you@university.edu"
              value={formData.email}
              onChange={set('email')}
              autoComplete="email"
              required
            />
            <Input
              label="Phone"
              icon="smartphone"
              type="tel"
              placeholder="01x xxx xxxx"
              value={formData.phone}
              onChange={set('phone')}
              autoComplete="tel"
              required
            />
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__title">Academic details</div>
          <div className="form-grid">
            <Select label="Academic year" icon="calendar" value={formData.academic_year} onChange={set('academic_year')}>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </Select>
            <Input
              label="Major ID"
              icon="building"
              type="number"
              min="1"
              placeholder="e.g. 3"
              hint="Ask your department for your Major ID."
              value={formData.major_id}
              onChange={set('major_id')}
              required
            />
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__title">Account security</div>
          <div className="form-grid">
            <div>
              <PasswordInput
                label="Password"
                placeholder="At least 8 characters"
                value={formData.password}
                onChange={set('password')}
                autoComplete="new-password"
                required
              />
              {formData.password && (
                <>
                  <div className={`strength s${score}`} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="field__hint">
                    {['Very weak', 'Weak', 'Fair', 'Strong', 'Excellent'][score]} password
                  </span>
                </>
              )}
            </div>
            <PasswordInput
              label="Confirm password"
              placeholder="Repeat your password"
              value={formData.confirm_password}
              onChange={set('confirm_password')}
              error={mismatch ? 'Passwords do not match' : undefined}
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        <Button type="submit" size="lg" block loading={loading} iconRight="arrow-right">
          {loading ? 'Creating account…' : 'Create account'}
        </Button>

        <div className="auth__note">
          <Icon name="info" size={17} />
          <span>
            After registering, verify your email and wait for approval. Once approved, you
            are automatically enrolled in every course for your major and academic year.
          </span>
        </div>
      </form>

      <div className="auth__foot">
        Already have an account? <Link to="/login">Sign in</Link>
      </div>
    </AuthLayout>
  );
}
