import { MentorGate } from "@/layouts/mentor-gate"
import TimeClockPage from "./time-clock"

export default function ClockPage() {
  return (
    <MentorGate>
      <TimeClockPage />
    </MentorGate>
  )
}
