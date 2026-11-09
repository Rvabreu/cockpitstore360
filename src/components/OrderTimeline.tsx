import type { OrderEvent, OrderEventStatus } from '../types/store'

// Keep semantic done green; current uses the site's orange, pending stays neutral.
const DOT_GLYPH: Record<OrderEventStatus, string> = {
  done: '✓',
  current: '●',
  pending: '·',
}

function dotClasses(status: OrderEventStatus): string {
  const base =
    'relative z-[1] flex-shrink-0 w-[26px] h-[26px] rounded-full grid place-items-center font-black text-[11px] border-2'
  if (status === 'done') {
    return `${base} bg-[#53d9a4] border-[#53d9a4] text-[#082218]`
  }
  if (status === 'current') {
    return `${base} bg-[#ff610f] border-[#ff610f] text-[#2c1006] shadow-[0_0_0_5px_#ff610f22]`
  }
  return `${base} bg-[#17191e] border-[#555961] text-[#999]`
}

export default function OrderTimeline({ events }: { events: OrderEvent[] }) {
  return (
    <div className="relative pl-[9px] mt-[17px]">
      {events.map((event, i) => (
        <div key={event.stepIndex} className="flex gap-[18px] min-h-[75px] relative">
          {i < events.length - 1 && (
            <span className="absolute top-[28px] left-[12px] w-[2px] h-[47px] bg-[#3c4046]" />
          )}
          <span className={dotClasses(event.status)}>{DOT_GLYPH[event.status]}</span>
          <div>
            <div className="text-[14px] font-semibold mt-[3px] mb-[5px]">{event.title}</div>
            <div className="text-[11px] text-[#a0a4ad]">{event.displayDetail}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
