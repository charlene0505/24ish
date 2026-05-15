"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import CubeTile from "@/components/CubeTile";
import EndedGallery from "@/components/EndedGallery";
import { gridLayout, getHourBucket, msUntilNextBucket } from "@/lib/utils";

interface Room {
  code: string;
  creatorNickname: string;
  startTime: string | null;
  endTime: string | null;
  bucketMinutes: number;
  capacity: number;
  durationMinutes: number | null;
}
interface Participant { nickname: string; slotIndex: number; }
interface Upload { slotIndex: number; hourBucket: string; url: string; thumbnailUrl: string; nickname: string; uploadedAt: string; posX: number; posY: number; }
interface Session { code: string; nickname: string; slotIndex: number; }

function useCountdown(bucketMinutes: number) {
  const [diff, setDiff] = useState(() => msUntilNextBucket(bucketMinutes));

  useEffect(() => {
    const id = setInterval(() => {
      setDiff(msUntilNextBucket(bucketMinutes));
    }, 1000);
    return () => clearInterval(id);
  }, [bucketMinutes]);

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  // Duration the creator picks before starting (hours); null = not yet chosen
  const [duration, setDuration] = useState<12 | 24 | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const bucketMinutes = room?.bucketMinutes ?? 60;
  const isTestMode = bucketMinutes === 2;
  const countdown = useCountdown(bucketMinutes);

  useEffect(() => {
    const stored = localStorage.getItem("ohap_session");
    if (!stored) { router.push("/"); return; }
    const sess: Session = JSON.parse(stored);
    if (sess.code !== code.toUpperCase()) { router.push("/"); return; }
    setSession(sess);
  }, [code, router]);

  useEffect(() => {
    if (!session) return;
    fetch(`/api/rooms/${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setRoom(data.room);
        setParticipants(data.participants);
        setUploads(data.uploads);
      })
      .catch(() => setError("Failed to load room"))
      .finally(() => setLoading(false));
  }, [session, code]);

  // SSE for live updates
  useEffect(() => {
    if (!session) return;
    const es = new EventSource(`/api/events/${code}`);
    eventSourceRef.current = es;
    es.onmessage = (e) => {
      const payload = JSON.parse(e.data);
      if (payload.type === "upload") {
        setUploads((prev) => {
          const next = prev.filter((u) => !(u.slotIndex === payload.slotIndex && u.hourBucket === payload.hourBucket));
          return [...next, payload];
        });
      } else if (payload.type === "start") {
        setRoom((prev) => prev ? { ...prev, startTime: payload.startTime, endTime: payload.endTime } : prev);
      } else if (payload.type === "join") {
        setParticipants((prev) => {
          if (prev.find((p) => p.nickname === payload.nickname)) return prev;
          return [...prev, { nickname: payload.nickname, slotIndex: payload.slotIndex }];
        });
      } else if (payload.type === "position") {
        setUploads((prev) =>
          prev.map((u) =>
            u.slotIndex === payload.slotIndex && u.hourBucket === payload.hourBucket
              ? { ...u, posX: payload.posX, posY: payload.posY }
              : u,
          ),
        );
      }
    };
    return () => es.close();
  }, [session, code]);

  async function handleStart() {
    if (!session) return;
    const durationMinutes = isTestMode ? 10 : (duration ? duration * 60 : null);
    if (!durationMinutes) {
      setError("Please choose a duration before starting.");
      return;
    }
    setError("");
    setStarting(true);
    try {
      const res = await fetch(`/api/rooms/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: session.nickname, durationMinutes }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setRoom((prev) => prev ? { ...prev, startTime: data.startTime, endTime: data.endTime } : prev);
    } catch {
      setError("Failed to start room.");
    } finally {
      setStarting(false);
    }
  }

  function handleUploaded(slotIndex: number, upload: Upload) {
    setUploads((prev) => {
      const next = prev.filter((u) => !(u.slotIndex === slotIndex && u.hourBucket === upload.hourBucket));
      return [...next, { ...upload, slotIndex, posX: 50, posY: 50 }];
    });
  }

  if (loading) return <div className="flex items-center justify-center text-neutral-400" style={{ height: "100dvh" }}>Loading…</div>;
  if (error && !room) return <div className="flex items-center justify-center text-red-400" style={{ height: "100dvh" }}>{error}</div>;
  if (!room || !session) return null;

  const now = new Date();
  const roomStarted = !!room.startTime;
  const roomActive = roomStarted && now >= new Date(room.startTime!) && now <= new Date(room.endTime!);
  const roomEnded = roomStarted && now > new Date(room.endTime!);
  const isCreator = session.nickname === room.creatorNickname;
  const capacity = room.capacity ?? 6;
  const { cols, rows } = gridLayout(capacity);

  const currentHourBucket = getHourBucket(now, bucketMinutes);

  // Grid wrapper: width is derived from available height (65dvh) × the grid aspect ratio
  // so the derived height never overflows the screen, regardless of portrait/landscape layout.
  const ratio = cols / rows;
  const gridWrapperStyle: React.CSSProperties = {
    width: "min(100%, min(512px, calc(65dvh * " + ratio + ")))",
    aspectRatio: cols + " / " + rows,
  };

  return (
    <main className="flex flex-col overflow-hidden" style={{ height: "100dvh" }}>
      {/* Header */}
      <header className="px-4 pt-3 pb-2 border-b border-neutral-800 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-lg tracking-widest text-black">{room.code}</span>
            <button
              onClick={() => {
                const url = window.location.href;
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(url);
                } else {
                  const el = document.createElement("textarea");
                  el.value = url;
                  el.style.position = "fixed";
                  el.style.opacity = "0";
                  document.body.appendChild(el);
                  el.select();
                  document.execCommand("copy");
                  document.body.removeChild(el);
                }
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="text-xs text-neutral-800 bg-fuchsia-300 border border-neutral-700 px-2 py-0.5 rounded"
            >
              {copied ? "Copied!" : "Copy code"}
            </button>
          </div>
          <span className="text-sm text-neutral-600">
            <span className="font-bold text-black">{participants.length}</span> / {capacity} joined
          </span>
        </div>
      </header>

      {/* Middle: gallery when ended, live grid otherwise */}
      {roomEnded ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <EndedGallery
            room={{ code: room.code, startTime: room.startTime!, bucketMinutes, capacity }}
            participants={participants}
            uploads={uploads}
          />
        </div>
      ) : (
        /* Grid — no scroll, sized to always fit the viewport */
        <div className="flex-1 min-h-0 overflow-hidden p-3 flex items-center justify-center">
          <div
            style={gridWrapperStyle}
          >
            <div
              className="grid gap-3 w-full h-full"
              style={{
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
              }}
            >
                {Array.from({ length: capacity }, (_, slotIndex) => {
                  const p = participants.find((p) => p.slotIndex === slotIndex) ?? null;
                  const currentUpload = p
                    ? uploads
                        .filter((u) => u.slotIndex === slotIndex && u.hourBucket === currentHourBucket)
                        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0] ?? null
                    : null;

                  return (
                    <CubeTile
                      key={slotIndex}
                      slotIndex={slotIndex}
                      nickname={p?.nickname ?? null}
                      isOwn={p?.nickname === session.nickname}
                      currentUpload={currentUpload}
                      currentHourBucket={currentHourBucket}
                      roomCode={code.toUpperCase()}
                      onUploaded={(u) => handleUploaded(slotIndex, u)}
                      onPositionChange={(posX, posY) => {
                        if (!currentUpload) return;
                        setUploads((prev) =>
                          prev.map((u) =>
                            u.slotIndex === slotIndex && u.hourBucket === currentHourBucket
                              ? { ...u, posX, posY }
                              : u,
                          ),
                        );
                      }}
                      roomActive={roomActive}
                    />
                  );
                })}
              </div>
            </div>
          </div>
      )}

      {/* Status bar — pinned to bottom, clears browser nav bar */}
      <div
        className={`px-4 pt-3 flex flex-col items-center justify-center gap-1${(roomEnded && !isCreator) || roomActive ? " bg-neutral-900" : ""}`}
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        {roomActive && (
          <span className="text-neutral-400 text-sm">
            Next window in{" "}
            <span className="font-mono font-bold text-white text-base">{countdown}</span>
          </span>
        )}
        {roomEnded && !isCreator && (
          <span className="text-yellow-400 font-medium text-sm">Room ended</span>
        )}
        {roomEnded && isCreator && (
          <>
            {error && <span className="text-red-400 text-xs">{error}</span>}
            <button
              onClick={handleStart}
              disabled={starting}
              className="w-48 shrink-0 bg-fuchsia-400 hover:bg-fuchsia-500 active:bg-fuchsia-600 disabled:opacity-50 text-black font-semibold py-2 rounded-xl transition-colors"
            >
              {starting ? "Restarting…" : "Restart Room"}
            </button>
          </>
        )}
        {!roomStarted && isCreator && (
          <>
            {!isTestMode && (
              <div className="flex gap-2 w-full max-w-xs">
                {([12, 24] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`flex-1 py-1.5 text-sm rounded-lg border font-medium transition-colors ${
                      duration === d
                        ? "bg-fuchsia-400 border-fuchsia-400 text-black"
                        : "bg-neutral-800 border-neutral-600 text-neutral-300 hover:border-neutral-400"
                    }`}
                  >
                    {d}h
                  </button>
                ))}
              </div>
            )}
            {isTestMode && (
              <span className="text-amber-400 text-xs">🧪 Test mode — 10 min · 2 min windows</span>
            )}
            {error && <span className="text-red-400 text-xs">{error}</span>}
            <button
              onClick={handleStart}
              disabled={starting || (!isTestMode && !duration)}
              className="bg-fuchsia-400 hover:bg-fuchsia-500 disabled:opacity-40 text-black font-semibold text-sm px-6 py-2 rounded-lg transition-colors w-full max-w-xs"
            >
              {starting ? "Starting…" : "Start Room"}
            </button>
          </>
        )}
        {!roomStarted && !isCreator && (
          <span className="text-neutral-400 text-sm">Waiting for host to start…</span>
        )}
        {roomStarted && !roomActive && !roomEnded && (
          <span className="text-neutral-400 text-sm">
            Starts at{" "}
            <span className="font-medium text-white">
              {new Date(room.startTime!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </span>
        )}
      </div>
    </main>
  );
}
