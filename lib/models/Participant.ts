import { Schema, model, models } from "mongoose";

const ParticipantSchema = new Schema({
  roomCode: { type: String, required: true, uppercase: true },
  nickname: { type: String, required: true },
  slotIndex: { type: Number, required: true, min: 0, max: 5 },
  joinedAt: { type: Date, default: Date.now },
});

ParticipantSchema.index({ roomCode: 1, nickname: 1 }, { unique: true });
ParticipantSchema.index({ roomCode: 1, slotIndex: 1 }, { unique: true });

export const Participant = models.Participant ?? model("Participant", ParticipantSchema);
