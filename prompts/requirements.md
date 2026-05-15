# OneHourAPicture — Requirements

## Concept
A shared photo room where participants each own a cube slot and upload one photo per hour. At the end of the session, all hourly frames are compiled into a single recap video. No account required.

---

## Functional Requirements

### Room Access

| ID | Requirement |
|---|---|
| FR-01 | Any user can create a room without an account — generates a unique 6-char code (e.g. `FOX-392`) |
| FR-02 | Creator sets a nickname immediately after room creation |
| FR-03 | Room code is shareable via a pre-filled link and copy-to-clipboard button |
| FR-04 | Users join a room by entering a code + unique nickname |
| FR-05 | Nicknames must be unique within a room — duplicates are rejected with a clear message |
| FR-06 | Room capacity is capped at 6 participants |
| FR-07 | Session (room code, nickname, cube slot) is stored in `localStorage` — returning users skip the join screen |
| FR-08 | Users can manually leave or switch rooms from a settings menu |
| FR-09 | Creator sets a custom start and end time (12 h or 24 h window). Joins are only accepted **before start time**. Uploads are only accepted **between start and end time**. If a participant misses an hour, their placeholder fills that frame — frame count stays uniform for all slots. Room lifetime is capped at 48 h. |
| FR-10 | A live countdown to the next upload window (each hour) is shown in the grid header |

### Cube Slot System

| ID | Requirement |
|---|---|
| FR-11 | Each participant is assigned one cube slot (1–6) for the full room lifetime |
| FR-12 | Slot assignment is atomic — two simultaneous joins cannot claim the same slot |
| FR-13 | One upload is accepted per participant per rolling 1-hour window; user can also take a photo via webcam directly in the browser |
| FR-14 | User can delete and reupload within the same hour window (unlimited overwrites) |
| FR-15 | User can choose their placeholder: display their nickname as text, or set a custom picture |
| FR-16 | Missed hours display the user's chosen placeholder frame in the grid and in the compiled video |

### Photo Upload

| ID | Requirement |
|---|---|
| FR-17 | Accepted formats: JPEG, PNG, HEIC |
| FR-18 | Images are compressed client-side to ≤ 2 MB before upload |
| FR-19 | HEIC files are converted to JPEG server-side |
| FR-20 | MIME type is validated server-side — executables disguised as media are rejected |
| FR-21 | A progress bar is shown inside the cube tile during upload |

### Shared Live Grid

| ID | Requirement |
|---|---|
| FR-22 | A shared grid displays all slots with uploader nicknames; slot count is dynamic based on participant count |
| FR-23 | New uploads appear for all connected clients within 2 s — no page refresh needed |
| FR-24 | Grid tiles render CDN-cached 400×400 thumbnails |
| FR-25 | Clicking a cube opens a full-res preview modal with nickname and timestamp |
| FR-26 | Grid header shows room code, participant count, and countdown to next upload window |

### Video Compilation

| ID | Requirement |
|---|---|
| FR-27 | A compile button appears after the room end time for all participants |
| FR-28 | Output video shows all slots in a grid layout, progressing hour by hour (3 s per segment) |
| FR-29 | Missing hour buckets use the participant's chosen placeholder frame |
| FR-30 | Output is an H.264 MP4 downloadable by all participants |
| FR-31 | Participants can alternatively download all photos as a bulk ZIP |
| FR-32 | A download CTA appears in the grid UI once compilation is complete |

### Download & Export

| ID | Requirement |
|---|---|
| FR-33 | The compiled video is downloadable via a signed URL (90-day expiry) |
| FR-34 | Bulk photo ZIP is downloadable via a signed URL (90-day expiry) |

---

## Non-Functional Requirements

### Performance

| ID | Requirement |
|---|---|
| NFR-01 | Room creation and join complete in < 1 s |
| NFR-02 | Photo upload (after client compression) completes in < 3 s on a standard mobile connection |
| NFR-03 | Grid reflects a new upload for all clients within < 2 s |
| NFR-04 | Grid thumbnails load in < 50 ms (served from CDN edge) |
| NFR-05 | End-of-day compilation for a full room (up to 6 slots × 24 hours = 144 frames) completes in < 5 min |

### Scalability & Concurrency

| ID | Requirement |
|---|---|
| NFR-06 | Supports up to 6 simultaneous uploaders per room without race conditions |
| NFR-07 | Slot claim uses atomic DB locking — no two users can claim the same slot |
| NFR-08 | Multiple rooms can compile concurrently without resource contention |

### Security

| ID | Requirement |
|---|---|
| NFR-09 | All download links use signed URLs — direct storage paths are never exposed |
| NFR-10 | MIME type validation rejects files with mismatched extension and content type |
| NFR-11 | Room codes have < 0.1% collision probability (6-char alphanumeric = 2.1B combinations) |

### Reliability

| ID | Requirement |
|---|---|
| NFR-12 | Upload endpoint retries on transient failure (3× with exponential backoff) |
| NFR-13 | Compilation job is idempotent — safe to re-run if it crashes mid-way |
| NFR-14 | 99.5% uptime during active hours (08:00–23:00 local time) |

### Storage & Retention

| ID | Requirement |
|---|---|
| NFR-15 | Raw uploads stored in object storage (Supabase Storage / S3) — DB stores metadata and URLs only |
| NFR-16 | Raw files retained for 30 days after room expiry, then deleted |
| NFR-17 | Compiled videos and ZIPs retained for 90 days |

### Usability

| ID | Requirement |
|---|---|
| NFR-18 | No account or password required — zero friction to join |
| NFR-19 | Core flow (create room → upload → view grid) must work on mobile without a native app |
| NFR-20 | UI must be usable on screens ≥ 375px wide (iPhone SE minimum) |

---

## Room Lifecycle

```
[Before start time]  → Join window open, uploads blocked
[At start time]      → Join window closes, uploads open
[Each hour]          → New upload window opens; missed hours fill with placeholder
[At end time]        → Uploads blocked; compile button appears
[After compilation]  → Video + ZIP available for download (90 days)
[After 30 days]      → Raw uploads deleted
```

## Grid Layout by Participant Count

| Participants | Layout |
|---|---|
| 1 | 1×1 |
| 2 | 1×2 |
| 3–4 | 2×2 |
| 5–6 | 2×3 |

## Tech Stack

| Concern | Choice |
|---|---|
| Frontend | Next.js + TailwindCSS |
| Realtime | Supabase Realtime |
| Storage | Supabase Storage |
| Database | PostgreSQL (Supabase) |
| Video stitching | FFmpeg on Cloud Run / Lambda |
| Deployment | Vercel (frontend) + Cloud Run (FFmpeg worker) |
