"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import HowItWorksModal from "@/components/HowItWorksModal";

type Tab = "create" | "join";

const GUIDE_SEEN_KEY = "ohap_guide_seen";

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("create");
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(GUIDE_SEEN_KEY)) setShowGuide(true);
  }, []);

  function closeGuide() {
    localStorage.setItem(GUIDE_SEEN_KEY, "1");
    setShowGuide(false);
  }

  // Create form
  const [nickname, setNickname] = useState("");
  const [testMode, setTestMode] = useState(false);
  const [capacity, setCapacity] = useState(4);
  const [creating, setCreating] = useState(false);

  // Join form
  const [joinCode, setJoinCode] = useState("");
  const [joinNickname, setJoinNickname] = useState("");
  const [joining, setJoining] = useState(false);

  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const bucketMinutes = testMode ? 2 : 60;

      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), capacity, bucketMinutes }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }

      localStorage.setItem("ohap_session", JSON.stringify({ code: data.code, nickname: nickname.trim(), slotIndex: data.slotIndex }));
      router.push(`/room/${data.code}`);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setJoining(true);
    try {
      const res = await fetch(`/api/rooms/${joinCode.trim().toUpperCase()}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: joinNickname.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }

      localStorage.setItem("ohap_session", JSON.stringify({ code: data.code, nickname: joinNickname.trim(), slotIndex: data.slotIndex }));
      router.push(`/room/${data.code}`);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <main className="flex flex-col items-center justify-center p-6 overflow-hidden" style={{ height: "100dvh" }}>
      {showGuide && <HowItWorksModal onClose={closeGuide} />}
      <div className="w-full max-w-sm">
        <div className="relative mb-1">
          <h1 className="text-3xl font-bold text-center text-black">
            OneHourAPicture
          </h1>
          <button
            onClick={() => setShowGuide(true)}
            aria-label="How it works"
            className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border border-neutral-700 text-neutral-800 text-xs font-bold hover:bg-fuchsia-200 transition-colors"
          >
            ?
          </button>
        </div>
        <p className="text-gray-800 text-center text-sm mb-8">
          One photo, every hour, with your crew.
        </p>

        {/* Tabs */}
        <div className="flex rounded-lg bg-white p-1">
          {(["create", "join"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setError("");
              }}
              className={`flex-1 py-2 text-sm rounded-md transition-colors text-neutral-800 font-bold  ${tab === t ? "bg-fuchsia-200" : "hover:text-black"}`}
            >
              {t === "create" ? "Create Room" : "Join Room"}
            </button>
          ))}
        </div>

        {/* Fixed-height container — both forms rendered, only one visible */}
        <div className="relative h-72 mt-4">
          {/* Create form */}
          <form
            onSubmit={handleCreate}
            className={`absolute inset-0 flex flex-col gap-4 transition-opacity duration-200 ${tab === "create" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          >
            <div>
              <label className="text-xs text-neutral-800 font-bold mb-1 block">Your nickname</label>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Charlene"
                maxLength={20}
                required={tab === "create"}
                suppressHydrationWarning
                className="w-full bg-white border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black text-black"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-800 font-bold mb-1 block">How many people? (including you)</label>
              <div className="flex gap-2">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button type="button" key={n} onClick={() => setCapacity(n)}
                    className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-colors text-neutral-800 ${capacity === n ? "bg-fuchsia-200 border-fuchsia-400" : "bg-white border-neutral-300 hover:border-neutral-500"}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Test mode toggle */}
            <button
              type="button"
              onClick={() => setTestMode((v) => !v)}
              className={`flex items-center justify-between w-full px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${testMode ? "bg-amber-100 border-amber-400 text-amber-800" : "bg-white border-neutral-300 text-neutral-500"}`}
            >
              <span>🧪 Test mode</span>
              <span className="text-xs">{testMode ? "10 mins · 2 mins windows" : "Off"}</span>
            </button>
            <button type="submit" disabled={creating}
              className="text-black bg-fuchsia-300 border border-neutral-700 font-semibold py-2.5 rounded-lg hover:bg-fuchsia-400 disabled:opacity-50 transition-colors">
              {creating ? "Creating…" : "Create Room"}
            </button>
          </form>

          {/* Join form */}
          <form
            onSubmit={handleJoin}
            className={`absolute inset-0 flex flex-col gap-4 transition-opacity duration-200 ${tab === "join" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          >
            <div>
              <label className="text-xs text-neutral-800 font-bold mb-1 block">Room code</label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                required={tab === "join"}
                suppressHydrationWarning
                className="w-full bg-white border border-neutral-700 text-black rounded-lg px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:border-black uppercase"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-800 font-bold mb-1 block">Your nickname</label>
              <input
                value={joinNickname}
                onChange={(e) => setJoinNickname(e.target.value)}
                placeholder="e.g. Alex"
                maxLength={20}
                required={tab === "join"}
                suppressHydrationWarning
                className="w-full bg-white border text-black border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black"
              />
            </div>
            <button type="submit" disabled={joining}
              className="text-black bg-fuchsia-300 border border-neutral-700 font-semibold py-2.5 rounded-lg hover:bg-fuchsia-400 disabled:opacity-50 transition-colors">
              {joining ? "Joining…" : "Join Room"}
            </button>
          </form>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
        )}
      </div>
    </main>
  );
}
