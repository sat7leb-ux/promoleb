'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Check, LogOut, Menu, Moon, Search, Settings, Sun, User as UserIcon } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { SubmitButton as SignOutButton } from '@/components/auth/submit-button';
import { UserAvatar } from '@/components/shared/user-avatar';
import { GlobalSearch } from '@/components/shared/global-search';
import { useMobileNav } from '@/components/shell-shell';
import { formatRelative } from '@/lib/utils';
import { roleLabel } from '@/lib/auth/permissions';
import { markNotificationsReadAction } from '@/lib/auth/actions';
import { toast } from 'sonner';
import type { Notification, Profile } from '@/types/database';

interface AppTopbarProps {
  profile: Pick<Profile, 'id' | 'full_name' | 'email' | 'role' | 'avatar_url'>;
  notifications: Notification[];
  unreadCount: number;
}

/** Notification bell + popover. Re-reads when the popover opens. */
function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: Notification[];
  unreadCount: number;
}) {
  const router = useRouter();
  // The Popover is uncontrolled — its own open state drives the UI. This only
  // exists so clicking a notification can close it.
  const [, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen && unreadCount > 0) {
      setIsPending(true);
      const result = await markNotificationsReadAction();
      setIsPending(false);
      if (result.ok) router.refresh();
      else toast.error('Could not mark notifications as read');
    }
  }

  return (
    <Popover onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground ring-2 ring-background"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {isPending && <span className="text-xs text-muted-foreground">Updating…</span>}
        </div>

        <div className="max-h-96 overflow-y-auto scrollbar-thin">
          {notifications.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              You have no notifications yet.
            </p>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.link ?? '/notifications'}
                    onClick={() => setOpen(false)}
                    className="flex gap-3 px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span
                      className={cn2(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        n.read_at ? 'bg-transparent' : 'bg-primary',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{n.title}</span>
                      {n.body && (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {n.body}
                        </span>
                      )}
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {formatRelative(n.created_at)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t px-4 py-2">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Tiny local helper to avoid importing cn into a client component list twice.
function cn2(...args: Array<string | false | null | undefined>) {
  return args.filter(Boolean).join(' ');
}

/** Light/dark toggle persisted in localStorage. */
function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('sat7-theme', next ? 'dark' : 'light');
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
  }, [isDark]);

  if (!mounted) {
    return <Button variant="ghost" size="icon" aria-label="Toggle theme" disabled>
      <Sun className="size-4" />
    </Button>;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

export function AppTopbar({ profile, notifications, unreadCount }: AppTopbarProps) {
  const { open: openMobileNav } = useMobileNav();
  const [searchOpen, setSearchOpen] = useState(false);
  const { scrollY } = useScroll();
  const borderOpacity = useTransform(scrollY, [0, 120], [0, 1]);

  // Cmd/Ctrl+K opens global search.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <motion.header
        style={{ borderBottomColor: `hsl(var(--border) / ${borderOpacity})` }}
        className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-md sm:px-5"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={openMobileNav}
          className="lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </Button>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="group flex h-9 flex-1 max-w-md items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-left"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="flex-1 truncate text-left">Search requests, programs, people…</span>
          <kbd className="hidden shrink-0 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <NotificationBell notifications={notifications} unreadCount={unreadCount} />
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Account menu"
              >
                <UserAvatar
                  name={profile.full_name}
                  avatarUrl={profile.avatar_url}
                  className="size-7"
                />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="normal-case">
                <span className="block text-sm font-semibold normal-case tracking-normal">
                  {profile.full_name}
                </span>
                <span className="block truncate text-xs font-normal normal-case text-muted-foreground">
                  {profile.email}
                </span>
                <Badge variant="subtle" className="mt-1.5">
                  {roleLabel(profile.role)}
                </Badge>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
                <Link href="/settings/profile">
                  <UserIcon />
                  My profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/security">
                  <Check />
                  Security
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings />
                  Settings
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild destructive>
                <SignOutButton
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                >
                  <LogOut className="size-4" />
                  Sign out
                </SignOutButton>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.header>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}