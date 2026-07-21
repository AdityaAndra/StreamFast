import React from 'react';

interface ParameterBadgeProps {
  name: string;
  description?: string;
  type?: 'required' | 'optional';
}

export const ParameterBadge: React.FC<ParameterBadgeProps> = ({ name, description, type = 'optional' }) => {
  return (
    <div className="flex items-start space-x-3 text-sm">
      <code className="bg-neutral-800 text-teal-400 px-2 py-1 rounded text-xs font-mono whitespace-nowrap">
        {name}
      </code>
      {description && <span className="text-neutral-400 leading-snug">{description}</span>}
    </div>
  );
};
