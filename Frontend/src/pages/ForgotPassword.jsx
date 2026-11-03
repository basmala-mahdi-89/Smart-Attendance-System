import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../api/auth';
import { useLanguage } from '../context/LanguageContext';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import { Alert } from '../components/ui/Feedback';
import Icon from '../components/ui/Icon';

export default function ForgotPassword() {
  const { lang } = useLanguage();
  const ar = lang === 'ar';

  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const value = identifier.trim();
      const payload = value.includes('@') ? { email: value } : { national_id: value };
      await requestPasswordReset(payload);
      setSent(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (ar ? 'تعذّر إرسال رابط الاستعادة. حاول مرة أخرى.' : 'Could not send the reset link. Try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout>
        <div className="auth__head anim-up">
          <span className="eyebrow">
            <Icon name="mail" size={14} /> {ar ? 'تفقّد بريدك' : 'Check your inbox'}
          </span>
          <h1>{ar ? 'رابط الاستعادة في الطريق' : 'Reset link on its way'}</h1>
          <p>
            {ar
              ? `إذا كان هناك حساب مرتبط بـ ${identifier}، فسيصلك رابط آمن لتعيين كلمة مرور جديدة.`
              : `If an account matches ${identifier}, you will receive a secure link to set a new password.`}
          </p>
        </div>

        <div className="role-hint anim-fade" style={{ marginTop: 4 }}>
          <span className="role-hint__icon">
            <Icon name="info" size={17} />
          </span>
          <div>
            <b>{ar ? 'قبل ما تفتح الرابط' : 'Before you open the link'}</b>
            <p>
              {ar
                ? 'الرابط صالح لمدة 30 دقيقة ويُستخدم مرة واحدة. لو مش لاقيه، بص في مجلد الرسائل غير المرغوبة أو تواصل مع رئيس القسم.'
                : 'The link is valid for 30 minutes and can be used once. If it is missing, check your spam folder or contact your Head of Department.'}
            </p>
          </div>
        </div>

        <div className="stack" style={{ gap: 10, marginTop: 18 }}>
          <Button
            variant="secondary"
            block
            icon="refresh"
            onClick={() => {
              setSent(false);
              setIdentifier('');
            }}
          >
            {ar ? 'جرّب بيانات تانية' : 'Try another detail'}
          </Button>
          <Link to="/login" className="btn btn--ghost btn--block">
            <Icon name="arrow-left" size={16} /> {ar ? 'رجوع لتسجيل الدخول' : 'Back to sign in'}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth__head anim-up">
        <span className="eyebrow">
          <Icon name="lock" size={14} /> {ar ? 'استعادة الحساب' : 'Account recovery'}
        </span>
        <h1>{ar ? 'نسيت كلمة المرور؟' : 'Forgot your password?'}</h1>
        <p>
          {ar
            ? 'أدخل البطاقة الوطنية أو البريد الجامعي، وهنبعتلك رابط آمن لتعيين كلمة مرور جديدة.'
            : 'Enter your national ID or university email and we will send you a secure link to choose a new password.'}
        </p>
      </div>

      <form className="auth__form" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}

        <Input
          label={ar ? 'البطاقة الوطنية أو البريد الإلكتروني' : 'National ID or email'}
          icon="id-card"
          placeholder={ar ? 'مثال: 30000000000001 أو you@university.edu' : 'e.g. 30000000000001 or you@university.edu'}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
          autoFocus
          required
        />

        <Button type="submit" size="lg" block loading={loading} icon="mail">
          {loading
            ? ar
              ? 'جارٍ الإرسال…'
              : 'Sending…'
            : ar
              ? 'أرسل رابط الاستعادة'
              : 'Send reset link'}
        </Button>
      </form>

      <div className="auth__note" style={{ marginTop: 18 }}>
        <Icon name="shield-check" size={17} />
        <span>
          {ar
            ? 'لأمانك، لا نخبرك أبداً إذا كان الحساب موجوداً أم لا. كل الطلبات تحصل على نفس الرد.'
            : 'For your security we never reveal whether an account exists. Every request gets the same response.'}
        </span>
      </div>

      <div className="auth__foot">
        {ar ? 'تفتكر كلمة المرور؟' : 'Remembered it?'}{' '}
        <Link to="/login">
          {ar ? 'سجّل الدخول' : 'Sign in'} <Icon name="arrow-right" size={13} />
        </Link>
      </div>
    </AuthLayout>
  );
}
