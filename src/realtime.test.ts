import { describe, expect, it } from "vitest";
import { LOBBY_RELEVANCE_DISTANCE } from "./constants";
import { arePlayersRelevant, shouldDeliverChat } from "./realtime";

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
    expect(shouldDeliverChat({ room: 1 }, { room: 1 })).toEqual(true);
    expect(shouldDeliverChat({ room: 1 }, { room: -1 })).toEqual(false);
    expect(shouldDeliverChat({ room: 1 }, { room: 2 })).toEqual(false);
  });

  it("keeps lobby chat outside rooms", () => {
    expect(shouldDeliverChat({ room: -1 }, { room: -1 })).toEqual(true);
    expect(shouldDeliverChat({ room: -1 }, { room: 0 })).toEqual(false);
  });
});
