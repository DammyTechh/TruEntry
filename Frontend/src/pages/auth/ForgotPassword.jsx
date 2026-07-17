import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout, { AuthLink } from './AuthLayout';
import { Input } from '../../components/ui/Field';
import { Button } from '../../components/ui/Primitives';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage } from '../../lib/api';

export default function ForgotPassword() {
  const nav = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      toast.info('If the account exists, a reset code has been sent.');
      nav('/reset-password', { state: { email: email.trim() } });
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a code to reset it."
      footer={<AuthLink to="/login">Back to sign in</AuthLink>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <Button type="submit" loading={loading} className="w-full">Send reset code</Button>
      </form>
    </AuthLayout>
  );
}
