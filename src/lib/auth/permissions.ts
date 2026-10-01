import type { AppRole, Profile } from '@/types/database';

/**
 * Central permission model.
 *
 * Everything the UI hides and every server action enforces reads from this
 * one file, so a permission is never allowed to drift between the two.
 * To add a capability later: extend the interface, add the check to the
 * relevant role lists, and the UI gates follow automatically.
 */

export interface Permission {
  /** Create promo requests */
  canCreateRequests: boolean;
  /** Edit request content, retitle, change dates */
  canEditRequests: boolean;
  /** Delete / archive requests */
  canArchiveRequests: boolean;
  /** Move a request through the pipeline */
  canChangeStatus: boolean;
  /** Set or change the assigned producer */
  canAssignRequests: boolean;
  /** Add/remove participants */
  canManageParticipants: boolean;
  /** Create/edit/delete shifts */
  canManageShifts: boolean;
  /** Manage reference data (channels, programs, goals, promo types) */
  canManageReferenceData: boolean;
  /** Create/edit/archive projects */
  canManageProjects: boolean;
  /** Full user management including role changes */
  canManageUsers: boolean;
  /** Read-only user directory access */
  canViewUsers: boolean;
  /** View reports and export data */
  canViewReports: boolean;
  /** Edit pipeline stages and system settings */
  canManageSettings: boolean;
  /** View the global audit log */
  canViewAuditLog: boolean;
  /** Upload attachments */
  canUploadFiles: boolean;
}

const VIEWER: Permission = {
  canCreateRequests: false,
  canEditRequests: false,
  canArchiveRequests: false,
  canChangeStatus: false,
  canAssignRequests: false,
  canManageParticipants: false,
  canManageShifts: false,
  canManageReferenceData: false,
  canManageProjects: false,
  canManageUsers: false,
  canViewUsers: true,
  canViewReports: true,
  canManageSettings: false,
  canViewAuditLog: false,
  canUploadFiles: false,
};

const PRODUCER: Permission = {
  ...VIEWER,
  // Producers work the requests assigned to them. Per-request ownership is
  // checked in canEditThisRequest(); these flags grant the entry points.
  canEditRequests: true,
  canChangeStatus: true,
  canManageShifts: true,
  canUploadFiles: true,
};

const MANAGER: Permission = {
  ...PRODUCER,
  canCreateRequests: true,
  canArchiveRequests: true,
  canAssignRequests: true,
  canManageParticipants: true,
  canManageReferenceData: true,
  canManageProjects: true,
  canViewAuditLog: true,
};

const ADMIN: Permission = {
  ...MANAGER,
  canManageUsers: true,
  canManageSettings: true,
};

const ROLE_PERMISSIONS: Record<AppRole, Permission> = {
  administrator: ADMIN,
  promo_manager: MANAGER,
  producer: PRODUCER,
  viewer: VIEWER,
};

export function permissionsFor(role: AppRole | undefined): Permission {
  if (!role) return VIEWER;
  return ROLE_PERMISSIONS[role] ?? VIEWER;
}

export function roleLabel(role: AppRole): string {
  switch (role) {
    case 'administrator':
      return 'Administrator';
    case 'promo_manager':
      return 'Promo Manager';
    case 'producer':
      return 'Producer';
    case 'viewer':
      return 'Viewer';
  }
}

export function roleDescription(role: AppRole): string {
  switch (role) {
    case 'administrator':
      return 'Full access to every part of the system, including user management and settings.';
    case 'promo_manager':
      return 'Creates, assigns and manages promo requests, projects and reference data.';
    case 'producer':
      return 'Works assigned requests: shifts, production notes and file uploads.';
    case 'viewer':
      return 'Read-only access to dashboards, requests and reports.';
  }
}

export const ALL_ROLES: AppRole[] = [
  'administrator',
  'promo_manager',
  'producer',
  'viewer',
];

/**
 * Per-request ownership check.
 *
 * Managers and admins can always edit. A producer may only touch a request
 * they are assigned to, that they requested, or that they participate in.
 * This mirrors the RLS policy in migration 005 so the UI and the database
 * always agree.
 */
export function canEditThisRequest(
  permission: Permission,
  request: {
    assigned_to_id: string | null;
    requested_by_id: string | null;
  },
  currentUserId: string,
  participantIds: string[] = [],
): boolean {
  if (!permission.canEditRequests) return false;
  if (permission.canManageProjects) return true; // admin + manager

  return (
    request.assigned_to_id === currentUserId ||
    request.requested_by_id === currentUserId ||
    participantIds.includes(currentUserId)
  );
}

export function canAssignThisRequest(
  permission: Permission,
  request: { assigned_to_id: string | null },
  currentUserId: string,
): boolean {
  if (permission.canAssignRequests) return true;
  return request.assigned_to_id === currentUserId;
}

/** Convenience for layouts that only need the id and role. */
export type SessionProfile = Pick<Profile, 'id' | 'role' | 'full_name' | 'email' | 'avatar_url'>;
/** The permission set for each role, exported for the user-management UI. */
export const PERMISSIONS_BY_ROLE: Record<AppRole, Permission> = ROLE_PERMISSIONS;

/**
 * Human-readable summary of what a role can do.
 *
 * Derived from the same Permission objects the UI gates on, so the text shown
 * to an administrator when picking a role cannot drift from actual behaviour.
 */
export function describePermissionSet(permission: Permission): string {
  const capabilities: string[] = [];

  if (permission.canCreateRequests) capabilities.push('create requests');
  if (permission.canEditRequests) capabilities.push('edit requests they work on');
  if (permission.canAssignRequests) capabilities.push('assign work to others');
  if (permission.canChangeStatus) capabilities.push('move requests through the pipeline');
  if (permission.canManageParticipants) capabilities.push('manage participants');
  if (permission.canManageShifts) capabilities.push('manage shifts');
  if (permission.canUploadFiles) capabilities.push('upload files');
  if (permission.canManageReferenceData) capabilities.push('manage channels, programs and goals');
  if (permission.canManageProjects) capabilities.push('manage projects');
  if (permission.canManageUsers) capabilities.push('manage users and roles');
  if (permission.canManageSettings) capabilities.push('change system settings');
  if (permission.canViewReports) capabilities.push('view and export reports');

  if (capabilities.length === 0) return 'View dashboards, requests and reports only.';
  if (capabilities.length === 1) return `Can ${capabilities[0]}.`;

  // Oxford comma, so the sentence reads naturally in the role picker.
  return `Can ${capabilities.slice(0, -1).join(', ')}, and ${capabilities[capabilities.length - 1]}.`;
}
