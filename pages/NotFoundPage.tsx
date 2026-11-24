import React from 'react';
import { Link } from '../utils/router';

const NotFoundPage: React.FC = () => (
  <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 pt-24 text-center animate-fade-in">
    <h1 className="mb-3 text-[clamp(2rem,4vw,3.5rem)] font-bold tracking-[-0.02em] text-white">Lost your way?</h1>
    <p className="mb-8 max-w-md text-lg text-netflix-muted">Sorry, we can't find that page. You'll find lots to explore on the home page.</p>
    <Link to="/" className="nf-btn nf-btn-white">StreamFast Home</Link>
  </div>
);

export default NotFoundPage;
