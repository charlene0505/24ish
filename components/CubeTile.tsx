"use client";

import { useEffect, useRef, useState } from "react";

interface Upload {
  slotIndex: number;
  hourBucket: string;
  url: string;
  thumbnailUrl: string;
  nickname: string;
  uploadedAt: string;
}

interface Props {
  slotIndex: number;
  nickname: string | null;
  isOwn: boolean;
  currentUpload: Upload | null;
  currentHourBucket: string;
  roomCode: string;
  onUploaded: (upload: Upload) => void;
  roomActive: boolean;
}

export default function CubeTile({ slotIndex, nickname, isOwn, currentUpload, currentHourBucket, roomCode, onUploaded, roomActive }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  // Local blob URL shown immediately after picking — avoids CDN propagation delay
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const localPreviewRef = useRef<string | null>(null);

  // Clean up blob URL when it's replaced or component unmounts
  function setLocalPreview(url: string | null) {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    localPreviewRef.current = url;
    setLocalPreviewUrl(url);
  }
  useEffect(() => () => { if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current); }, []);

  // When the bucket rolls over, clear the local preview so the owner's tile
  // goes blank at the same time as everyone else's.
  useEffect(() => { setLocalPreview(null); }, [currentHourBucket]);

  // Empty slot — nobody has joined this position yet
  if (nickname === null) {
    return (
      <div className="relative w-full h-full bg-neutral-900 rounded-xl border border-dashed border-neutral-700 flex items-center justify-center">
        <span className="text-neutral-600 text-xs">waiting...</span>
      </div>
    );
  }

  async function handleFile(file: File) {
    setError("");
    setUploading(true);
    setProgress(0);

    try {
      // Always convert to JPEG via canvas (fixes HEIC/PNG/WebP → unrenderable on other devices)
      const compressed = await compressImage(file, 2 * 1024 * 1024);

      // Show the compressed blob immediately — no CDN delay for the uploader
      setLocalPreview(URL.createObjectURL(compressed));

      const session = JSON.parse(localStorage.getItem("ohap_session") || "{}");
      const form = new FormData();
      form.append("file", compressed);
      form.append("roomCode", roomCode);
      form.append("nickname", session.nickname);

      const result = await uploadWithProgress(form, (p) => setProgress(p));
      onUploaded({ ...result, slotIndex, nickname, uploadedAt: new Date().toISOString() });
    } catch (e: any) {
      setLocalPreview(null); // clear preview if upload failed
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  // Local preview takes priority; once the server URL loads successfully, drop the blob
  const displayUrl = localPreviewUrl ?? currentUpload?.thumbnailUrl ?? null;

  return (
    <div className="relative w-full h-full bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 group">
      {/* Image */}
      {displayUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displayUrl}
          alt={`${nickname}'s photo`}
          className="absolute inset-0 w-full h-full object-cover cursor-pointer"
          onClick={() => setPreview(true)}
          // Once the server CDN URL loads, release the local blob URL
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

      {/* Upload button (own tile only) */}
      {isOwn && roomActive && (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 flex items-end justify-center pb-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 disabled:cursor-not-allowed"
        >
          <span className="text-xs bg-white text-black px-3 py-1 rounded-full font-medium">
            {uploading ? `Uploading… ${progress}%` : displayUrl ? "Replace" : "Upload"}
          </span>
        </button>
      )}

      {/* Nickname label */}
      <div className="absolute top-2 left-2 text-xs bg-black/60 px-2 py-0.5 rounded-full">
        {nickname}{isOwn ? " (you)" : ""}
      </div>

      {error && (
        <div className="absolute bottom-2 left-2 right-2 text-xs text-red-400 bg-black/70 px-2 py-1 rounded">
          {error}
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />

      {/* Full-res preview modal — use local blob if server URL not ready yet */}
      {preview && displayUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setPreview(false)}>
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={currentUpload?.url ?? displayUrl} alt={nickname} className="w-full rounded-xl" />
            <div className="mt-3 text-sm text-neutral-400 text-center">
              {nickname}{currentUpload ? ` · ${new Date(currentUpload.uploadedAt).toLocaleTimeString()}` : ""}
            </div>
            <button onClick={() => setPreview(false)} className="absolute top-2 right-2 text-white bg-black/60 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

async function compressImage(file: File, maxBytes: number): Promise<File> {
  // Small JPEG: already the right format and size — skip canvas (no quality loss)
  if (file.type === "image/jpeg" && file.size <= maxBytes) return file;

  // Everything else (HEIC, PNG, WebP, or large JPEG) → convert to JPEG via canvas.
  // This ensures all uploads are renderable on every browser/device.
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
      // Use slightly higher quality for files that were already small
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
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
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
