import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getInvitation, acceptInvitation } from '../api/students';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import { PasswordInput } from '../components/ui/Field';
import { Alert, Loader } from '../components/ui/Feedback';
import Icon from '../components/ui/Icon';

export default function AcceptInvitation() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [invitation, setInvitation] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    loadInvitation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setDone(true);
      window.setTimeout(() => navigate('/login'), 1600);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept invitation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AuthLayout>
        <Loader label="Verifying your invitation…" />
      </AuthLayout>
    );
  }

  if (error && !invitation) {
    return (
      <AuthLayout>
        <div className="auth__head">
          <span className="eyebrow">
            <Icon name="alert" size={14} /> Invitation problem
          </span>
          <h1>This link is not valid</h1>
          <p>The invitation may have expired or already been used.</p>
        </div>
        <div className="stack">
          <Alert variant="error">{error}</Alert>
          <Button variant="secondary" block icon="arrow-left" onClick={() => navigate('/login')}>
            Back to sign in
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout>
        <div className="auth__head">
          <span className="eyebrow">
            <Icon name="check-circle" size={14} /> Account ready
          </span>
          <h1>Welcome aboard</h1>
          <p>Your account has been created. Redirecting you to sign in…</p>
        </div>
        <Alert variant="success">Account created successfully. You can now sign in.</Alert>
        <div className="row" style={{ marginTop: 18 }}>
          <span className="spinner" aria-hidden="true" />
          <span className="muted">Taking you to the login screen…</span>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth__head">
        <span className="eyebrow">
          <Icon name="mail" size={14} /> Invitation
        </span>
        <h1>You&apos;re invited</h1>
        <p>Set a secure password to activate your Smart Attendance account.</p>
      </div>

      {invitation && (
        <dl className="invite-card" style={{ marginBottom: 20 }}>
          <div className="invite-card__row">
            <dt>Name</dt>
            <dd>{invitation.full_name}</dd>
          </div>
          <div className="invite-card__row">
            <dt>Email</dt>
            <dd style={{ textTransform: 'none', fontWeight: 600 }}>{invitation.email}</dd>
          </div>
          <div className="invite-card__row">
            <dt>Role</dt>
            <dd>
              <span className="badge badge--blue">{invitation.role}</span>
            </dd>
          </div>
          {invitation.major_name && (
            <div className="invite-card__row">
              <dt>Major</dt>
              <dd>{invitation.major_name}</dd>
            </div>
          )}
        </dl>
      )}

      <form className="auth__form" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}

        <PasswordInput
          label="New password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <PasswordInput
          label="Confirm password"
          placeholder="Repeat your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />

        <Button type="submit" size="lg" block loading={submitting} icon="shield-check">
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <div className="auth__foot">
        Already activated? <Link to="/login">Sign in</Link>
      </div>
    </AuthLayout>
  );
}
