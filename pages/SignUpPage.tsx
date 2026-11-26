import React, { useEffect, useRef, useState } from 'react';
import { AuthShell, FormError, FormNotice, PasswordField, SubmitButton, TextField } from '../components/AuthForm';
import { CheckStaticIcon, SpinnerIcon } from '../components/Icons';
import { EMAIL_RE, USERNAME_RE, useAuth } from '../contexts/AuthContext';
import { useAppContext } from '../contexts/AppContext';
import { Link, navigate, navigateAfterAuth } from '../utils/router';

type Field = 'username' | 'email' | 'password' | 'confirm';
type NameCheck = 'idle' | 'checking' | 'available' | 'taken';

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72; // Supabase (bcrypt) ignores anything longer

/** /signup — create an account (username, email, password). */
const SignUpPage: React.FC<{ next: string }> = ({ next }) => {
  const { signUp, isUsernameAvailable, user, loading } = useAuth();
  const { setFeedback } = useAppContext();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nameCheck, setNameCheck] = useState<NameCheck>('idle');
  const submitting = useRef(false);

  useEffect(() => {
    if (!loading && user && !submitting.current) navigate('/', { replace: true });
  }, [loading, user]);

  // Check the username while you type (after a short pause).
  useEffect(() => {
    const name = username.trim();
    if (!USERNAME_RE.test(name)) {
      setNameCheck('idle');
      return;
    }
    let alive = true;
    setNameCheck('checking');
    const t = window.setTimeout(() => {
      void isUsernameAvailable(name).then((ok) => {
        if (alive) setNameCheck(ok === null ? 'idle' : ok ? 'available' : 'taken');
      });
    }, 450);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [username, isUsernameAvailable]);

  const validate = (): Partial<Record<Field, string>> => {
    const e: Partial<Record<Field, string>> = {};
    const name = username.trim();
    if (!name) e.username = 'Please choose a username.';
    else if (!USERNAME_RE.test(name)) e.username = 'Use 3–20 characters: letters, numbers, _ or .';
    else if (nameCheck === 'taken') e.username = 'That username is taken';
    if (!EMAIL_RE.test(email.trim())) e.email = 'Please enter a valid email address.';
    if (password.length < MIN_PASSWORD) e.password = `Your password must have at least ${MIN_PASSWORD} characters.`;
    else if (password.length > MAX_PASSWORD) e.password = `Your password can have at most ${MAX_PASSWORD} characters.`;
    if (!confirm) e.confirm = 'Please type your password again.';
    else if (confirm !== password) e.confirm = "The passwords don't match.";
    return e;
  };

  const onSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (busy) return;
    setFormError(null);
    setNotice(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    const name = username.trim();
    setBusy(true);
    submitting.current = true;
    try {
      const available = await isUsernameAvailable(name);
      if (available === false) {
        setNameCheck('taken');
        setErrors({ username: 'That username is taken' });
        submitting.current = false;
        setBusy(false);
        return;
      }
      const { confirmEmail } = await signUp(name, email, password);
      if (confirmEmail) {
        submitting.current = false;
        setBusy(false);
        setNotice('Almost done: check your email and open the link to confirm your account, then sign in. Emails can take a few minutes to arrive.');
        return;
      }
      setFeedback(`Welcome to StreamFast, ${name}! Your lists and progress now sync across your devices.`);
      navigateAfterAuth(next);
    } catch (err) {
      submitting.current = false;
      const message = err instanceof Error && err.message ? err.message : "We couldn't create your account. Please try again.";
      if (/username is taken/i.test(message)) {
        setNameCheck('taken');
        setErrors({ username: 'That username is taken' });
      } else setFormError(message);
      setBusy(false);
    }
  };

  const nameHint =
    nameCheck === 'checking' ? (
      <>
        <SpinnerIcon className="mt-0.5 h-3 w-3 flex-shrink-0" />
        <span>Checking…</span>
      </>
    ) : nameCheck === 'available' ? (
      <>
        <CheckStaticIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-netflix-green" />
        <span className="text-netflix-green">That username is available</span>
      </>
    ) : (
      <span>3–20 characters: letters, numbers, _ or . (this is what you can sign in with)</span>
    );

  const signInTo = next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login';

  return (
    <AuthShell title="Create your account">
      <form onSubmit={onSubmit} noValidate>
        <FormError message={formError} />
        {notice && <FormNotice>{notice}</FormNotice>}
        <TextField
          id="signup-username"
          label="Username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={20}
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            if (errors.username) setErrors((x) => ({ ...x, username: undefined }));
          }}
          error={errors.username || (nameCheck === 'taken' ? 'That username is taken' : null)}
          hint={nameHint}
          autoFocus
        />
        <TextField
          id="signup-email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <PasswordField
          id="signup-password"
          label="Password"
          autoComplete="new-password"
          maxLength={MAX_PASSWORD}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={`At least ${MIN_PASSWORD} characters.`}
        />
        <PasswordField
          id="signup-confirm"
          label="Confirm password"
          autoComplete="new-password"
          maxLength={MAX_PASSWORD}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
        />
        <SubmitButton busy={busy}>{busy ? 'Creating account…' : 'Create account'}</SubmitButton>
      </form>

      <p className="mt-10 text-base text-[#b3b3b3]">
        Already have an account?{' '}
        <Link to={signInTo} className="font-semibold text-white hover:underline">
          Sign in.
        </Link>
      </p>
      <p className="mt-4 text-[13px] leading-snug text-[#8c8c8c]">
        Anything already saved in this browser (Continue Watching, My List, settings) is added to your new account.
      </p>
    </AuthShell>
  );
};

export default SignUpPage;
