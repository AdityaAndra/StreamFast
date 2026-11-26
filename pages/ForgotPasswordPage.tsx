import React, { useState } from 'react';
import { AuthShell, FormNotice, SubmitButton, TextField } from '../components/AuthForm';
import { EMAIL_RE, useAuth } from '../contexts/AuthContext';
import { Link } from '../utils/router';

/** /forgot-password — email a password-reset link. Always shows the same message (no account lookup). */
const ForgotPasswordPage: React.FC = () => {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await sendPasswordReset(value);
    } catch {
      /* same message either way */
    }
    setBusy(false);
    setSentTo(value);
  };

  return (
    <AuthShell title="Forgot your password?">
      {sentTo ? (
        <>
          <FormNotice>
            If an account exists for <span className="font-semibold text-white">{sentTo}</span>, we've sent a link to reset your password.
            <br />
            Emails can take a few minutes to arrive. Check your spam or junk folder too.
          </FormNotice>
          <button type="button" onClick={() => setSentTo(null)} className="text-[15px] text-white hover:underline">
            Didn't get it? Send another link
          </button>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <p className="mb-5 text-[15px] leading-relaxed text-[#b3b3b3]">
            Enter the email address of your StreamFast account and we'll send you a link to choose a new password. It can take a few minutes to arrive.
          </p>
          <TextField
            id="forgot-email"
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
            autoFocus
          />
          <SubmitButton busy={busy}>{busy ? 'Sending…' : 'Email me a link'}</SubmitButton>
        </form>
      )}

      <p className="mt-10 text-base text-[#b3b3b3]">
        Remembered it?{' '}
        <Link to="/login" className="font-semibold text-white hover:underline">
          Back to Sign In.
        </Link>
      </p>
    </AuthShell>
  );
};

export default ForgotPasswordPage;
