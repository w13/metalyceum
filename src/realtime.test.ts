import { describe, expect, it } from "vitest";
import { LOBBY_RELEVANCE_DISTANCE } from "./constants";
import { arePlayersRelevant, getVisibleChatHistory, normalizeChatScope, shouldDeliverChat } from "./realtime";

describe("arePlayersRelevant", () => {
  it("shares movement for players in the same room", () => {
    expect(
      arePlayersRelevant(
        { room: 3, x: 0, z: 0 },
        { room: 3, x: 200, z: 200 }
      )
    ).toEqual(true);
  });

  it("hides players in different rooms", () => {
    expect(
      arePlayersRelevant(
        { room: 2, x: 0, z: 0 },
        { room: 4, x: 0, z: 0 }
      )
    ).toEqual(false);
  });

  it("uses lobby distance outside rooms", () => {
    expect(
      arePlayersRelevant(
        { room: -1, x: 0, z: 0 },
        { room: -1, x: LOBBY_RELEVANCE_DISTANCE - 1, z: 0 }
      )
    ).toEqual(true);

    expect(
      arePlayersRelevant(
        { room: -1, x: 0, z: 0 },
        { room: -1, x: LOBBY_RELEVANCE_DISTANCE + 1, z: 0 }
      )
    ).toEqual(false);
  });
});

describe("shouldDeliverChat", () => {
  it("keeps room chat inside the same room", () => {
    expect(shouldDeliverChat({ room: 1 }, { room: 1 }, "room")).toEqual(true);
    expect(shouldDeliverChat({ room: 1 }, { room: -1 }, "room")).toEqual(false);
    expect(shouldDeliverChat({ room: 1 }, { room: 2 }, "room")).toEqual(false);
  });

  it("delivers global chat everywhere", () => {
    expect(shouldDeliverChat({ room: 1 }, { room: 1 }, "global")).toEqual(true);
    expect(shouldDeliverChat({ room: 1 }, { room: -1 }, "global")).toEqual(true);
    expect(shouldDeliverChat({ room: -1 }, { room: 0 }, "global")).toEqual(true);
  });

  it("falls back to global when lobby users request room chat", () => {
    expect(normalizeChatScope("room", { room: -1 })).toEqual("global");
    expect(normalizeChatScope("room", { room: 4 })).toEqual("room");
    expect(normalizeChatScope("global", { room: 4 })).toEqual("global");
    expect(normalizeChatScope("invalid", { room: 2 })).toEqual("room");
  });
});

describe("getVisibleChatHistory", () => {
  const history = [
    { id: 1, scope: "global" as const, roomId: null, message: "global-1" },
    { id: 2, scope: "room" as const, roomId: 1, message: "room-1" },
    { id: 3, scope: "room" as const, roomId: 2, message: "room-2" },
    { id: 4, scope: "global" as const, roomId: null, message: "global-2" },
    { id: 5, scope: "room" as const, roomId: 1, message: "room-1b" }
  ];

  it("returns only globally visible history for lobby players", () => {
    expect(getVisibleChatHistory(history, { room: -1 }, 100)).toEqual([
      history[0],
      history[3]
    ]);
  });

  it("includes matching room chat for players already in that room", () => {
    expect(getVisibleChatHistory(history, { room: 1 }, 100)).toEqual([
      history[0],
      history[1],
      history[3],
      history[4]
    ]);
  });

  it("keeps only the most recent visible entries up to the requested limit", () => {
    expect(getVisibleChatHistory(history, { room: 1 }, 2)).toEqual([
      history[3],
      history[4]
    ]);
  });
});
