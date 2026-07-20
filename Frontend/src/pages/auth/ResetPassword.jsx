import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthLayout, { AuthLink } from './AuthLayout';
import { Input, PasswordInput } from '../../components/ui/Field';
import { Button } from '../../components/ui/Primitives';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage } from '../../lib/api';

const strongPw = (v) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(v);

export default function ResetPassword() {
  const nav = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [form, setForm] = useState({ email: location.state?.email || '', otp: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const next = {};
    if (!strongPw(form.password)) next.password = 'At least 8 characters with upper, lower and a number';
    if (form.password !== form.confirm) next.confirm = 'Passwords do not match';
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email: form.email.trim(), otp: form.otp.trim(), password: form.password });
      toast.success('Password reset. Please sign in.');
      nav('/login', { state: { email: form.email.trim() } });
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Set a new password" subtitle="Enter the code from your email and choose a new password." footer={<AuthLink to="/login">Back to sign in</AuthLink>}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Email" type="email" required value={form.email} onChange={set('email')} />
        <Input label="Reset code" value={form.otp} onChange={(e) => setForm({ ...form, otp: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="123456" required />
        <PasswordInput label="New password" required value={form.password} onChange={set('password')} error={errors.password} />
        <PasswordInput label="Confirm password" required value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
        <Button type="submit" loading={loading} className="w-full">Reset password</Button>
      </form>
    </AuthLayout>
  );
}
