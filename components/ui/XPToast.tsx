"use client"

interface XPEvent {
  id: number
  amount: number
  reason: string
}

interface Props {
  events: XPEvent[]
}

export default function XPToast({ events }: Props) {
  return (
    <div className="fixed bottom-24 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {events.map((event) => (
        <div
          key={event.id}
          className="animate-bounce-up flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-lg shadow-black/30 border"
          style={{
            background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(234,88,12,0.1))",
            borderColor: "rgba(245,158,11,0.25)",
          }}
        >
          {/* Flash icon */}
          <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xs flex-shrink-0">
            ⚡
          </div>

          {/* Amount */}
          <span className="text-amber-400 font-bold text-sm tabular-nums">
            +{event.amount} XP
          </span>

          {/* Reason */}
          {event.reason && (
            <span className="text-amber-300/60 text-xs font-normal max-w-[120px] truncate">
              {event.reason}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
