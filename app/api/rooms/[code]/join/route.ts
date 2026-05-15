import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Room } from "@/lib/models/Room";
import { Participant } from "@/lib/models/Participant";
import { notifyRoom } from "@/lib/pusher-server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const { nickname } = await req.json();

    if (!nickname?.trim()) return NextResponse.json({ error: "Nickname is required" }, { status: 400 });

    await connectDB();

    const room = await Room.findOne({ code: code.toUpperCase() }).lean();
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    // Block joins once the room has been started
    const startTime = (room as any).startTime;
    if (startTime && new Date() >= new Date(startTime)) {
      return NextResponse.json({ error: "Room has already started — joins are closed" }, { status: 403 });
    }

    // Check capacity
    const cap = (room as any).capacity ?? 6;
    const count = await Participant.countDocuments({ roomCode: code.toUpperCase() });
    if (count >= cap) return NextResponse.json({ error: `Room is full (max ${cap} participants)` }, { status: 403 });

    // Find next free slot atomically
    const taken = await Participant.find({ roomCode: code.toUpperCase() }, "slotIndex").lean();
    const takenSlots = new Set(taken.map((p: any) => p.slotIndex));
    const slotIndex = [0, 1, 2, 3, 4, 5].find((i) => !takenSlots.has(i));

    if (slotIndex === undefined) return NextResponse.json({ error: "No slots available" }, { status: 403 });

    try {
      await Participant.create({ roomCode: code.toUpperCase(), nickname: nickname.trim(), slotIndex });
    } catch (e: any) {
      if (e.code === 11000) {
        if (e.message.includes("nickname")) return NextResponse.json({ error: "Nickname already taken in this room" }, { status: 409 });
        return NextResponse.json({ error: "Slot already taken, please try again" }, { status: 409 });
      }
      throw e;
    }

    // Notify all SSE clients so the room owner sees the new participant immediately
    notifyRoom(code.toUpperCase(), { type: "join", nickname: nickname.trim(), slotIndex });

    return NextResponse.json({ slotIndex, code: code.toUpperCase() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
