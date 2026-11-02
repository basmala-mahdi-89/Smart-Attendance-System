import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import { Input, PasswordInput } from '../components/ui/Field';
import { Alert } from '../components/ui/Feedback';
import Icon from '../components/ui/Icon';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';

const ROLES = [
  { key: 'student', en: 'Student', ar: 'طالب', icon: 'graduation-cap' },
  { key: 'doctor', en: 'Doctor', ar: 'دكتور', icon: 'book' },
  { key: 'engineer', en: 'Engineer', ar: 'مهندس', icon: 'settings' },
  { key: 'head', en: 'Head', ar: 'رئيس قسم', icon: 'building' },
  { key: 'dean', en: 'Dean', ar: 'العميد', icon: 'shield-check' },
];

const HINTS = {
  student: {
    icon: 'user-plus',
    title: 'First time here?',
    titleAr: 'أول مرة هنا؟',
    text: 'Create your student account, verify your email, then wait for your Head of Department to approve it.',
    textAr: 'أنشئ حساب الطالب، تحقق من بريدك الإلكتروني، ثم انتظر موافقة رئيس القسم.',
    cta: true,
  },
  doctor: {
    icon: 'book',
    title: 'Doctors join by invitation',
    titleAr: 'الدكاترة ينضمون بالدعوة',
    text: 'Sign in with the national ID and password from your invitation email. Your Head of Department then assigns your courses.',
    textAr: 'سجّل الدخول بالبطاقة الوطنية وكلمة المرور الواردة في دعوتك، ثم يخصّص لك رئيس القسم المواد.',
  },
  engineer: {
    icon: 'settings',
    title: 'Engineers join by invitation',
    titleAr: 'المهندسون ينضمون بالدعوة',
    text: 'Use the credentials from your invitation email to run sections for the courses you are assigned to.',
    textAr: 'استخدم بيانات الدعوة لإدارة السكاشن الخاصة بالمواد المسندة إليك.',
  },
  head: {
    icon: 'building',
    title: 'Heads of Department',
    titleAr: 'رؤساء الأقسام',
    text: 'Sign in with the staff credentials issued by the Dean to manage courses, invitations, approvals and reports.',
    textAr: 'سجّل الدخول ببيانات الموظف الصادرة من العميد لإدارة المواد والدعوات والموافقات والتقارير.',
  },
  dean: {
    icon: 'shield-check',
    title: 'Dean access',
    titleAr: 'دخول العميد',
    text: 'Institution-wide console for majors, staff, live sessions, analytics and audit logs.',
    textAr: 'لوحة تحكم شاملة للأقسام والموظفين والجلسات المباشرة والتحليلات وسجلات التدقيق.',
  },
};

export default function Login() {
  const [national_id, setNationalId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('student');
  const { login } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const ar = lang === 'ar';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await login(national_id, password, getDeviceFingerprint());

      // ⚡ توجيه كل Role للصفحة بتاعته
      if (user.role === 'engineer') {
        navigate('/engineer');
      } else if (user.role === 'doctor' || user.role === 'head') {
        navigate('/doctor');
      } else if (user.role === 'dean') {
        navigate('/dean');
      } else {
        navigate('/student');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const hint = HINTS[role] || HINTS.student;

  return (
    <AuthLayout>
      <div className="auth__head anim-up">
        <span className="eyebrow">
          <Icon name="sparkles" size={14} />{' '}
          {lang === 'ar' ? 'أهلاً بك في نظام الحضور' : 'Welcome to Smart Attendance'}
        </span>
        <h1>{lang === 'ar' ? 'تسجيل الدخول' : 'Sign in'}</h1>
        <p>
          {lang === 'ar'
            ? 'اختر نوع حسابك، ثم تابع باستخدام بطاقة التعريف الجامعية.'
            : 'Pick your role, then continue with the national ID issued by your university.'}
        </p>
      </div>

      <div
        className="role-picker"
        role="group"
        aria-label={lang === 'ar' ? 'اختر نوع الحساب' : 'Choose your role'}
      >
        {ROLES.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`role-chip ${role === item.key ? 'is-active' : ''}`.trim()}
            onClick={() => setRole(item.key)}
            aria-pressed={role === item.key}
          >
            <Icon name={item.icon} size={17} />
            <span>{lang === 'ar' ? item.ar : item.en}</span>
          </button>
        ))}
      </div>

      <div className="role-hint anim-fade" key={`${role}-${lang}`}>
        <span className="role-hint__icon">
          <Icon name={hint.icon} size={17} />
        </span>
        <div>
          <b>{lang === 'ar' ? hint.titleAr : hint.title}</b>
          <p>{lang === 'ar' ? hint.textAr : hint.text}</p>
          {hint.cta && (
            <Link to="/register" className="btn btn--secondary btn--sm">
              <Icon name="user-plus" size={15} />{' '}
              {lang === 'ar' ? 'أنشئ حساب طالب' : 'Create a student account'}
            </Link>
          )}
        </div>
      </div>

      <form className="auth__form" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}

        <Input
          label={lang === 'ar' ? 'البطاقة الوطنية' : 'National ID'}
          icon="id-card"
          placeholder={
            lang === 'ar' ? 'أدخل البطاقة الوطنية المكونة من 14 رقماً' : 'Enter your 14-digit national ID'
          }
          value={national_id}
          onChange={(e) => setNationalId(e.target.value)}
          inputMode="numeric"
          autoComplete="username"
          autoFocus
          required
        />

        <PasswordInput
          label={lang === 'ar' ? 'كلمة المرور' : 'Password'}
          placeholder={lang === 'ar' ? 'أدخل كلمة المرور' : 'Enter your password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        <div className="auth__meta">
          <span className="row" style={{ gap: 7 }}>
            <Icon name="lock" size={14} />
            <span className="muted">{lang === 'ar' ? 'محمي بتحقق الجهاز' : 'Protected by device verification'}</span>
          </span>
        </div>

        <Button type="submit" size="lg" block loading={loading} iconRight="arrow-right">
          {loading
            ? lang === 'ar'
              ? 'جارٍ تسجيل الدخول…'
              : 'Signing in…'
            : lang === 'ar'
              ? 'تسجيل الدخول'
              : 'Sign in'}
        </Button>
      </form>

      <div className="auth__note" style={{ marginTop: 18 }}>
        <Icon name="info" size={17} />
        <span>
          {lang === 'ar'
            ? 'يجب على الطلاب الجدد التحقق من بريدهم الإلكتروني وانتظار موافقة رئيس القسم قبل تسجيل الدخول.'
            : 'New students must verify their email and wait for the Head of Department to approve the account before signing in.'}
        </span>
      </div>

      <div className="auth__foot">
        {lang === 'ar' ? 'ليس لديك حساب؟' : "Don't have an account?"}{' '}
        <Link to="/register">
          {lang === 'ar' ? 'أنشئ حساب طالب' : 'Create a student account'}{' '}
          <Icon name="arrow-right" size={13} />
        </Link>
      </div>
    </AuthLayout>
  );
}
