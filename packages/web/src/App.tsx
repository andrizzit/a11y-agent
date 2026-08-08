import { useEffect, useState } from 'react';
import { AuditForm } from './components/AuditForm.tsx';

export function App() {
  const [isDark, setIsDark] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark' ||
      (savedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 transition-colors dark:bg-gray-950 dark:text-gray-100">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-4xl items-start justify-between gap-4 px-4 py-5 sm:px-6 sm:py-6">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">a11y-agent</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
              AI-powered accessibility auditor — check any URL for WCAG compliance
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsDark(value => !value)}
            className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-gray-600 dark:hover:bg-gray-800"
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            aria-pressed={isDark}
          >
            <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
            <span className="hidden sm:ml-2 sm:inline">{isDark ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8" tabIndex={-1}>
        <AuditForm />
      </main>
    </div>
  );
}
