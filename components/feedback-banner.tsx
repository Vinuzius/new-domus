'use client';

import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export interface FeedbackState {
  type: 'success' | 'error';
  message: string;
}

interface FeedbackBannerProps {
  feedback: FeedbackState | null;
  onDismiss: () => void;
}

export function FeedbackBanner({ feedback, onDismiss }: FeedbackBannerProps) {
  if (!feedback) return null;

  const isSuccess = feedback.type === 'success';

  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      className={`mb-6 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
        isSuccess
          ? 'border-teal-200 bg-teal-50/70 text-teal-900'
          : 'border-red-200 bg-red-50/70 text-red-900'
      }`}
    >
      <div className="flex items-start gap-2.5">
        {isSuccess ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
        ) : (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
        )}
        <span>{feedback.message}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-current opacity-70 transition-opacity hover:opacity-100"
        aria-label="Fechar aviso"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
