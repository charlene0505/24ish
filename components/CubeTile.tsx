"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Upload {
  slotIndex: number;
  hourBucket: string;
  url: string;
  thumbnailUrl: string;
  nickname: string;
  uploadedAt: string;
  posX: number;
  posY: number;
}

interface Props {
  slotIndex: number;
  nickname: string | null;
  isOwn: boolean;
  currentUpload: Upload | null;
  currentHourBucket: string;
  roomCode: string;
  onUploaded: (upload: Upload) => void;
  onPositionChange: (posX: number, posY: number) => void;
  roomActive: boolean;
}

export default function CubeTile({
  slotIndex,
  nickname,
  isOwn,
  currentUpload,
  currentHourBucket,
  roomCode,
  onUploaded,
  onPositionChange,
  roomActive,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");

  // Local blob URL shown immediately after picking — avoids CDN propagation delay
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const localPreviewRef = useRef<string | null>(null);

  // Pan position displayed via object-position
  const [posX, setPosX] = useState(currentUpload?.posX ?? 50);
  const [posY, setPosY] = useState(currentUpload?.posY ?? 50);

  // Refs for drag — never stale across renders
  const dragging = useRef(false);
  const dragMoved = useRef(false); // distinguishes a tap from a drag
  const dragStart = useRef({ x: 0, y: 0, posX: 50, posY: 50 });
  const currentPosRef = useRef({ x: posX, y: posY }); // always current, safe for stale closures
  const tileRef = useRef<HTMLDivElement>(null);

  // Sync display position when upload changes (new photo or SSE update from others)
  useEffect(() => {
    const nx = currentUpload?.posX ?? 50;
    const ny = currentUpload?.posY ?? 50;
    setPosX(nx);
    setPosY(ny);
    currentPosRef.current = { x: nx, y: ny };
  }, [currentUpload?.posX, currentUpload?.posY, currentUpload?.url]);

  // Blob URL cleanup
  function setLocalPreview(url: string | null) {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    localPreviewRef.current = url;
    setLocalPreviewUrl(url);
  }
  useEffect(() => () => { if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current); }, []);

  // Bucket flip → clear local preview and reset pan to centre
  useEffect(() => {
    setLocalPreview(null);
    setPosX(50);
    setPosY(50);
    currentPosRef.current = { x: 50, y: 50 };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHourBucket]);

  // ── Persist position (debounced, reads from ref — never stale) ──────────

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistPosition = useCallback((px: number, py: number) => {
    if (!currentUpload || !isOwn) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(async () => {
      try {
        const session = JSON.parse(localStorage.getItem("ohap_session") || "{}");
        await fetch(`/api/rooms/${roomCode}/position`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nickname: session.nickname,
            slotIndex,
            hourBucket: currentUpload.hourBucket,
            posX: px,
            posY: py,
          }),
        });
        onPositionChange(px, py);
      } catch {
        // non-critical
      }
    }, 300);
  }, [currentUpload, isOwn, roomCode, slotIndex, onPositionChange]);

  // ── Drag logic (handlers live on the overlay button, not the image) ──────

  function startDrag(clientX: number, clientY: number) {
    dragging.current = true;
    dragMoved.current = false;
    dragStart.current = {
      x: clientX,
      y: clientY,
      posX: currentPosRef.current.x,
      posY: currentPosRef.current.y,
    };
  }

  function moveDrag(clientX: number, clientY: number) {
    if (!dragging.current || !tileRef.current) return;
    const rect = tileRef.current.getBoundingClientRect();
    const dx = clientX - dragStart.current.x;
    const dy = clientY - dragStart.current.y;

    // Mark as a drag (not a tap) once movement exceeds 4px
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved.current = true;

    const dxPct = (dx / rect.width) * 100;
    const dyPct = (dy / rect.height) * 100;
    const newX = Math.max(0, Math.min(100, dragStart.current.posX - dxPct));
    const newY = Math.max(0, Math.min(100, dragStart.current.posY - dyPct));

    currentPosRef.current = { x: newX, y: newY };
    setPosX(newX);
    setPosY(newY);
  }

  function endDrag() {
    if (!dragging.current) return;
    dragging.current = false;
    if (dragMoved.current) {
      // It was a drag — persist the position read from the ref (never stale)
      persistPosition(currentPosRef.current.x, currentPosRef.current.y);
    }
    // If not dragMoved, the onClick handler (or onTouchEnd tap branch) handles the tap
  }

  // Touch handlers — on the overlay button
  function onOverlayTouchStart(e: React.TouchEvent) {
    dragMoved.current = false; // always reset so onClick fires correctly after a tap
    if (!currentUpload) return; // no photo yet — no drag to start
    startDrag(e.touches[0].clientX, e.touches[0].clientY);
  }
  function onOverlayTouchMove(e: React.TouchEvent) {
    if (!dragging.current) return;
    e.preventDefault();
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
  }
  function onOverlayTouchEnd() {
    endDrag(); // persist position if it was a drag; otherwise do nothing
    // Upload is triggered exclusively by onClick (fires after touchend on mobile),
    // which is a native click event that iOS honours for input[type=file].
  }

  // Mouse handlers — on the overlay button (desktop)
  function onOverlayMouseDown(e: React.MouseEvent) {
    dragMoved.current = false; // always reset so onClick fires correctly after a click
    if (!currentUpload) return;
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
    window.addEventListener("mousemove", onWindowMouseMove);
    window.addEventListener("mouseup", onWindowMouseUp);
  }
  function onWindowMouseMove(e: MouseEvent) { moveDrag(e.clientX, e.clientY); }
  function onWindowMouseUp() {
    endDrag();
    window.removeEventListener("mousemove", onWindowMouseMove);
    window.removeEventListener("mouseup", onWindowMouseUp);
  }

  // Click handler on the overlay — fires after mousedown+mouseup with no movement
  function onOverlayClick() {
    if (dragMoved.current) return; // was a drag, ignore
    if (roomActive) inputRef.current?.click();
  }

  // ── Upload ───────────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    setError("");
    setUploading(true);
    setProgress(0);
    try {
      const compressed = await compressImage(file, 2 * 1024 * 1024);
      setLocalPreview(URL.createObjectURL(compressed));
      const session = JSON.parse(localStorage.getItem("ohap_session") || "{}");
      const form = new FormData();
      form.append("file", compressed);
      form.append("roomCode", roomCode);
      form.append("nickname", session.nickname);
      const result = await uploadWithProgress(form, (p) => setProgress(p));
      // New upload always resets pan to centre
      setPosX(50);
      setPosY(50);
      currentPosRef.current = { x: 50, y: 50 };
      onUploaded({ ...result, slotIndex, nickname: session.nickname, uploadedAt: new Date().toISOString(), posX: 50, posY: 50 });
    } catch (e: any) {
      setLocalPreview(null);
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const displayUrl = localPreviewUrl ?? currentUpload?.thumbnailUrl ?? null;
  const objectPosition = `${posX.toFixed(1)}% ${posY.toFixed(1)}%`;

  // Empty slot
  if (nickname === null) {
    return (
      <div className="relative w-full h-full bg-neutral-900 rounded-xl border border-dashed border-neutral-700 flex items-center justify-center">
        <span className="text-neutral-600 text-xs">waiting...</span>
      </div>
    );
  }

  return (
    <div
      ref={tileRef}
      className="relative w-full h-full bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 group"
    >
      {/* Image */}
      {displayUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displayUrl}
          alt={`${nickname}'s photo`}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition, userSelect: "none", WebkitUserSelect: "none" }}
          draggable={false}
          onClick={!isOwn ? () => setPreview(true) : undefined}
          onLoad={() => {
            if (localPreviewUrl && displayUrl !== localPreviewUrl) setLocalPreview(null);
          }}
        />
      ) : (
        <div className="flex items-center justify-center h-full text-neutral-600 text-sm font-medium">
          {nickname}
        </div>
      )}

      {/* Progress bar */}
      {uploading && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-800">
          <div className="h-full bg-white transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Own-tile overlay — covers the whole tile (same as original), handles drag + upload tap */}
      {isOwn && roomActive && (
        <button
          disabled={uploading}
          className="absolute inset-0 flex items-end justify-center pb-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/0 group-hover:bg-black/40 disabled:cursor-not-allowed"
          style={{ touchAction: displayUrl ? "none" : "auto" }}
          onClick={onOverlayClick}
          onMouseDown={onOverlayMouseDown}
          onTouchStart={onOverlayTouchStart}
          onTouchMove={displayUrl ? onOverlayTouchMove : undefined}
          onTouchEnd={onOverlayTouchEnd}
        >
          <span className="text-xs bg-white text-black px-3 py-1 rounded-full font-medium">
            {uploading ? `Uploading… ${progress}%` : displayUrl ? "Replace" : "Upload"}
          </span>
        </button>
      )}

      {/* Nickname label */}
      <div className="absolute top-2 left-2 text-xs bg-black/60 px-2 py-0.5 rounded-full pointer-events-none">
        {nickname}{isOwn ? " (you)" : ""}
      </div>

      {error && (
        <div className="absolute bottom-2 left-2 right-2 text-xs text-red-400 bg-black/70 px-2 py-1 rounded pointer-events-none">
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />

      {/* Full-res preview modal — other people's tiles only */}
      {preview && displayUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreview(false)}
        >
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={currentUpload?.url ?? displayUrl} alt={nickname} className="w-full rounded-xl" />
            <div className="mt-3 text-sm text-neutral-400 text-center">
              {nickname}{currentUpload ? ` · ${new Date(currentUpload.uploadedAt).toLocaleTimeString()}` : ""}
            </div>
            <button
              onClick={() => setPreview(false)}
              className="absolute top-2 right-2 text-white bg-black/60 rounded-full w-8 h-8 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Utilities ────────────────────────────────────────────────────────────────

async function compressImage(file: File, maxBytes: number): Promise<File> {
  if (file.type === "image/jpeg" && file.size <= maxBytes) return file;
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const MAX = 1920;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const quality = file.size > maxBytes ? 0.82 : 0.92;
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error("Compression failed")); return; }
        resolve(new File([blob], file.name, { type: "image/jpeg" }));
      }, "image/jpeg", quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image. Try a JPEG or PNG file."));
    };
    img.src = url;
  });
}

function uploadWithProgress(form: FormData, onProgress: (p: number) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText);
      if (xhr.status >= 400) reject(new Error(data.error || "Upload failed"));
      else resolve(data);
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.open("POST", "/api/upload");
    xhr.send(form);
  });
}
