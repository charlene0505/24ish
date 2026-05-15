"use client";

import EndedGallery from "@/components/EndedGallery";

// ── mock data ────────────────────────────────────────────────────────────────

const PARTICIPANTS = [
  { slotIndex: 0, nickname: "Alice" },
  { slotIndex: 1, nickname: "Bob" },
  { slotIndex: 2, nickname: "Carol" },
  { slotIndex: 3, nickname: "Dan" },
];

// Build a bucket string in the same YYYY-MM-DD-HH-MM format the app uses
function makeBucket(hoursAgo: number): string {
  const d = new Date(Date.now() - hoursAgo * 3600_000);
  // floor to the hour
  d.setUTCMinutes(0, 0, 0);
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
    String(d.getUTCHours()).padStart(2, "0"),
    "00",
  ].join("-");
}

// 4 hours of photos, 4 participants each — picsum.photos gives stable CORS-safe images
const HOURS = 4;
const UPLOADS = Array.from({ length: HOURS }, (_, hour) =>
  PARTICIPANTS.map((p) => {
    const seed = hour * 10 + p.slotIndex;
    return {
      slotIndex: p.slotIndex,
      hourBucket: makeBucket(HOURS - 1 - hour), // oldest first
      url:          `https://picsum.photos/seed/${seed}/800/800`,
      thumbnailUrl: `https://picsum.photos/seed/${seed}/400/400`,
      nickname: p.nickname,
      uploadedAt: new Date(Date.now() - (HOURS - 1 - hour) * 3600_000).toISOString(),
    };
  })
).flat();

const ROOM = {
  code: "TEST01",
  startTime: new Date(Date.now() - HOURS * 3600_000).toISOString(),
  bucketMinutes: 60,
  capacity: 4,
};

// ── page ─────────────────────────────────────────────────────────────────────

export default function TestGalleryPage() {
  return (
    <main className="flex flex-col overflow-hidden" style={{ height: "100dvh" }}>
      {/* Minimal header */}
      <header className="px-4 pt-3 pb-2 border-b border-neutral-800 flex items-center justify-between shrink-0">
        <span className="font-mono font-bold text-lg tracking-widest text-black">
          TEST01
        </span>
        <span className="text-xs text-neutral-500 bg-neutral-200 text-neutral-600 px-2 py-1 rounded">
          test page
        </span>
      </header>

      {/* Gallery */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <EndedGallery
          room={ROOM}
          participants={PARTICIPANTS}
          uploads={UPLOADS}
        />
      </div>

      {/* Status bar */}
      <div
        className="bg-neutral-900 border-t border-neutral-800 px-4 pt-3 flex items-center justify-center shrink-0"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <span className="text-yellow-400 font-medium text-sm">Room ended</span>
      </div>
    </main>
  );
}
