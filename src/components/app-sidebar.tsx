'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  ChevronsLeft,
  FolderKanban,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  ListChecks,
  Radio,
  Settings,
  Users,
  Bell,
  ClipboardList,
  Tv,
  LayoutGrid,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/shared/logo';
import type { Permission } from '@/lib/auth/permissions';

type PermissionKey = keyof Permission;

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Hidden when the user's permissions do not include any of these. */
  requires?: PermissionKey[];
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Pipeline', href: '/pipeline', icon: LayoutGrid },
    ],
  },
  {
    label: 'Requests',
    items: [
      { label: 'All Requests', href: '/requests', icon: ClipboardList },
      { label: 'My Requests', href: '/requests/mine', icon: ListChecks },
      { label: 'New Request', href: '/requests/new', icon: Radio, requires: ['canCreateRequests'] },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { label: 'Projects', href: '/projects', icon: FolderKanban },
      { label: 'Programs', href: '/programs', icon: Tv },
      { label: 'Channels', href: '/channels', icon: Layers },
    ],
  },
  {
    label: 'Reporting',
    items: [
      { label: 'Reports', href: '/reports', icon: BarChart3, requires: ['canViewReports'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users', href: '/users', icon: Users },
      { label: 'Notifications', href: '/notifications', icon: Bell },
      { label: 'Settings', href: '/settings', icon: Settings, requires: ['canManageSettings'] },
    ],
  },
];

/** True when the active path is the item's href or a descendant of it. */
function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/requests') {
    // "All Requests" stays active on the detail and new-request pages.
    return pathname === '/requests' || pathname.startsWith('/requests/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface AppSidebarProps {
  permission: Permission;
  unreadNotifications?: number;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  /** Desktop: whether the sidebar is collapsed to icons. */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function AppSidebar({
  permission,
  unreadNotifications = 0,
  mobileOpen = false,
  onMobileClose,
  collapsed = false,
  onCollapsedChange,
}: AppSidebarProps) {
  const pathname = usePathname();

  // Close the mobile drawer whenever navigation happens.
  useEffect(() => {
    onMobileClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onMobileClose?.();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, onMobileClose]);

  return (
    <>
      {/* Mobile scrim */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onMobileClose}
            className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
            aria-hidden
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-card transition-[width,transform] duration-200 ease-out',
          'lg:translate-x-0',
          collapsed ? 'w-16' : 'w-64',
          mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full',
        )}
        aria-label="Main navigation"
      >
        <div
          className={cn(
            'flex h-14 shrink-0 items-center border-b px-3',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo className="size-8 shrink-0" />
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold leading-tight tracking-tight">
                  SAT-7 Promo
                </span>
                <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                  Promo Operations
                </span>
              </span>
            )}
          </Link>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onMobileClose}
            className="lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3 scrollbar-thin">
          {NAV.map((group, groupIndex) => {
            const visibleItems = group.items.filter(
              (item) => !item.requires || item.requires.some((key) => permission[key]),
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label ?? `group-${groupIndex}`}>
                {group.label && !collapsed && (
                  <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                )}
                {group.label && collapsed && <div className="mx-2 mb-2 h-px bg-border" />}
                <ul className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const active = isActive(pathname, item.href);
                    const Icon = item.icon;
                    const badge =
                      item.href === '/notifications' && unreadNotifications > 0
                        ? unreadNotifications
                        : null;

                    const link = (
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          collapsed && 'justify-center px-0',
                          active
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        )}
                      >
                        {active && (
                          <span
                            className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary"
                            aria-hidden
                          />
                        )}
                        <Icon className="size-4 shrink-0" />
                        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                        {badge !== null && (
                          <Badge
                            variant="default"
                            className={cn(
                              'h-5 min-w-5 justify-center px-1.5 text-[10px]',
                              collapsed && 'absolute right-1 top-1 h-4 min-w-4 px-1',
                            )}
                          >
                            {badge > 99 ? '99+' : badge}
                          </Badge>
                        )}
                        {collapsed && (
                          <span className="sr-only">
                            {item.label}
                            {badge ? `, ${badge} unread` : ''}
                          </span>
                        )}
                      </Link>
                    );

                    return (
                      <li key={item.href}>
                        {collapsed ? (
                          <span title={item.label}>{link}</span>
                        ) : (
                          link
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCollapsedChange?.(!collapsed)}
            className={cn('w-full gap-2 text-muted-foreground', collapsed && 'px-0')}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronsLeft
              className={cn('size-4 transition-transform', collapsed && 'rotate-180')}
            />
            {!collapsed && <span>Collapse</span>}
          </Button>
        </div>
      </aside>
    </>
  );
}

export { NAV };

/** Skeleton shown while the sidebar's session data resolves. */
export function SidebarSkeleton() {
  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-card p-3">
      <div className="mb-6 h-10 animate-pulse rounded-md bg-muted" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="mb-2 h-8 animate-pulse rounded-md bg-muted/60" />
      ))}
    </div>
  );
}

export { LifeBuoy };