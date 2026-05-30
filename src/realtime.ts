import { LOBBY_RELEVANCE_DISTANCE, type Player } from "./constants";

export function getDistanceSquared(a: Pick<Player, "x" | "z">, b: Pick<Player, "x" | "z">): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

export function arePlayersRelevant(
  viewer: Pick<Player, "room" | "x" | "z">,
  other: Pick<Player, "room" | "x" | "z">,
  lobbyDistance = LOBBY_RELEVANCE_DISTANCE
): boolean {
  if (viewer.room >= 0 || other.room >= 0) {
    return viewer.room >= 0 && viewer.room === other.room;
  }

  return getDistanceSquared(viewer, other) <= lobbyDistance * lobbyDistance;
}

export function shouldDeliverChat(
  sender: Pick<Player, "room">,
  recipient: Pick<Player, "room">
): boolean {
  if (sender.room >= 0) {
    return recipient.room === sender.room;
  }

  return recipient.room === -1;
}
