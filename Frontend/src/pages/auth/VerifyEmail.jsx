import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthLayout, { AuthLink } from './AuthLayout';
import { Input } from '../../components/ui/Field';
import { Button } from '../../components/ui/Primitives';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage } from '../../lib/api';

export default function VerifyEmail() {
  const nav = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [email, setEmail] = useState(location.state?.email || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/verify-email', { email: email.trim(), otp: otp.trim() });
      toast.success('Email verified. You can now sign in.');
      nav('/login', { state: { email: email.trim() } });
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!email.trim()) return toast.error('Enter your email first');
    try {
      await api.post('/auth/resend-otp', { email: email.trim() });
      toast.info('A new code has been sent if the account exists.');
      setCooldown(45);
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="Enter the 6-digit code we sent to your inbox."
      footer={<AuthLink to="/login">Back to sign in</AuthLink>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input
          label="Verification code"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          placeholder="123456"
          className="tracking-[0.5em] text-center text-lg"
          required
        />
        <Button type="submit" loading={loading} className="w-full">
          Verify email
        </Button>
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0}
          className="w-full text-sm text-muted hover:text-primary disabled:opacity-50"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
      </form>
    </AuthLayout>
  );
}
