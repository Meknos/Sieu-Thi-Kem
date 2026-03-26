'use client';

import { useState, useCallback, useEffect } from 'react';

import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

// Global state for the confirm dialog
let globalSetConfirm: ((state: ConfirmState | null) => void) | null = null;

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (globalSetConfirm) {
      globalSetConfirm({ ...options, resolve });
    } else {
      // Fallback to native confirm if component not mounted
      resolve(window.confirm(options.message));
    }
  });
}

export function ConfirmDialog() {
  const [state, setState] = useState<ConfirmState | null>(null);

  // Register global setter in effect (not during render)
  useEffect(() => {
    globalSetConfirm = setState;
    return () => { globalSetConfirm = null; };
  }, []);

  const handleConfirm = useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  if (!state) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleCancel} />

      {/* Dialog */}
      <div className="relative z-10 bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 animate-fade-in">
        <div className="flex gap-4 items-start mb-4">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            state.danger !== false ? 'bg-red-100' : 'bg-blue-100'
          }`}>
            <AlertTriangle className={`w-5 h-5 ${state.danger !== false ? 'text-red-600' : 'text-blue-600'}`} />
          </div>
          <div>
            {state.title && (
              <h3 className="font-semibold text-gray-900 mb-1">{state.title}</h3>
            )}
            <p className="text-sm text-gray-600">{state.message}</p>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            id="confirm-cancel-btn"
            onClick={handleCancel}
            className="btn btn-secondary"
          >
            {state.cancelText ?? 'Hủy'}
          </button>
          <button
            id="confirm-ok-btn"
            onClick={handleConfirm}
            className={`btn ${state.danger !== false ? 'btn-danger' : 'btn-primary'}`}
            autoFocus
          >
            {state.confirmText ?? 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}
