import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import { Input, PasswordInput } from '../components/ui/Field';
import { Alert } from '../components/ui/Feedback';
import Icon from '../components/ui/Icon';
import { useLanguage } from '../context/LanguageContext';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';

export default function Login() {
  const [national_id, setNationalId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();

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

  return (
    <AuthLayout>
      <div className="auth__head">
        <span className="eyebrow">
          <Icon name="shield-check" size={14} /> {lang === 'ar' ? 'دخول آمن' : 'Secure sign in'}
        </span>
        <h1>{lang === 'ar' ? 'أهلاً بعودتك' : 'Welcome back'}</h1>
        <p>{lang === 'ar' ? 'سجّل الدخول ببطاقة التعريف الوطنية الجامعية لمتابعة.' : 'Sign in with your university national ID to continue.'}</p>
      </div>

      <form className="auth__form" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}

        <Input
          label={lang === 'ar' ? 'البطاقة الوطنية' : 'National ID'}
          icon="id-card"
          placeholder={lang === 'ar' ? 'أدخل البطاقة الوطنية المكونة من 14 رقماً' : 'Enter your 14-digit national ID'}
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
          {loading ? (lang === 'ar' ? 'جارٍ تسجيل الدخول…' : 'Signing in…') : (lang === 'ar' ? 'تسجيل الدخول' : 'Sign in')}
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
        {lang === 'ar' ? 'ليس لديك حساب؟' : 'Don&apos;t have an account?'}{' '}
        <Link to="/register">{lang === 'ar' ? 'أنشئ حساب طالباً' : 'Create a student account'}</Link>
      </div>
    </AuthLayout>
  );
}
