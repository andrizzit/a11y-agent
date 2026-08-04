import { useState } from 'react';
import { AuditForm } from './components/AuditForm.tsx';

export function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">a11y-agent</h1>
          <p className="mt-1 text-sm text-gray-600">
            AI-powered accessibility auditor — check any URL for WCAG compliance
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <AuditForm />
      </main>
    </div>
  );
}
