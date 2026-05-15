import { Schema, model, models } from "mongoose";

const RoomSchema = new Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  creatorNickname: { type: String, required: true },
  startTime: { type: Date, default: null },
  endTime: { type: Date, default: null },
  capacity: { type: Number, default: 6 },
  durationMinutes: { type: Number, default: null },
  bucketMinutes: { type: Number, default: 60 }, // 60 = normal, 10 = test mode
  createdAt: { type: Date, default: Date.now },
});

export const Room = models.Room ?? model("Room", RoomSchema);
