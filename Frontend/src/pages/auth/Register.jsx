import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout, { AuthLink } from './AuthLayout';
import { Input } from '../../components/ui/Field';
import { Button } from '../../components/ui/Primitives';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage, fieldErrors } from '../../lib/api';

const strongPw = (v) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(v);

export default function Register() {
  const nav = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const next = {};
    if (!form.fullName.trim()) next.fullName = 'Enter your full name';
    if (!form.email.trim()) next.email = 'Enter your email';
    if (!strongPw(form.password)) next.password = 'At least 8 characters with upper, lower and a number';
    if (form.password !== form.confirm) next.confirm = 'Passwords do not match';
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await api.post('/auth/register', {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
      });
      toast.success('Account created. Check your email for a code.');
      nav('/verify-email', { state: { email: form.email.trim() } });
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start your verified admission journey."
      footer={<>Already have an account? <AuthLink to="/login">Sign in</AuthLink></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Input label="Full name" required value={form.fullName} onChange={set('fullName')} error={errors.fullName} autoComplete="name" />
        <Input label="Email" type="email" required value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" />
        <Input label="Phone" value={form.phone} onChange={set('phone')} error={errors.phone} autoComplete="tel" placeholder="080…" />
        <Input label="Password" type="password" required value={form.password} onChange={set('password')} error={errors.password} hint="8+ chars, with upper, lower and a number" autoComplete="new-password" />
        <Input label="Confirm password" type="password" required value={form.confirm} onChange={set('confirm')} error={errors.confirm} autoComplete="new-password" />
        <Button type="submit" loading={loading} className="w-full">
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
