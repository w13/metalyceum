import { LOBBY_RELEVANCE_DISTANCE, type Player } from './constants';

export type ChatScope = 'global' | 'room';

export function getDistanceSquared(
  a: Pick<Player, 'x' | 'z'>,
  b: Pick<Player, 'x' | 'z'>,
): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

export function arePlayersRelevant(
  viewer: Pick<Player, 'room' | 'x' | 'z'>,
  other: Pick<Player, 'room' | 'x' | 'z'>,
  lobbyDistance = LOBBY_RELEVANCE_DISTANCE,
): boolean {
  if (viewer.room >= 0 || other.room >= 0) {
    return viewer.room >= 0 && viewer.room === other.room;
  }

  return getDistanceSquared(viewer, other) <= lobbyDistance * lobbyDistance;
}

export function shouldDeliverChat(
  sender: Pick<Player, 'room'>,
  recipient: Pick<Player, 'room'>,
  scope: ChatScope,
): boolean {
  if (scope === 'global') {
    return true;
  }

  if (sender.room >= 0) {
    return recipient.room === sender.room;
  }

  return false;
}

export function normalizeChatScope(
  requestedScope: unknown,
  sender: Pick<Player, 'room'>,
): ChatScope {
  if (requestedScope === 'global') {
    return 'global';
  }

  return sender.room >= 0 ? 'room' : 'global';
}

export function getVisibleChatHistory<
  T extends { scope: ChatScope; roomId: number | null },
>(history: readonly T[], recipient: Pick<Player, 'room'>, limit: number): T[] {
  const visibleHistory = history.filter(
    (entry) =>
      entry.scope === 'global' ||
      (recipient.room >= 0 && entry.roomId === recipient.room),
  );
  return visibleHistory.slice(-Math.max(0, limit));
}
