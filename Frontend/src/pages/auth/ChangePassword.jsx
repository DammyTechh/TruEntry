import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import AuthLayout from './AuthLayout';
import { PasswordInput } from '../../components/ui/Field';
import { Button } from '../../components/ui/Primitives';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import { ROLE_HOME } from '../../lib/constants';
import api, { errMessage } from '../../lib/api';

const strongPw = (v) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(v);

/**
 * Shown when an account carries `mustChangePassword` — i.e. institutions
 * onboarded by an admin, signing in with a system-generated password.
 * The API blocks every other route until this completes.
 */
export default function ChangePassword() {
  const nav = useNavigate();
  const toast = useToast();
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const next = {};
    if (!form.currentPassword) next.currentPassword = 'Enter the password from your email';
    if (!strongPw(form.newPassword)) next.newPassword = 'At least 8 characters with upper, lower and a number';
    if (form.newPassword !== form.confirm) next.confirm = 'Passwords do not match';
    if (form.newPassword && form.newPassword === form.currentPassword) {
      next.newPassword = 'Choose a password different from the temporary one';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      const fresh = await refreshUser();
      toast.success('Password updated. Welcome to TruEntry.');
      nav(ROLE_HOME[fresh?.role || user?.role] || '/', { replace: true });
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Set your password"
      subtitle="For security, replace the temporary password we emailed you."
    >
      <div className="mb-5 flex gap-3 rounded-xl border border-border bg-primary-surface p-3.5">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-muted">
          You're signed in as <strong className="text-ink">{user?.email}</strong>. Choose a new password to
          unlock your dashboard.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <PasswordInput label="Temporary password" required value={form.currentPassword} onChange={set('currentPassword')} error={errors.currentPassword} autoComplete="current-password" />
        <PasswordInput label="New password" required value={form.newPassword} onChange={set('newPassword')} error={errors.newPassword} hint="8+ chars, with upper, lower and a number" autoComplete="new-password" />
        <PasswordInput label="Confirm new password" required value={form.confirm} onChange={set('confirm')} error={errors.confirm} autoComplete="new-password" />
        <Button type="submit" loading={loading} className="w-full">Update password & continue</Button>
      </form>
    </AuthLayout>
  );
}
