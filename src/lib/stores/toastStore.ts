import { writable } from 'svelte/store';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
  label: string; // e.g. "Deshacer"
  onClick: () => void | Promise<void>;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number; // in milliseconds, default 4000
  action?: ToastAction;
  createdAt: number;
}

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  action?: ToastAction;
}

export const DEFAULT_TOAST_DURATION = 4000;
export const MAX_CONCURRENT_TOASTS = 3;

function createToastStore() {
  const { subscribe, update, set } = writable<Toast[]>([]);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function generateId(): string {
    return 'toast_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  function dismiss(id: string): void {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    update(toasts => toasts.filter(t => t.id !== id));
  }

  function show(options: ToastOptions | string): string {
    const opts: ToastOptions = typeof options === 'string' ? { message: options } : options;
    const id = generateId();
    const duration = opts.duration ?? DEFAULT_TOAST_DURATION;

    const toast: Toast = {
      id,
      message: opts.message,
      type: opts.type ?? 'info',
      duration,
      action: opts.action,
      createdAt: Date.now()
    };

    update(toasts => {
      const next = [...toasts, toast];
      if (next.length > MAX_CONCURRENT_TOASTS) {
        const removed = next.shift();
        if (removed) {
          const t = timers.get(removed.id);
          if (t) {
            clearTimeout(t);
            timers.delete(removed.id);
          }
        }
      }
      return next;
    });

    if (duration > 0 && duration !== Infinity) {
      const timer = setTimeout(() => {
        dismiss(id);
      }, duration);
      timers.set(id, timer);
    }

    return id;
  }

  function undo(message: string, onUndo: () => void | Promise<void>, duration = DEFAULT_TOAST_DURATION): string {
    return show({
      message,
      type: 'info',
      duration,
      action: {
        label: 'Deshacer',
        onClick: onUndo
      }
    });
  }

  function clear(): void {
    timers.forEach(t => clearTimeout(t));
    timers.clear();
    set([]);
  }

  return {
    subscribe,
    show,
    dismiss,
    clear,
    success: (msg: string, dur?: number) => show({ message: msg, type: 'success', duration: dur }),
    error: (msg: string, dur?: number) => show({ message: msg, type: 'error', duration: dur }),
    warning: (msg: string, dur?: number) => show({ message: msg, type: 'warning', duration: dur }),
    info: (msg: string, dur?: number) => show({ message: msg, type: 'info', duration: dur }),
    undo
  };
}

export const toastStore = createToastStore();
