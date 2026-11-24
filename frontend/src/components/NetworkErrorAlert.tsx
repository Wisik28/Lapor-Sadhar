'use client';

import React from 'react';
import { AlertCircle, RefreshCw, WifiOff, X } from 'lucide-react';
import { isNetworkError } from '@/lib/networkError';

export interface NetworkErrorAlertProps {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  onDismiss?: () => void;
  retryLabel?: string;
  title?: string;
  className?: string;
}

/**
 * Alert error ramah pengguna dengan tombol Coba Lagi (Retry) untuk kegagalan jaringan/offline.
 */
export function NetworkErrorAlert({
  message,
  onRetry,
  retrying = false,
  onDismiss,
  retryLabel = 'Coba Lagi',
  title,
  className = '',
}: NetworkErrorAlertProps) {
  const networkIssue = isNetworkError(message);

  return (
    <div
      role="alert"
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 rounded-2xl bg-red-50/95 border border-red-200/90 text-red-800 text-sm shadow-2xs ${className}`}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
          {networkIssue ? (
            <WifiOff className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {title && (
            <p className="font-semibold text-red-900 text-xs uppercase tracking-wider mb-0.5">
              {title}
            </p>
          )}
          <p className="text-xs sm:text-sm text-red-700 leading-relaxed">{message}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#7A0C0C] hover:bg-[#650909] text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
            <span>{retrying ? 'Mencoba...' : retryLabel}</span>
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Tutup pesan kesalahan"
            className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
