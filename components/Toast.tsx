import React, { useEffect, useState } from 'react';

/** Bottom-centre notification, replaces the old corner pop-up. Slides in, and fades/slides away when it ends. */
const LEAVE_MS = 220;

const Toast: React.FC<{ message: string | null }> = ({ message }) => {
  // Keep the last message on screen for the leave animation.
  const [last, setLast] = useState<string | null>(message);
  useEffect(() => {
    if (message) {
      setLast(message);
      return;
    }
    const t = window.setTimeout(() => setLast(null), LEAVE_MS);
    return () => window.clearTimeout(t);
  }, [message]);

  const text = message || last;
  if (!text) return null;
  const leaving = !message;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
      <div
        key={text}
        role="status"
        aria-live="polite"
        className={`pointer-events-auto flex w-full max-w-md items-stretch gap-3 overflow-hidden rounded-[4px] bg-[#2f2f2f]/[0.97] py-3 pl-0 pr-4 text-white shadow-[0_8px_30px_rgba(0,0,0,0.6)] sm:w-auto ${leaving ? 'sf-toast-out' : 'animate-toast-in'}`}
      >
        <span className="w-1 flex-shrink-0 bg-netflix-red" aria-hidden="true" />
        <p className="text-sm leading-snug">{text}</p>
      </div>
    </div>
  );
};

export default Toast;
