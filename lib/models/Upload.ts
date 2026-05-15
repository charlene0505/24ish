import { Schema, model, models } from "mongoose";

const UploadSchema = new Schema({
  roomCode: { type: String, required: true, uppercase: true },
  slotIndex: { type: Number, required: true },
  nickname: { type: String, required: true },
  // e.g. "2024-01-15-14" = Jan 15 2024, 2pm hour
  hourBucket: { type: String, required: true },
  url: { type: String, required: true },
  thumbnailUrl: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

UploadSchema.index({ roomCode: 1, slotIndex: 1, hourBucket: 1 }, { unique: true });

export const Upload = models.Upload ?? model("Upload", UploadSchema);
