import React, { useState } from 'react';
import { AlertTriangleIcon, EyeIcon, EyeOffIcon, SpinnerIcon } from './Icons';

/* Shared look for the account pages (Netflix's sign-in card on StreamFast's dark background). */

export const AuthShell: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="relative flex min-h-[78vh] items-start justify-center px-4 pb-10 pt-24 sm:pt-32">
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(229,9,20,0.16),transparent_62%)]"
    />
    <div className="relative w-full max-w-[450px] rounded-md bg-black/75 px-6 py-10 shadow-2xl shadow-black/70 ring-1 ring-white/10 animate-fade-in-up sm:px-14 sm:py-12">
      <h1 className="mb-7 text-[2rem] font-bold leading-tight text-white">{title}</h1>
      {children}
    </div>
  </div>
);

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'className' | 'placeholder'>;

interface FieldProps extends InputProps {
  id: string;
  label: string;
  error?: string | null;
  hint?: React.ReactNode;
  /** extra control inside the box, on the right (e.g. show / hide password) */
  trailing?: React.ReactNode;
}

/** Netflix-style input: the label sits inside the box and moves up when you type. */
export const TextField = React.forwardRef<HTMLInputElement, FieldProps>(({ id, label, error, hint, trailing, ...rest }, ref) => {
  const describedBy = error || hint ? `${id}-desc` : undefined;
  return (
    <div className="mb-4">
      <div className="relative">
        <input
          ref={ref}
          id={id}
          placeholder=" "
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`peer block h-14 w-full rounded border bg-[#161616]/70 px-4 pb-1.5 pt-5 text-base text-white transition-colors duration-150 focus:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#1f1f1f] [&:-webkit-autofill]:[-webkit-text-fill-color:#fff] ${
            trailing ? 'pr-12' : ''
          } ${error ? 'border-netflix-red' : 'border-[#808080]/70'}`}
          {...rest}
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute left-4 top-1.5 text-xs text-[#b3b3b3] transition-all duration-150 peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-1.5 peer-focus:text-xs"
        >
          {label}
        </label>
        {trailing}
      </div>
      {describedBy && (
        <p id={describedBy} className={`mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug ${error ? 'text-[#ff6b6b]' : 'text-[#8c8c8c]'}`}>
          {error ? (
            <>
              <AlertTriangleIcon className="mt-px h-3.5 w-3.5 flex-shrink-0" />
              <span>{error}</span>
            </>
          ) : (
            hint
          )}
        </p>
      )}
    </div>
  );
});
TextField.displayName = 'TextField';

/** Password input with a show / hide button. */
export const PasswordField = React.forwardRef<HTMLInputElement, Omit<FieldProps, 'type' | 'trailing'>>((props, ref) => {
  const [show, setShow] = useState(false);
  return (
    <TextField
      ref={ref}
      {...props}
      type={show ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded text-[#b3b3b3] transition-colors hover:text-white"
        >
          {show ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      }
    />
  );
});
PasswordField.displayName = 'PasswordField';

/** Error banner at the top of a form. */
export const FormError: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div role="alert" className="mb-5 flex items-start gap-3 rounded border border-netflix-red/40 bg-netflix-red/15 px-4 py-3 text-sm leading-snug text-[#ffd2d2] animate-fade-in-fast">
      <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#ff6b6b]" />
      <span>{message}</span>
    </div>
  ) : null;

/** Neutral / success message box. */
export const FormNotice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div role="status" className="mb-5 rounded border border-white/15 bg-white/[0.06] px-4 py-3 text-sm leading-relaxed text-netflix-text animate-fade-in-fast">
    {children}
  </div>
);

/** The red Netflix button. */
export const SubmitButton: React.FC<{ busy?: boolean; children: React.ReactNode }> = ({ busy, children }) => (
  <button
    type="submit"
    disabled={busy}
    aria-busy={busy || undefined}
    className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded bg-netflix-red text-base font-semibold text-white transition-colors duration-150 hover:bg-[#c11119] active:scale-[0.99] disabled:cursor-wait disabled:opacity-75"
  >
    {busy && <SpinnerIcon className="h-4 w-4" />}
    {children}
  </button>
);
