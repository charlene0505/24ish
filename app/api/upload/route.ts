import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { connectDB } from "@/lib/mongodb";
import { Room } from "@/lib/models/Room";
import { Participant } from "@/lib/models/Participant";
import { Upload } from "@/lib/models/Upload";
import { getHourBucket } from "@/lib/utils";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"]);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const roomCode = (formData.get("roomCode") as string)?.toUpperCase();
    const nickname = formData.get("nickname") as string;

    if (!file || !roomCode || !nickname) {
      return NextResponse.json({ error: "file, roomCode and nickname are required" }, { status: 400 });
    }

    // Validate MIME type
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only JPEG, PNG, HEIC, WebP allowed." }, { status: 400 });
    }

    await connectDB();

    const room = await Room.findOne({ code: roomCode }).lean() as any;
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const now = new Date();
    if (now < new Date(room.startTime)) return NextResponse.json({ error: "Room hasn't started yet" }, { status: 403 });
    if (now > new Date(room.endTime)) return NextResponse.json({ error: "Room has ended" }, { status: 403 });

    const participant = await Participant.findOne({ roomCode, nickname }).lean() as any;
    if (!participant) return NextResponse.json({ error: "Participant not found in this room" }, { status: 403 });

    const hourBucket = getHourBucket(now, (room as any).bucketMinutes ?? 60);
    const ext = file.type === "image/png" ? "png" : "jpg";
    const ts = Date.now(); // unique per upload — prevents browser cache serving stale image
    const path = `${roomCode}/${participant.slotIndex}/${hourBucket}_${ts}.${ext}`;
    const thumbPath = `${roomCode}/${participant.slotIndex}/${hourBucket}_${ts}_thumb.${ext}`;

    // Upload full image and thumbnail in parallel
    const [blob, thumbBlob] = await Promise.all([
      put(path, file, { access: "public" }),
      put(thumbPath, file, { access: "public" }),
    ]);

    // Upsert — replace existing upload for this hour; reset pan position to centre
    await Upload.findOneAndUpdate(
      { roomCode, slotIndex: participant.slotIndex, hourBucket },
      { nickname, url: blob.url, thumbnailUrl: thumbBlob.url, uploadedAt: now, posX: 50, posY: 50 },
      { upsert: true, returnDocument: "after" }
    );

    // Notify SSE clients
    notifyRoom(roomCode, { type: "upload", slotIndex: participant.slotIndex, hourBucket, url: blob.url, thumbnailUrl: thumbBlob.url, nickname, posX: 50, posY: 50 });

    return NextResponse.json({ url: blob.url, thumbnailUrl: thumbBlob.url, hourBucket, posX: 50, posY: 50 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// SSE broadcaster (in-process for MVP)
export const sseClients = new Map<string, Set<(data: string) => void>>();

export function notifyRoom(roomCode: string, payload: object) {
  const clients = sseClients.get(roomCode);
  if (!clients) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  clients.forEach((send) => send(data));
}
