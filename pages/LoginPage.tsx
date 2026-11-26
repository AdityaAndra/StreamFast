import React, { useEffect, useRef, useState } from 'react';
import { AuthShell, FormError, PasswordField, SubmitButton, TextField } from '../components/AuthForm';
import { EMAIL_RE, SIGN_IN_FAILED, USERNAME_RE, useAuth } from '../contexts/AuthContext';
import { useAppContext } from '../contexts/AppContext';
import { Link, navigate, navigateAfterAuth } from '../utils/router';

/** /login — sign in with your email or your username (Netflix's sign-in card). */
const LoginPage: React.FC<{ next: string }> = ({ next }) => {
  const { signIn, user, loading } = useAuth();
  const { setFeedback } = useAppContext();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  // Already signed in (e.g. opened /login from a bookmark): nothing to do here.
  useEffect(() => {
    if (!loading && user && !submitting.current) navigate('/', { replace: true });
  }, [loading, user]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const id = identifier.trim();
    const nextErrors: { identifier?: string; password?: string } = {};
    if (!id) nextErrors.identifier = 'Please enter your email or username.';
    else if (id.includes('@') ? !EMAIL_RE.test(id) : !USERNAME_RE.test(id)) {
      nextErrors.identifier = id.includes('@') ? 'Please enter a valid email address.' : 'Usernames are 3–20 letters, numbers, _ or .';
    }
    if (!password) nextErrors.password = 'Please enter your password.';
    setErrors(nextErrors);
    setFormError(null);
    if (nextErrors.identifier || nextErrors.password) return;

    setBusy(true);
    submitting.current = true;
    try {
      await signIn(id, password);
      setFeedback("You're signed in. Your lists and progress now sync across your devices.");
      navigateAfterAuth(next);
    } catch (err) {
      submitting.current = false;
      setFormError(err instanceof Error && err.message ? err.message : SIGN_IN_FAILED);
      setPassword('');
      setBusy(false);
    }
  };

  const signUpTo = next !== '/' ? `/signup?next=${encodeURIComponent(next)}` : '/signup';

  return (
    <AuthShell title="Sign In">
      <form onSubmit={onSubmit} noValidate>
        <FormError message={formError} />
        <TextField
          id="login-identifier"
          label="Email or username"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={254}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          error={errors.identifier}
          autoFocus
        />
        <PasswordField
          id="login-password"
          label="Password"
          autoComplete="current-password"
          maxLength={200}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <SubmitButton busy={busy}>{busy ? 'Signing In…' : 'Sign In'}</SubmitButton>
      </form>

      <div className="mt-4 text-center">
        <Link to="/forgot-password" className="text-[15px] text-white hover:underline">
          Forgot password?
        </Link>
      </div>

      <p className="mt-10 text-base text-[#b3b3b3]">
        New to StreamFast?{' '}
        <Link to={signUpTo} className="font-semibold text-white hover:underline">
          Sign up now.
        </Link>
      </p>
      <p className="mt-4 text-[13px] leading-snug text-[#8c8c8c]">
        Signing in keeps your Continue Watching, My List and settings in sync on every device. Without an account, everything stays saved in this browser.
      </p>
    </AuthShell>
  );
};

export default LoginPage;
