import type { CampingRoomId } from "./CampingRoomWorld";

export type CampingObjectSection = "ROOT" | "MUSIC" | "BEATS" | "ARTISTS" | "MERCH" | "ARCHIVE" | "SESSIONS" | "LISTEN" | "SECRET";

export function getCampingObjectSection(focusedId: string | null | undefined): CampingObjectSection {
  if (!focusedId) return "ROOT";
  if (focusedId === "studio.imac") return "ROOT";
  if (focusedId === "studio.artists-wall" || focusedId.startsWith("studio.artist-photo.")) return "ARTISTS";
  if (focusedId === "studio.merch-rack") return "MERCH";
  if (focusedId === "studio.photo-backdrop" || focusedId === "studio.inner-door") return "ARCHIVE";
  if (focusedId === "studio.audio-system") return "LISTEN";
  if (focusedId === "studio.secret-drawer" || focusedId === "studio.secret-vault") return "SECRET";
  if (focusedId === "room.archive.records") return "ARCHIVE";
  if (focusedId === "studio.production-desk") return "SESSIONS";
  return "ROOT";
}

export function getArtistSlotIndex(focusedId: string | null | undefined): number | null {
  if (!focusedId) return null;
  const match = /^studio\.artist-photo\.(\d{3})$/.exec(focusedId);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  return Number.isInteger(index) && index >= 0 && index < 18 ? index : null;
}

export function canReserveLiveProduct(productId: string | null | undefined): boolean {
  return Boolean(productId && !productId.startsWith("static-"));
}


/** The published studio is a single physical room; doors never teleport into fabricated scenes. */
export function getRoomTransitionTarget(
  activeRoom: CampingRoomId,
  interactionId: string,
): CampingRoomId | null {
  void activeRoom;
  void interactionId;
  return null;
}

/** A discovered room is not an authorization grant for its private contents. */
export function roomRequiresBackendAuthorization(roomId: CampingRoomId): boolean {
  return roomId === "secret";
}
