import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { register, getMajors } from '../api/students';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import { Input, PasswordInput, Select } from '../components/ui/Field';
import { Alert } from '../components/ui/Feedback';
import Icon from '../components/ui/Icon';
import { useLanguage } from '../context/LanguageContext';

function passwordScore(value) {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(score, 4);
}

export default function Register() {
  const { lang } = useLanguage();
  const [formData, setFormData] = useState({
    national_id: '',
    full_name: '',
    full_name_ar: '',
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
  const [majors, setMajors] = useState([]);
  const [majorsLoading, setMajorsLoading] = useState(true);
  const [majorsError, setMajorsError] = useState('');

  // Load majors by name every time the page opens, so any dean change
  // (add / rename / delete) shows up immediately.
  useEffect(() => {
    let cancelled = false;

    const loadMajors = async () => {
      setMajorsLoading(true);
      setMajorsError('');
      try {
        const list = await getMajors();
        if (cancelled) return;
        setMajors(list);
        setFormData((prev) => {
          if (!list.length) return { ...prev, major_id: '' };
          if (list.some((m) => String(m.id) === String(prev.major_id))) return prev;
          return { ...prev, major_id: String(list[0].id) };
        });
      } catch (err) {
        if (!cancelled) {
          setMajorsError(
            err.response?.data?.message ||
              (lang === 'ar' ? 'تعذّر تحميل التخصصات' : 'Could not load majors')
          );
        }
      } finally {
        if (!cancelled) setMajorsLoading(false);
      }
    };

    loadMajors();
    // Refresh when the student comes back to the tab (a dean may have changed a major meanwhile).
    const onFocus = () => loadMajors();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const score = passwordScore(formData.password);
  const mismatch =
    formData.confirm_password.length > 0 && formData.password !== formData.confirm_password;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.password !== formData.confirm_password) {
      setError(lang === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError(lang === 'ar' ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }

    if (!formData.major_id) {
      setError(lang === 'ar' ? 'اختر التخصص أولاً' : 'Please choose your major');
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
        lang === 'ar'
          ? 'تم التسجيل بنجاح! تحقق من بريدك الإلكتروني — أو من وحدة التحكم في الخادم في التطوير — لرابط التحقق.'
          : 'Registration successful! Check your email inbox — or the server console in development — for the verification link.'
      );
      console.log('Verify token:', result.verifyToken);
    } catch (err) {
      setError(err.response?.data?.message || (lang === 'ar' ? 'فشل التسجيل' : 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  const set = (key) => (e) => setFormData({ ...formData, [key]: e.target.value });

  return (
    <AuthLayout wide>
      <div className="auth__head anim-up">
        <span className="eyebrow">
          <Icon name="graduation-cap" size={14} /> {lang === 'ar' ? 'تأهيل طالب جديد' : 'Student onboarding'}
        </span>
        <h1>{lang === 'ar' ? 'أنشئ حسابك' : 'Create your account'}</h1>
        <p>{lang === 'ar' ? 'سجّل مرة واحدة، ثم انتظر موافقة رئيس القسم على قبولك.' : 'Register once, then wait for your Head of Department to approve you.'}</p>
      </div>

      <ol className="steps" aria-label="Registration steps">
        <li className="is-active">{lang === 'ar' ? 'بياناتك' : 'Your details'}</li>
        <li>{lang === 'ar' ? 'تحقق البريد' : 'Verify email'}</li>
        <li>{lang === 'ar' ? 'موافقة القسم' : 'Head approval'}</li>
      </ol>

      <form className="auth__form" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <div className="form-section">
          <div className="form-section__title">{lang === 'ar' ? 'البيانات الشخصية' : 'Personal details'}</div>
          <div className="form-grid">
            <Input
              label={lang === 'ar' ? 'البطاقة الوطنية' : 'National ID'}
              icon="id-card"
              placeholder={lang === 'ar' ? '14 رقماً' : '14 digits'}
              value={formData.national_id}
              onChange={set('national_id')}
              maxLength={14}
              inputMode="numeric"
              required
            />
            <Input
              label={lang === 'ar' ? 'الاسم الكامل' : 'Full English Name'}
              icon="user"
              placeholder={lang === 'ar' ? 'اكتب الاسم الكامل' : 'As written in university records'}
              value={formData.full_name}
              onChange={set('full_name')}
              required
            />
            <Input
              label={lang === 'ar' ? 'الاسم الكامل بالعربية' : 'Full Arabic Name'}
              icon="user"
              placeholder={lang === 'ar' ? 'اكتب الاسم بالعربية' : 'Arabic name'}
              value={formData.full_name_ar}
              onChange={set('full_name_ar')}
            />
            <Input
              label={lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}
              icon="mail"
              type="email"
              placeholder={lang === 'ar' ? 'you@university.edu' : 'you@university.edu'}
              value={formData.email}
              onChange={set('email')}
              autoComplete="email"
              required
            />
            <Input
              label={lang === 'ar' ? 'رقم الهاتف' : 'Phone'}
              icon="smartphone"
              type="tel"
              placeholder={lang === 'ar' ? '01x xxx xxxx' : '01x xxx xxxx'}
              value={formData.phone}
              onChange={set('phone')}
              autoComplete="tel"
              required
            />
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__title">{lang === 'ar' ? 'التفاصيل الأكاديمية' : 'Academic details'}</div>
          <div className="form-grid">
            <Select
              label={lang === 'ar' ? 'السنة الدراسية' : 'Academic year'}
              icon="calendar"
              value={formData.academic_year}
              onChange={set('academic_year')}
            >
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </Select>
            <Select
              label={lang === 'ar' ? 'التخصص' : 'Major'}
              icon="building"
              value={formData.major_id}
              onChange={set('major_id')}
              disabled={majorsLoading || !majors.length}
              required
              hint={
                majorsError
                  ? majorsError
                  : majorsLoading
                    ? lang === 'ar'
                      ? 'جارٍ تحميل التخصصات…'
                      : 'Loading majors…'
                    : !majors.length
                      ? lang === 'ar'
                        ? 'لا توجد تخصصات متاحة بعد — تواصل مع العميد.'
                        : 'No majors available yet — contact your dean.'
                      : lang === 'ar'
                        ? 'اختر تخصصك من القائمة.'
                        : 'Pick your department from the list.'
              }
            >
              {majorsLoading && <option value="">{lang === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}</option>}
              {!majorsLoading && !majors.length && (
                <option value="">{lang === 'ar' ? 'لا توجد تخصصات' : 'No majors available'}</option>
              )}
              {majors.map((major) => (
                <option key={major.id} value={major.id}>
                  {major.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__title">{lang === 'ar' ? 'أمان الحساب' : 'Account security'}</div>
          <div className="form-grid">
            <div>
              <PasswordInput
                label={lang === 'ar' ? 'كلمة المرور' : 'Password'}
                placeholder={lang === 'ar' ? '8 أحرف على الأقل' : 'At least 8 characters'}
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
                    {lang === 'ar'
                      ? ['ضعيف جداً', 'ضعيف', 'متوسط', 'قوي', 'ممتاز'][score]
                      : ['Very weak', 'Weak', 'Fair', 'Strong', 'Excellent'][score]}{' '}
                    {lang === 'ar' ? 'كلمة المرور' : 'password'}
                  </span>
                </>
              )}
            </div>
            <PasswordInput
              label={lang === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm password'}
              placeholder={lang === 'ar' ? 'كرر كلمة المرور' : 'Repeat your password'}
              value={formData.confirm_password}
              onChange={set('confirm_password')}
              error={mismatch ? (lang === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match') : undefined}
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        <Button type="submit" size="lg" block loading={loading} iconRight="arrow-right">
          {loading ? (lang === 'ar' ? 'جارٍ إنشاء الحساب…' : 'Creating account…') : (lang === 'ar' ? 'إنشاء الحساب' : 'Create account')}
        </Button>

        <div className="auth__note">
          <Icon name="info" size={17} />
          <span>
            {lang === 'ar'
              ? 'بعد التسجيل، تحقق من بريدك الإلكتروني وانتظر الموافقة. بمجرد الموافقة، يتم تسجيلك تلقائياً في كل مادة للتخصص والسنة الدراسية.'
              : 'After registering, verify your email and wait for approval. Once approved, you are automatically enrolled in every course for your major and academic year.'}
          </span>
        </div>
      </form>

      <div className="auth__foot">
        {lang === 'ar' ? 'لديك حساب بالفعل؟' : 'Already have an account?'}{' '}
        <Link to="/login">
          {lang === 'ar' ? 'سجّل الدخول' : 'Sign in'} <Icon name="arrow-right" size={13} />
        </Link>
      </div>
    </AuthLayout>
  );
}
