'use client';

import { Toaster } from 'sonner';

/**
 * Global client providers.
 *
 * Intentionally thin: theme handling lives in the theme script below so there
 * is no flash of the wrong colour scheme on first paint.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast: 'font-sans',
          },
        }}
      />
    </>
  );
}

/**
 * Runs before paint to apply the stored theme. Inlined so it executes before
 * React hydrates and prevents a light/dark flash.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem('sat7-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`;