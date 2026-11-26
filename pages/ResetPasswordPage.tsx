import React, { useState } from 'react';
import { AuthShell, FormError, FormNotice, PasswordField, SubmitButton } from '../components/AuthForm';
import { SpinnerIcon } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { useAppContext } from '../contexts/AppContext';
import { authLinkError } from '../services/supabase';
import { Link, navigate } from '../utils/router';

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;

/** /reset-password — the link in the reset email lands here (Supabase signs you in for recovery). */
const ResetPasswordPage: React.FC = () => {
  const { session, loading, recovery, updatePassword } = useAuth();
  const { setFeedback } = useAppContext();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const found: { password?: string; confirm?: string } = {};
    if (password.length < MIN_PASSWORD) found.password = `Your password must have at least ${MIN_PASSWORD} characters.`;
    else if (password.length > MAX_PASSWORD) found.password = `Your password can have at most ${MAX_PASSWORD} characters.`;
    if (!confirm) found.confirm = 'Please type your new password again.';
    else if (confirm !== password) found.confirm = "The passwords don't match.";
    setErrors(found);
    setFormError(null);
    if (found.password || found.confirm) return;
    setBusy(true);
    try {
      await updatePassword(password);
      setFeedback('Your password has been changed.');
      navigate('/', { replace: true });
    } catch (err) {
      setFormError(err instanceof Error && err.message ? err.message : "We couldn't change your password. Please try again.");
      setBusy(false);
    }
  };

  if (loading && !session) {
    return (
      <AuthShell title="Reset password">
        <p className="flex items-center gap-3 text-[15px] text-[#b3b3b3]">
          <SpinnerIcon className="h-5 w-5" />
          Checking your link…
        </p>
      </AuthShell>
    );
  }

  if (!session) {
    return (
      <AuthShell title="Reset password">
        {authLinkError ? (
          <FormError message="This password reset link is invalid or has expired. Links work once and only for a limited time." />
        ) : (
          <FormNotice>To choose a new password, open the link in the email we sent you. If you don't have one, ask for a new link.</FormNotice>
        )}
        <Link to="/forgot-password" className="mt-2 flex h-11 w-full items-center justify-center rounded bg-netflix-red text-base font-semibold text-white transition-colors hover:bg-[#c11119]">
          Get a new link
        </Link>
        <p className="mt-8 text-base text-[#b3b3b3]">
          <Link to="/login" className="font-semibold text-white hover:underline">
            Back to Sign In.
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={recovery ? 'Choose a new password' : 'Change password'}>
      <form onSubmit={onSubmit} noValidate>
        <FormError message={formError} />
        <PasswordField
          id="reset-password"
          label="New password"
          autoComplete="new-password"
          maxLength={MAX_PASSWORD}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={`At least ${MIN_PASSWORD} characters.`}
          autoFocus
        />
        <PasswordField
          id="reset-confirm"
          label="Confirm new password"
          autoComplete="new-password"
          maxLength={MAX_PASSWORD}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
        />
        <SubmitButton busy={busy}>{busy ? 'Saving…' : 'Save password'}</SubmitButton>
      </form>
    </AuthShell>
  );
};

export default ResetPasswordPage;
