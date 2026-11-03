import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { resetPassword, validateResetToken } from '../api/auth';
import { useLanguage } from '../context/LanguageContext';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import { PasswordInput } from '../components/ui/Field';
import { Alert, Loader } from '../components/ui/Feedback';
import Icon from '../components/ui/Icon';

function passwordScore(value) {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(score, 4);
}

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const ar = lang === 'ar';

  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const score = passwordScore(password);
  const mismatch = confirm.length > 0 && password !== confirm;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await validateResetToken(token);
        if (mounted) setValid(!!res.valid);
      } catch {
        if (mounted) setValid(false);
      } finally {
        if (mounted) setValidating(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError(ar ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError(ar ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      window.setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (ar ? 'تعذّر تغيير كلمة المرور. جرّب رابط جديد.' : 'Could not update password. Request a new link.')
      );
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <AuthLayout>
        <Loader label={ar ? 'جارٍ التحقق من الرابط…' : 'Verifying reset link…'} />
      </AuthLayout>
    );
  }

  if (!valid) {
    return (
      <AuthLayout>
        <div className="auth__head anim-up">
          <span className="eyebrow">
            <Icon name="alert" size={14} /> {ar ? 'رابط غير صالح' : 'Link invalid'}
          </span>
          <h1>{ar ? 'هذا الرابط منتهي أو مستخدم' : 'This link is expired or used'}</h1>
          <p>
            {ar
              ? 'اطلب رابط استعادة جديد من صفحة "نسيت كلمة المرور" لنتمكن من مساعدتك.'
              : 'Request a new reset link from the "Forgot password" page to regain access.'}
          </p>
        </div>
        <div className="stack" style={{ gap: 10 }}>
          <Link to="/forgot-password" className="btn btn--primary btn--block">
            <Icon name="mail" size={16} /> {ar ? 'طلب رابط جديد' : 'Request a new link'}
          </Link>
          <Link to="/login" className="btn btn--ghost btn--block">
            <Icon name="arrow-left" size={16} /> {ar ? 'رجوع لتسجيل الدخول' : 'Back to sign in'}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout>
        <div className="auth__head anim-up">
          <span className="eyebrow">
            <Icon name="check-circle" size={14} /> {ar ? 'تم التحديث' : 'All set'}
          </span>
          <h1>{ar ? 'تم تغيير كلمة المرور بنجاح' : 'Password updated successfully'}</h1>
          <p>
            {ar
              ? 'ممكن دلوقتي تسجّل الدخول بكلمة المرور الجديدة. هتحوّلك تلقائياً.'
              : 'You can now sign in with your new password. Redirecting you to sign in…'}
          </p>
        </div>
        <Alert variant="success">
          {ar ? 'كلمة المرور اتغيرت بنجاح.' : 'Your password has been updated successfully.'}
        </Alert>
        <div className="row" style={{ marginTop: 18 }}>
          <span className="spinner" aria-hidden="true" />
          <span className="muted">{ar ? 'جاري التحويل...' : 'Taking you to sign in…'}</span>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth__head anim-up">
        <span className="eyebrow">
          <Icon name="shield-check" size={14} /> {ar ? 'حماية الحساب' : 'Secure reset'}
        </span>
        <h1>{ar ? 'ضع كلمة مرور جديدة' : 'Choose a new password'}</h1>
        <p>
          {ar
            ? 'اختار كلمة مرور قوية مكونة من 8 أحرف على الأقل، ومختلفة عن السابقة.'
            : 'Pick a strong password of at least 8 characters, different from anything you have used before.'}
        </p>
      </div>

      <form className="auth__form" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}

        <div>
          <PasswordInput
            label={ar ? 'كلمة المرور الجديدة' : 'New password'}
            placeholder={ar ? '8 أحرف على الأقل' : 'At least 8 characters'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
            required
          />
          {password && (
            <>
              <div className={`strength s${score}`} aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
              <span className="field__hint">
                {ar
                  ? ['ضعيف جداً', 'ضعيف', 'متوسط', 'قوي', 'ممتاز'][score]
                  : ['Very weak', 'Weak', 'Fair', 'Strong', 'Excellent'][score]}{' '}
                {ar ? 'قوة كلمة المرور' : 'password strength'}
              </span>
            </>
          )}
        </div>

        <PasswordInput
          label={ar ? 'تأكيد كلمة المرور' : 'Confirm new password'}
          placeholder={ar ? 'أعد كتابة كلمة المرور' : 'Re-enter your password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? (ar ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match') : undefined}
          autoComplete="new-password"
          required
        />

        <Button type="submit" size="lg" block loading={loading} icon="check-circle">
          {loading
            ? ar
              ? 'جارٍ الحفظ…'
              : 'Saving…'
            : ar
              ? 'حفظ كلمة المرور الجديدة'
              : 'Update password'}
        </Button>
      </form>

      <div className="auth__note" style={{ marginTop: 18 }}>
        <Icon name="info" size={17} />
        <span>
          {ar
            ? 'يفضّل استخدام مزيج من حروف كبيرة وصغيرة وأرقام ورموز لزيادة الأمان.'
            : 'For extra security use a mix of uppercase, lowercase, numbers and symbols.'}
        </span>
      </div>

      <div className="auth__foot">
        <Link to="/login">
          <Icon name="arrow-left" size={13} /> {ar ? 'العودة لتسجيل الدخول' : 'Back to sign in'}
        </Link>
      </div>
    </AuthLayout>
  );
}
