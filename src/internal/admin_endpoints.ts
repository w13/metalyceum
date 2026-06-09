export const INTERNAL_ADMIN_PATHS = {
  broadcast: '/internal/admin/broadcast',
  worldState: '/internal/admin/world-state',
  syncRoom: '/internal/admin/sync-room',
  worldAssets: '/internal/admin/world-assets',
} as const;

export type InternalAdminPath =
  (typeof INTERNAL_ADMIN_PATHS)[keyof typeof INTERNAL_ADMIN_PATHS];

const INTERNAL_ADMIN_BASE_URL = 'http://internal';

export function internalAdminUrl(path: InternalAdminPath): string {
  return `${INTERNAL_ADMIN_BASE_URL}${path}`;
}
