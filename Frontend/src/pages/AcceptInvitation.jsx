import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getInvitation, acceptInvitation } from '../api/students';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import { PasswordInput, Input } from '../components/ui/Field';
import { Alert, Loader } from '../components/ui/Feedback';
import Icon from '../components/ui/Icon';
import { useLanguage } from '../context/LanguageContext';

export default function AcceptInvitation() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { lang } = useLanguage();

  const [invitation, setInvitation] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [fullNameAr, setFullNameAr] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
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
      setError(err.response?.data?.message || (lang === 'ar' ? 'دعوة غير صالحة أو منتهية الصلاحية' : 'Invalid or expired invitation'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError(lang === 'ar' ? 'الاسم (إنجليزي) مطلوب' : 'Full English name is required');
      return;
    }
    if (!nationalId.trim()) {
      setError(lang === 'ar' ? 'البطاقة الوطنية مطلوبة' : 'National ID is required');
      return;
    }
    if (password.length < 8) {
      setError(lang === 'ar' ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError(lang === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await acceptInvitation(token, {
        password,
        full_name: fullName,
        full_name_ar: fullNameAr,
        national_id: nationalId,
        phone,
      });
      setDone(true);
      window.setTimeout(() => navigate('/login'), 1600);
    } catch (err) {
      setError(err.response?.data?.message || (lang === 'ar' ? 'فشل قبول الدعوة' : 'Failed to accept invitation'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AuthLayout>
        <Loader label={lang === 'ar' ? 'جارٍ التحقق من دعوتك…' : 'Verifying your invitation…'} />
      </AuthLayout>
    );
  }

  if (error && !invitation) {
    return (
      <AuthLayout>
        <div className="auth__head">
          <span className="eyebrow">
            <Icon name="alert" size={14} /> {lang === 'ar' ? 'مشكلة في الدعوة' : 'Invitation problem'}
          </span>
          <h1>{lang === 'ar' ? 'هذا الرابط غير صالح' : 'This link is not valid'}</h1>
          <p>{lang === 'ar' ? 'ربما انتهت صلاحية الدعوة أو تم استخدامها بالفعل.' : 'The invitation may have expired or already been used.'}</p>
        </div>
        <div className="stack">
          <Alert variant="error">{error}</Alert>
          <Button variant="secondary" block icon="arrow-left" onClick={() => navigate('/login')}>
            {lang === 'ar' ? 'العودة إلى تسجيل الدخول' : 'Back to sign in'}
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
            <Icon name="check-circle" size={14} /> {lang === 'ar' ? 'الحساب جاهز' : 'Account ready'}
          </span>
          <h1>{lang === 'ar' ? 'أهلاً بك' : 'Welcome aboard'}</h1>
          <p>{lang === 'ar' ? 'تم إنشاء حسابك. سيتم تحويلك إلى تسجيل الدخول…' : 'Your account has been created. Redirecting you to sign in…'}</p>
        </div>
        <Alert variant="success">{lang === 'ar' ? 'تم إنشاء الحساب بنجاح. يمكنك الآن تسجيل الدخول.' : 'Account created successfully. You can now sign in.'}</Alert>
        <div className="row" style={{ marginTop: 18 }}>
          <span className="spinner" aria-hidden="true" />
          <span className="muted">{lang === 'ar' ? 'جارٍ تحويلك إلى شاشة تسجيل الدخول…' : 'Taking you to the login screen…'}</span>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth__head">
        <span className="eyebrow">
          <Icon name="mail" size={14} /> {lang === 'ar' ? 'دعوة' : 'Invitation'}
        </span>
        <h1>{lang === 'ar' ? 'لقد تمت دعوتك' : "You're invited"}</h1>
        <p>{lang === 'ar' ? 'أنشئ كلمة مرور آمنة لتفعيل حسابك في منصة الحضور.' : 'Set a secure password to activate your Smart Attendance account.'}</p>
      </div>

      {invitation && (
        <dl className="invite-card" style={{ marginBottom: 20 }}>
          <div className="invite-card__row">
            <dt>{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</dt>
            <dd style={{ textTransform: 'none', fontWeight: 600 }}>{invitation.email}</dd>
          </div>
          <div className="invite-card__row">
            <dt>{lang === 'ar' ? 'الدور' : 'Role'}</dt>
            <dd>
              <span className="badge badge--blue">{invitation.role}</span>
            </dd>
          </div>
          {invitation.major_name && (
            <div className="invite-card__row">
              <dt>{lang === 'ar' ? 'التخصص' : 'Major'}</dt>
              <dd>{invitation.major_name}</dd>
            </div>
          )}
        </dl>
      )}

      <form className="auth__form" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}

        <Input
          label={lang === 'ar' ? 'الاسم (إنجليزي)' : 'Full English Name'}
          icon="user"
          placeholder={lang === 'ar' ? 'اكتب الاسم بالإنجليزية' : 'As written in university records'}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <Input
          label={lang === 'ar' ? 'الاسم (عربي)' : 'Full Arabic Name'}
          icon="user"
          placeholder={lang === 'ar' ? 'اكتب الاسم بالعربية' : 'Arabic name'}
          value={fullNameAr}
          onChange={(e) => setFullNameAr(e.target.value)}
        />
        <Input
          label={lang === 'ar' ? 'البطاقة الوطنية' : 'National ID'}
          icon="id-card"
          placeholder={lang === 'ar' ? '14 رقماً' : '14 digits'}
          inputMode="numeric"
          value={nationalId}
          onChange={(e) => setNationalId(e.target.value)}
          required
        />
        <Input
          label={lang === 'ar' ? 'رقم الهاتف' : 'Phone'}
          icon="smartphone"
          type="tel"
          placeholder={lang === 'ar' ? '01x xxx xxxx' : '01x xxx xxxx'}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <PasswordInput
          label={lang === 'ar' ? 'كلمة المرور الجديدة' : 'New password'}
          placeholder={lang === 'ar' ? '8 أحرف على الأقل' : 'At least 8 characters'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <PasswordInput
          label={lang === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm password'}
          placeholder={lang === 'ar' ? 'كرر كلمة المرور الجديدة' : 'Repeat your new password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />

        <Button type="submit" size="lg" block loading={submitting} icon="shield-check">
          {submitting ? (lang === 'ar' ? 'جارٍ إنشاء الحساب…' : 'Creating account…') : lang === 'ar' ? 'إنشاء الحساب' : 'Create account'}
        </Button>
      </form>

      <div className="auth__foot">
        {lang === 'ar' ? 'تم التفعيل بالفعل؟' : 'Already activated?'} <Link to="/login">{lang === 'ar' ? 'تسجيل الدخول' : 'Sign in'}</Link>
      </div>
    </AuthLayout>
  );
}
