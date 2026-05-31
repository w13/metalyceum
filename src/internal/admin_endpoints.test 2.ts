import { describe, expect, it } from "vitest";
import { INTERNAL_ADMIN_PATHS, internalAdminUrl } from "./admin_endpoints";

describe("internalAdminUrl", () => {
  it("builds internal URLs from shared path constants", () => {
    expect(internalAdminUrl(INTERNAL_ADMIN_PATHS.broadcast)).toBe("http://internal/internal/admin/broadcast");
    expect(internalAdminUrl(INTERNAL_ADMIN_PATHS.worldState)).toBe("http://internal/internal/admin/world-state");
    expect(internalAdminUrl(INTERNAL_ADMIN_PATHS.syncRoom)).toBe("http://internal/internal/admin/sync-room");
    expect(internalAdminUrl(INTERNAL_ADMIN_PATHS.worldAssets)).toBe("http://internal/internal/admin/world-assets");
  });
});
