import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initials } from '@/lib/utils';

interface UserAvatarProps {
  name: string | null | undefined;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

/**
 * Avatar with an initials fallback. Decorative by default — pass a `title`
 * context nearby so screen readers still get the name.
 */
export function UserAvatar({ name, avatarUrl, className, fallbackClassName }: UserAvatarProps) {
  return (
    <Avatar className={cn('size-8', className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
      <AvatarFallback className={cn('bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300', fallbackClassName)}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

interface UserChipProps {
  name: string | null | undefined;
  avatarUrl?: string | null;
  role?: string;
  size?: 'sm' | 'default';
  className?: string;
  /** Renders a dash when there is no user. */
  emptyLabel?: string;
}

/** Avatar + name, the standard way a person is shown across the app. */
export function UserChip({
  name,
  avatarUrl,
  role,
  size = 'default',
  className,
  emptyLabel = 'Unassigned',
}: UserChipProps) {
  if (!name) {
    return <span className={cn('text-sm text-muted-foreground', className)}>{emptyLabel}</span>;
  }

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      <UserAvatar
        name={name}
        avatarUrl={avatarUrl}
        className={size === 'sm' ? 'size-6' : 'size-8'}
      />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium leading-tight">{name}</span>
        {role && (
          <span className="block truncate text-xs leading-tight text-muted-foreground">{role}</span>
        )}
      </span>
    </span>
  );
}

/** Overlapping avatars with a "+N" overflow chip. */
export function AvatarStack({
  users,
  max = 4,
  size = 'default',
}: {
  users: Array<{ id: string; full_name: string | null; avatar_url: string | null }>;
  max?: number;
  size?: 'sm' | 'default';
}) {
  if (users.length === 0) {
    return <span className="text-xs text-muted-foreground">No participants</span>;
  }

  const shown = users.slice(0, max);
  const overflow = users.length - shown.length;
  const dim = size === 'sm' ? 'size-6' : 'size-8';

  return (
    <div className="flex items-center">
      {shown.map((user, index) => (
        <UserAvatar
          key={user.id}
          name={user.full_name}
          avatarUrl={user.avatar_url}
          className={cn(dim, 'ring-2 ring-background')}
          // Overlap successive avatars slightly.
          fallbackClassName={index === 0 ? undefined : ''}
        />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            'flex items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground ring-2 ring-background',
            dim,
            'text-[10px]',
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}