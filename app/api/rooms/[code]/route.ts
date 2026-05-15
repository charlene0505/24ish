import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Room } from "@/lib/models/Room";
import { Participant } from "@/lib/models/Participant";
import { Upload } from "@/lib/models/Upload";
import { notifyRoom } from "@/app/api/upload/route";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    await connectDB();

    const room = await Room.findOne({ code: code.toUpperCase() }).lean();
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const participants = await Participant.find({ roomCode: code.toUpperCase() }).lean();
    const uploads = await Upload.find({ roomCode: code.toUpperCase() }).lean();

    return NextResponse.json({ room, participants, uploads });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const { nickname, durationMinutes } = await req.json();
    const roomCode = code.toUpperCase();

    await connectDB();

    const room = await Room.findOne({ code: roomCode }).lean() as any;
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
    if (room.creatorNickname !== nickname) return NextResponse.json({ error: "Only the creator can start the room" }, { status: 403 });
    if (room.startTime) return NextResponse.json({ error: "Room already started" }, { status: 409 });

    const isTestMode = room.bucketMinutes === 2;
    const validDurations = isTestMode ? [10] : [12 * 60, 24 * 60];
    const resolvedDuration = durationMinutes ?? room.durationMinutes;
    if (!resolvedDuration || !validDurations.includes(resolvedDuration)) {
      return NextResponse.json({ error: "Please choose a duration before starting" }, { status: 400 });
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + resolvedDuration * 60 * 1000);

    await Room.updateOne({ code: roomCode }, { startTime, endTime, durationMinutes: resolvedDuration });

    notifyRoom(roomCode, { type: "start", startTime, endTime });

    return NextResponse.json({ startTime, endTime });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
