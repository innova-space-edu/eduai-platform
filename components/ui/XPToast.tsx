"use client"

import { useEffect, useState } from "react"

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
    <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {events.map((event) => (
        <div
          key={event.id}
          className="animate-bounce-up bg-amber-500/90 border border-amber-400 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2"
        >
          <span>⚡</span>
          <span>+{event.amount} XP</span>
          <span className="text-amber-200 text-xs font-normal">{event.reason}</span>
        </div>
      ))}
    </div>
  )
}
