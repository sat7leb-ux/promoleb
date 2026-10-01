'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  KeyRound,
  Layers,
  ListOrdered,
  Settings,
  Target,
  Tv,
  UserCog,
  Shapes,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/settings', label: 'General', icon: Settings, exact: true },
  { href: '/settings/profile', label: 'My profile', icon: UserCog, exact: false },
  { href: '/settings/security', label: 'Security', icon: KeyRound, exact: false },
  { href: '/settings/channels', label: 'Channels', icon: Layers, adminOnly: true },
  { href: '/settings/programs', label: 'Programs', icon: Tv, adminOnly: true },
  { href: '/settings/goals', label: 'Promo goals', icon: Target, adminOnly: true },
  { href: '/settings/promo-types', label: 'Promo types', icon: Shapes, adminOnly: true },
  { href: '/settings/stages', label: 'Pipeline stages', icon: ListOrdered, adminOnly: true },
];

/**
 * Settings sub-navigation.
 *
 * Reference-data sections are admin-only and hidden entirely rather than shown
 * disabled — a user who cannot edit them has no reason to know they exist, and
 * the server enforces the same rule regardless.
 */
export function SettingsNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const links = LINKS.filter((l) => !l.adminOnly || isAdmin);

  return (
    <nav aria-label="Settings sections">
      <ul className="flex flex-wrap gap-1 border-b pb-2 lg:flex-col lg:gap-0.5 lg:border-b-0 lg:pb-0">
        {links.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          const Icon = link.icon;

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-accent font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}