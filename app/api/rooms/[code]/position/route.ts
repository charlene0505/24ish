import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Participant } from "@/lib/models/Participant";
import { Upload } from "@/lib/models/Upload";
import { notifyRoom } from "@/lib/pusher-server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const roomCode = code.toUpperCase();
    const { nickname, slotIndex, hourBucket, posX, posY } = await req.json();

    if (!nickname || typeof slotIndex !== "number" || !hourBucket) {
      return NextResponse.json({ error: "nickname, slotIndex and hourBucket are required" }, { status: 400 });
    }
    if (typeof posX !== "number" || typeof posY !== "number") {
      return NextResponse.json({ error: "posX and posY are required numbers" }, { status: 400 });
    }

    await connectDB();

    // Verify the requester owns this slot
    const participant = await Participant.findOne({ roomCode, nickname, slotIndex }).lean();
    if (!participant) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 });
    }

    const clamped = {
      posX: Math.max(0, Math.min(100, posX)),
      posY: Math.max(0, Math.min(100, posY)),
    };

    await Upload.updateOne(
      { roomCode, slotIndex, hourBucket },
      { $set: clamped },
    );

    notifyRoom(roomCode, {
      type: "position",
      slotIndex,
      hourBucket,
      posX: clamped.posX,
      posY: clamped.posY,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
