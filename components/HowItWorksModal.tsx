"use client";

function Smiley({ fill }: { fill: string }) {
  return (
    <svg viewBox="0 0 100 100" className="w-6 h-6 shrink-0" aria-hidden="true">
      <circle cx="50" cy="50" r="47" fill={fill} />
      <circle cx="31" cy="38" r="6" fill="#171717" />
      <circle cx="69" cy="38" r="6" fill="#171717" />
      <path d="M26 62 Q50 84 74 62" stroke="#171717" strokeWidth="7" strokeLinecap="round" fill="none" />
    </svg>
  );
}

const STEPS = [
  {
    color: "#e879f9", // fuchsia
    text: "Create a room and invite up to 6 friends with the room code.",
  },
  {
    color: "#fbbf24", // amber
    text: "Once the host starts it, everyone snaps one photo per hour window.",
  },
  {
    color: "#38bdf8", // sky
    text: "Photos land live on a shared grid — drag yours to reposition it.",
  },
  {
    color: "#34d399", // emerald
    text: "When the timer runs out, a gallery of every hour is revealed.",
  },
];

export default function HowItWorksModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white border border-neutral-700 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-black mb-1">Welcome to 24ish!</h2>
        <p className="text-sm text-neutral-600 mb-4">One photo every hour, share your moments with friends</p>

        <ul className="flex flex-col gap-3 mb-6">
          {STEPS.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <Smiley fill={step.color} />
              <span className="text-sm text-neutral-800">{step.text}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={onClose}
          className="w-full text-black bg-fuchsia-300 border border-neutral-700 font-semibold py-2.5 rounded-lg hover:bg-fuchsia-400 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
