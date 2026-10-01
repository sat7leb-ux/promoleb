'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import type { Permission } from '@/lib/auth/permissions';

const STORAGE_KEY = 'sat7-sidebar-collapsed';

/** Lets the topbar's hamburger button drive the sidebar's mobile drawer. */
const MobileNavContext = createContext<{ open: () => void }>({ open: () => {} });

export function useMobileNav() {
  return useContext(MobileNavContext);
}

/**
 * Client shell around the sidebar.
 *
 * Collapse state is persisted in localStorage. The server renders the expanded
 * state and this component corrects it after mount — reading localStorage during
 * render would cause a hydration mismatch.
 */
export function AppShell({
  permission,
  unreadNotifications,
  topbar,
  children,
}: {
  permission: Permission;
  unreadNotifications: number;
  topbar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === 'true');
    } catch {
      /* storage unavailable — stay expanded */
    }
  }, []);

  const handleCollapse = useCallback((next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
  }, []);

  const mobileNav = useMemo(() => ({ open: () => setMobileOpen(true) }), []);

  return (
    <MobileNavContext.Provider value={mobileNav}>
      <div className="min-h-screen">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to content
        </a>

        <AppSidebar
          permission={permission}
          unreadNotifications={unreadNotifications}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          collapsed={collapsed}
          onCollapsedChange={handleCollapse}
        />

        <div
          className={`flex min-h-screen flex-col transition-[padding] duration-200 ${
            collapsed ? 'lg:pl-16' : 'lg:pl-64'
          }`}
        >
          {topbar}

          <main id="main-content" className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
            <div className="mx-auto w-full max-w-[1600px]">{children}</div>
          </main>

          <footer className="border-t px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
            SAT-7 Promo · internal system
          </footer>
        </div>
      </div>
    </MobileNavContext.Provider>
  );
}