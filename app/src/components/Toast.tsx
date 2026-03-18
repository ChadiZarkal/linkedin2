'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  exiting?: boolean;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let _nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = _nextId++;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 4000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const colors: Record<ToastType, string> = {
    success: 'bg-green-500/20 border-green-500/40 text-green-400',
    error: 'bg-red-500/20 border-red-500/40 text-red-400',
    info: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
    warning: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400',
  };
  const icons: Record<ToastType, string> = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
  };

  return (
    <div
      className={`${toast.exiting ? 'animate-slideOutRight' : 'animate-slideInRight'} 
        flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm ${colors[toast.type]}
        shadow-lg min-w-[280px] max-w-[400px]`}
    >
      <span>{icons[toast.type]}</span>
      <span className="text-sm flex-1">{toast.message}</span>
      <button onClick={onClose} className="text-current opacity-60 hover:opacity-100 text-lg leading-none">&times;</button>
    </div>
  );
}
