import React from 'react';
import { AlertTriangleIcon, RefreshIcon } from './Icons';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ title = 'Something went wrong', message, onRetry }) => (
  <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center animate-fade-in" role="alert">
    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-netflix-red/15">
      <AlertTriangleIcon className="h-7 w-7 text-netflix-red" />
    </div>
    <h2 className="mb-2 text-2xl font-bold text-white">{title}</h2>
    <p className="mb-6 text-netflix-muted">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-[4px] bg-white px-6 py-2.5 font-bold text-black transition-colors hover:bg-white/75 active:scale-[0.97]"
      >
        <RefreshIcon className="h-4 w-4" />
        Try again
      </button>
    )}
  </div>
);

export default ErrorState;
