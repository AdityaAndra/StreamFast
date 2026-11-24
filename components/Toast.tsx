import React from 'react';

/** Bottom-centre notification, replaces the old corner pop-up. */
const Toast: React.FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
      <div
        key={message}
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-md items-stretch gap-3 overflow-hidden rounded-[4px] bg-[#2f2f2f]/95 py-3 pl-0 pr-4 text-white shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-md animate-toast-in sm:w-auto"
      >
        <span className="w-1 flex-shrink-0 bg-netflix-red" aria-hidden="true" />
        <p className="text-sm leading-snug">{message}</p>
      </div>
    </div>
  );
};

export default Toast;
