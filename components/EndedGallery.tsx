"use client";

import { useState, useEffect, useRef } from "react";
import { gridLayout } from "@/lib/utils";
import { generateCollage, downloadBlob } from "@/lib/generateCollage";

interface Upload {
  slotIndex: number;
  hourBucket: string;
  url: string;
  thumbnailUrl: string;
  nickname: string;
  posX: number;
  posY: number;
}
interface Participant { slotIndex: number; nickname: string; }
interface Room {
  code: string;
  startTime: string;
  bucketMinutes: number;
  capacity: number;
}
interface Props {
  room: Room;
  participants: Participant[];
  uploads: Upload[];
}

function bucketLabel(hourBucket: string, bucketMinutes: number): string {
  const [y, mo, d, h, mi] = hourBucket.split("-").map(Number);
  const start = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const end = new Date(start.getTime() + bucketMinutes * 60 * 1000);
  const fmt = (dt: Date) => dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

/**
 * CSS transform for a card at `offset` positions from the current card.
 * dragX is added to EVERY card so the whole fan shifts with the finger.
 *
 *   offset  0  → front and center, upright
 *   offset -1  → shifted LEFT + tilted left (peeks from left edge)
 *   offset -2  → shifted further LEFT + more tilt, behind -1
 *   offset +1  → shifted RIGHT + tilted right (peeks from right edge)
 *   offset +2  → shifted further RIGHT + more tilt, behind +1
 */
function cardTransform(offset: number, scaleOverride?: number): string {
  const shiftX  = offset * 20;
  const tiltDeg = offset * 2.5;                              // subtle tilt
  const sinkPx  = Math.abs(offset) * 4;
  const sc      = scaleOverride ?? (1 - Math.abs(offset) * 0.05); // 1.0, 0.95, 0.90
  return `translateX(${shiftX}px) rotate(${tiltDeg}deg) translateY(${sinkPx}px) scale(${sc.toFixed(3)})`;
}

/**
 * Cards closer to center sit above those farther away.
 * When dragging, the side being revealed is boosted so it shows through the current card.
 *   dragX > 0  → dragging right → revealing left (previous) → boost negative offsets
 *   dragX < 0  → dragging left  → revealing right (next)    → boost positive offsets
 */
function cardZIndex(offset: number, dragX: number): number {
  if (offset === 0) return 10;
  const base = 10 - Math.abs(offset) * 2; // 8 for ±1, 6 for ±2
  if (dragX > 10  && offset < 0) return base + 1; // reveal previous
  if (dragX < -10 && offset > 0) return base + 1; // reveal next
  return base;
}

export default function EndedGallery({ room, participants, uploads }: Props) {
  const { cols, rows } = gridLayout(room.capacity ?? 6);
  const buckets = [...new Set(uploads.map((u) => u.hourBucket))].sort();
  const n = buckets.length;

  const [idx, setIdx]           = useState(0);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [dragX, setDragX]       = useState(0);
  const [dragging, setDragging] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const startX    = useRef(0);
  const startY    = useRef(0);
  const axis      = useRef<"h" | "v" | null>(null);
  const animating = useRef(false);
  const requested = useRef(new Set<string>());
  const blobUrls  = useRef<string[]>([]);

  // Revoke all object URLs on unmount
  useEffect(() => () => blobUrls.current.forEach(URL.revokeObjectURL), []);

  // Generate previews for cards in the visible window: idx-2 … idx+2
  useEffect(() => {
    for (let offset = -2; offset <= 2; offset++) {
      const i = idx + offset;
      if (i < 0 || i >= n) continue;
      const bucket = buckets[i];
      if (requested.current.has(bucket)) continue;
      requested.current.add(bucket);

      const bucketUploads = uploads
        .filter((u) => u.hourBucket === bucket)
        .map((u) => ({ slotIndex: u.slotIndex, url: u.thumbnailUrl, posX: u.posX, posY: u.posY }));

      generateCollage(participants, bucketUploads, cols, rows, bucketLabel(bucket, room.bucketMinutes))
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          blobUrls.current.push(url);
          setPreviews((p) => ({ ...p, [bucket]: url }));
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, n]);

  // ── navigation ────────────────────────────────────────────────────────────
  function go(dir: "left" | "right") {
    if (animating.current) { setDragX(0); return; }
    const next = dir === "left" ? idx + 1 : idx - 1;
    if (next < 0 || next >= n) { setDragX(0); return; } // hard stop at ends
    animating.current = true;
    setDragX(0);
    setIdx(next);
    // Allow CSS transitions to complete before accepting the next swipe
    setTimeout(() => { animating.current = false; }, 360);
  }

  // ── touch handlers ────────────────────────────────────────────────────────
  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    axis.current   = null;
    setDragging(true);
  }

  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (!axis.current) {
      if (Math.abs(dx) > Math.abs(dy) + 4)      axis.current = "h";
      else if (Math.abs(dy) > Math.abs(dx) + 4) axis.current = "v";
      else return;
    }
    if (axis.current === "h") { e.preventDefault(); setDragX(dx); }
  }

  function onTouchEnd() {
    if (axis.current === "h") {
      if      (dragX < -60) go("left");
      else if (dragX >  60) go("right");
      else setDragX(0);
    } else {
      setDragX(0);
    }
    setDragging(false);
  }

  // ── download ──────────────────────────────────────────────────────────────
  async function downloadCurrent() {
    setDownloading(true);
    try {
      const bucket = buckets[idx];
      const bucketUploads = uploads
        .filter((u) => u.hourBucket === bucket)
        .map((u) => ({ slotIndex: u.slotIndex, url: u.url, posX: u.posX, posY: u.posY }));
      const blob = await generateCollage(
        participants, bucketUploads, cols, rows,
        bucketLabel(bucket, room.bucketMinutes),
      );
      downloadBlob(blob, `${room.code}-${bucket}.png`);
    } catch {
      alert("Could not generate. Try again.");
    } finally {
      setDownloading(false);
    }
  }

  // ── empty state ───────────────────────────────────────────────────────────
  if (n === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-2 p-8 text-center">
        <span className="text-4xl">📷</span>
        <p className="text-sm">No photos were uploaded during this session.</p>
      </div>
    );
  }

  // ── build visible card list ───────────────────────────────────────────────
  // Show up to 5 cards: two to the left, current, two to the right.
  // Rendered back-to-front (lowest zIndex first) so the current card
  // is always painted on top.
  const offsets = [-2, -1, 0, 1, 2];
  const visibleCards = offsets
    .map((offset) => ({ offset, cardIdx: idx + offset }))
    .filter(({ cardIdx }) => cardIdx >= 0 && cardIdx < n)
    .sort((a, b) => Math.abs(b.offset) - Math.abs(a.offset)); // furthest first

  return (
    <div className="h-full flex flex-col items-center gap-3 p-3">

      {/* Top spacer – pushes the tight group toward vertical centre */}
      <div className="flex-1" />

      {/* Tight group: label + card + dots all directly adjacent */}
      <div className="w-full flex flex-col items-center gap-3">

        {/* Hour label + position */}
        <div className="text-center">
          <p className="text-neutral-800 font-semibold text-sm">
            {bucketLabel(buckets[idx], room.bucketMinutes)}
          </p>
          <p className="text-neutral-500 text-xs mt-0.5">
            {idx + 1} of {n}
          </p>
        </div>

        {/* Card fan – natural square sized by width; px-6 gives side breathing room */}
        <div className="w-full px-6">
          <div
            className="relative mx-auto"
            style={{ aspectRatio: "1080 / 1350", width: "min(100%, min(512px, calc(62dvh * 0.8)))" }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
        {visibleCards.map(({ offset, cardIdx }) => {
          const bucket  = buckets[cardIdx];
          const isTop = offset === 0;

          // How far through the gesture we are (0 → 1 over 250 px of drag)
          const progress = Math.min(Math.abs(dragX) / 250, 1);

          // The card being revealed: offset=-1 when dragging right, offset=+1 when dragging left
          const isIncoming = dragging &&
            ((dragX > 10 && offset === -1) || (dragX < -10 && offset === 1));

          let transform: string;
          if (isTop && dragging) {
            // Current card follows finger and shrinks slightly as it moves away
            const sc = (1 - progress * 0.07).toFixed(3);
            transform = `translateX(${dragX}px) rotate(${(dragX * 0.02).toFixed(2)}deg) scale(${sc})`;
          } else if (isIncoming) {
            // Incoming card grows from its resting scale toward 1 as the drag progresses
            const restScale = 1 - Math.abs(offset) * 0.05; // 0.95 for ±1
            const sc = restScale + progress * (1 - restScale);
            transform = cardTransform(offset, sc);
          } else {
            transform = cardTransform(offset);
          }

          return (
            <div
              key={bucket}
              className="absolute inset-0 rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800"
              style={{
                transform,
                zIndex: cardZIndex(offset, dragX),
                // No transition while finger is on screen; smooth settle/advance otherwise.
                transition: dragging ? "none" : "transform 0.35s ease-in-out",
                willChange: "transform",
              }}
            >
              {previews[bucket] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previews[bucket]}
                  alt={`Hour ${cardIdx + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-600 text-sm">
                  Generating…
                </div>
              )}
            </div>
          );
        })}
          </div>
        </div>

        {/* Dot indicators – right under the card, inside the tight group */}
        {n <= 12 && (
          <div className="flex gap-1.5 justify-center">
            {buckets.map((_, i) => (
              <button
                key={i}
                onClick={() => { if (!animating.current) setIdx(i); }}
                className="flex items-center justify-center"
              >
                <div
                  className={`rounded-full transition-all duration-300 ${
                    i === idx ? "w-4 h-2 bg-white" : "w-2 h-2 bg-neutral-600"
                  }`}
                />
              </button>
            ))}
          </div>
        )}

      </div>{/* end tight group */}

      {/* Spacer – pushes buttons to the bottom */}
      <div className="flex-1" />

      <button
        onClick={downloadCurrent}
        disabled={downloading}
        className="w-48 shrink-0 bg-fuchsia-400 hover:bg-fuchsia-500 active:bg-fuchsia-600 disabled:opacity-50 text-black font-semibold py-2 rounded-xl transition-colors"
      >
        {downloading ? "Saving…" : "Save This Hour"}
      </button>
    </div>
  );
}
