import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthLayout, { AuthLink } from './AuthLayout';
import { Input, PasswordInput } from '../../components/ui/Field';
import { Button } from '../../components/ui/Primitives';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import { ROLE_HOME, ROLES } from '../../lib/constants';
import { errMessage } from '../../lib/api';

export default function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { login } = useAuth();
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      toast.success(`Welcome back, ${user.fullName.split(' ')[0]}.`);
      if (user.role === ROLES.APPLICANT) {
        nav('/onboarding', { replace: true, state: { from: location.state?.from } });
      } else {
        const dest = location.state?.from?.pathname || ROLE_HOME[user.role] || '/';
        nav(dest, { replace: true });
      }
    } catch (err) {
      const msg = errMessage(err);
      toast.error(msg);
      // If unverified, guide them to verification.
      if (/verify/i.test(msg)) nav('/verify-email', { state: { email: email.trim() } });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back to TruEntry."
      footer={<>New to TruEntry? <AuthLink to="/register">Create an account</AuthLink></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <div>
          <PasswordInput label="Password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <div className="mt-1.5 text-right">
            <AuthLink to="/forgot-password">Forgot password?</AuthLink>
          </div>
        </div>
        <Button type="submit" loading={loading} className="w-full">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
