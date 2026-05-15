export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1 to avoid confusion
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// bucketMinutes: 60 = normal (per hour), 10 = test mode (per 10 min)
export function getHourBucket(date: Date = new Date(), bucketMinutes = 60): string {
  const bucket = Math.floor(date.getUTCMinutes() / bucketMinutes) * bucketMinutes;
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
    String(date.getUTCHours()).padStart(2, "0"),
    String(bucket).padStart(2, "0"),
  ].join("-");
}

// Returns ms until the next bucket boundary
export function msUntilNextBucket(bucketMinutes = 60): number {
  const now = new Date();
  const msPerBucket = bucketMinutes * 60 * 1000;
  const elapsed = (now.getUTCMinutes() % bucketMinutes) * 60000 + now.getUTCSeconds() * 1000 + now.getUTCMilliseconds();
  return msPerBucket - elapsed;
}

export function gridLayout(count: number): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count <= 2) return { cols: 1, rows: 2 }; // portrait stack for 2-person rooms
  if (count <= 4) return { cols: 2, rows: 2 };
  return { cols: 3, rows: 2 };
}
