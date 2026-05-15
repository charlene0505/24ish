import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Room } from "@/lib/models/Room";
import { Participant } from "@/lib/models/Participant";
import { generateRoomCode } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { nickname, capacity = 6, bucketMinutes = 60 } = await req.json();

    if (!nickname?.trim()) return NextResponse.json({ error: "Nickname is required" }, { status: 400 });
    if (capacity < 1 || capacity > 6) return NextResponse.json({ error: "Capacity must be between 1 and 6" }, { status: 400 });

    await connectDB();

    let code = generateRoomCode();
    let attempts = 0;
    while (await Room.exists({ code }) && attempts < 10) {
      code = generateRoomCode();
      attempts++;
    }

    const room = await Room.create({ code, creatorNickname: nickname.trim(), capacity, bucketMinutes });

    // Creator claims slot 0
    await Participant.create({ roomCode: code, nickname: nickname.trim(), slotIndex: 0 });

    return NextResponse.json({ code: room.code, slotIndex: 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
