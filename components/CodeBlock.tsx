import React, { useState } from 'react';
import { CopyIcon, CheckStaticIcon } from './Icons';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'html' }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div className="relative group bg-[#1e1e1e] rounded-lg overflow-hidden border border-neutral-800">
      <div className="absolute top-2 right-2">
        <button
          onClick={handleCopy}
          className="flex items-center space-x-2 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
        >
          {isCopied ? <CheckStaticIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
          <span>{isCopied ? 'Copied' : 'Copy code'}</span>
        </button>
      </div>
      <div className="p-4 pt-12 sm:pt-4 overflow-x-auto text-sm font-mono text-neutral-300">
        <pre className="whitespace-pre-wrap sm:whitespace-pre break-all sm:break-normal">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};
