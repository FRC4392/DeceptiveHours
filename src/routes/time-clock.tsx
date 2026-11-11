import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { QrScanner } from "@/components/qr-scanner"
import { formatDuration, formatTotalHours } from "@/lib/format"
import { useElapsedMs } from "@/hooks/use-elapsed-ms"
import { LogIn, LogOut, QrCode, RotateCcw, Users } from "lucide-react"
import logo from "@/assets/logo.png"
import { toast } from "sonner"
import { Spinner } from "@/components/spinner"
import { initials } from "@/lib/student-info"
import { MEMBER_ID_HINT, isMemberId } from "@convex/memberId"
import { Label } from "@/components/ui/label"
import { Link } from "react-router"

type Phase =
  | { tag: "input" }
  | { tag: "scanning" }
  | { tag: "loading"; lookupId: string }
  | { tag: "member"; id: Id<"teamMembers"> }
  | { tag: "done"; action: "in" | "out" }

// `kioskToken` is present only on the shared tablet. A mentor opening this
// page from their phone passes nothing and is authorized by their Clerk
// session instead.
export default function TimeClockPage({ kioskToken }: { kioskToken?: string }) {
  const [phase, setPhase] = useState<Phase>({ tag: "input" })
  const [inputValue, setInputValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (phase.tag === "input") {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [phase.tag])

  // Checking the shape before the lookup separates "that isn't a Member ID"
  // from "no member has that ID" — a scanned QR code can contain anything, and
  // a mistyped digit used to come back as a bare "Member not found".
  function submit(rawId: string) {
    const id = rawId.trim()
    if (!id) return
    if (!isMemberId(id)) {
      toast.error(MEMBER_ID_HINT)
      return
    }
    setPhase({ tag: "loading", lookupId: id })
  }

  function handleScan(value: string): boolean | void {
    const scanned = value.trim()
    if (!isMemberId(scanned)) {
      toast.error("That QR code isn't a Member ID. Try again or type your ID.")
      // Returning false keeps the camera scanning for the right code.
      return false
    }
    setInputValue(scanned)
    submit(scanned)
  }

  function reset() {
    setPhase({ tag: "input" })
    setInputValue("")
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="relative flex items-center justify-center bg-primary px-6 py-3">
        <img src={logo} alt="Deceivers Robotics Team 4392" className="h-12 w-auto" />
        {/* Shown only to a mentor using this page from their own phone, so
            they aren't stranded here. The shared tablet has no mentor session
            to return to, and offering the link there would just bounce a
            student to a sign-in page. */}
        {!kioskToken && (
          <Link
            to="/"
            className="absolute right-4 text-xs text-white/60 transition-colors hover:text-white"
          >
            Mentor dashboard →
          </Link>
        )}
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        {phase.tag === "input" && (
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl">Welcome</CardTitle>
              <p id="kiosk-member-id-hint" className="text-sm text-muted-foreground">
                Enter or scan your Member ID to clock in or out — 10 digits
                starting with 4392
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  submit(inputValue)
                }}
                className="space-y-3"
              >
                <Label htmlFor="kiosk-member-id" className="sr-only">
                  Member ID
                </Label>
                <Input
                  id="kiosk-member-id"
                  ref={inputRef}
                  placeholder="Member ID"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="h-12 text-center text-lg"
                  // The kiosk runs on a tablet: ask for the numeric keypad
                  // rather than the full alphabetic keyboard.
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  autoComplete="off"
                  autoCorrect="off"
                  aria-describedby="kiosk-member-id-hint"
                />
                <Button
                  type="submit"
                  className="h-12 w-full text-base"
                  disabled={!inputValue.trim()}
                >
                  Continue
                </Button>
              </form>
              <Button
                variant="outline"
                className="h-11 w-full"
                onClick={() => setPhase({ tag: "scanning" })}
              >
                <QrCode className="mr-2 h-5 w-5" />
                Scan QR Code
              </Button>
            </CardContent>
          </Card>
        )}

        {phase.tag === "scanning" && (
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Scan QR Code</CardTitle>
            </CardHeader>
            <CardContent>
              <QrScanner
                onScan={handleScan}
                onClose={() => setPhase({ tag: "input" })}
              />
            </CardContent>
          </Card>
        )}

        {phase.tag === "loading" && (
          <MemberLookup
            memberId={phase.lookupId}
            kioskToken={kioskToken}
            onFound={(id) => setPhase({ tag: "member", id })}
            onNotFound={() => {
              toast.error("Member not found. Please check your ID.")
              setPhase({ tag: "input" })
            }}
          />
        )}

        {phase.tag === "member" && (
          <MemberCard
            memberId={phase.id}
            kioskToken={kioskToken}
            onDone={(action) => setPhase({ tag: "done", action })}
            onBack={reset}
          />
        )}

        {phase.tag === "done" && (
          <DoneCard action={phase.action} onReset={reset} />
        )}
      </main>
    </div>
  )
}

function MemberLookup({
  memberId,
  kioskToken,
  onFound,
  onNotFound,
}: {
  memberId: string
  kioskToken?: string
  onFound: (id: Id<"teamMembers">) => void
  onNotFound: () => void
}) {
  const member = useQuery(api.teamMembers.lookupByMemberId, { memberId, kioskToken })
  const calledRef = useRef(false)

  useEffect(() => {
    if (member === undefined || calledRef.current) return
    calledRef.current = true
    if (member === null) onNotFound()
    else onFound(member._id)
  }, [member, onFound, onNotFound])

  return (
    <Card className="w-full max-w-md">
      <CardContent className="flex items-center justify-center py-16">
        <div className="space-y-2 text-center">
          <Spinner className="mx-auto" />
          <p className="text-sm text-muted-foreground">Looking up member…</p>
        </div>
      </CardContent>
    </Card>
  )
}

function MemberCard({
  memberId,
  kioskToken,
  onDone,
  onBack,
}: {
  memberId: Id<"teamMembers">
  kioskToken?: string
  onDone: (action: "in" | "out") => void
  onBack: () => void
}) {
  const member = useQuery(api.teamMembers.getById, { id: memberId, kioskToken })
  const status = useQuery(api.clockSessions.getMemberStatus, {
    teamMemberId: memberId,
    kioskToken,
  })
  const clockIn = useMutation(api.clockSessions.clockIn)
  const clockOut = useMutation(api.clockSessions.clockOut)
  const [acting, setActing] = useState(false)

  const currentClockIn = status?.currentSession?.clockIn ?? null
  const elapsedMs = useElapsedMs(currentClockIn)
  const isClockIn = !status?.currentSession

  async function handleAction() {
    if (!status || acting) return
    setActing(true)
    try {
      if (isClockIn) {
        await clockIn({ teamMemberId: memberId, kioskToken })
        onDone("in")
      } else {
        await clockOut({ teamMemberId: memberId, kioskToken })
        onDone("out")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong")
      setActing(false)
    }
  }

  if (!member || !status) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="py-16 text-center">
          <Spinner className="mx-auto" />
        </CardContent>
      </Card>
    )
  }

  const totalMs = status.completedMs + (currentClockIn ? elapsedMs : 0)

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="border-b text-center">
        <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
          {initials(member.firstName, member.lastName)}
        </div>
        <CardTitle className="text-2xl">
          {member.firstName} {member.lastName}
        </CardTitle>
        <p className="text-sm capitalize text-muted-foreground">{member.type}</p>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted p-4 text-center">
            <p className="mb-1 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Range Hours
            </p>
            <p className="font-heading text-3xl font-extrabold italic tabular-nums text-foreground">
              {formatTotalHours(totalMs)}
            </p>
            <p className="text-xs text-muted-foreground">hrs</p>
          </div>
          <div className="rounded-lg bg-muted p-4 text-center">
            <p className="mb-1 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {currentClockIn ? "Session" : "Status"}
            </p>
            {currentClockIn ? (
              <p className="font-mono text-2xl font-bold tabular-nums text-foreground">
                {formatDuration(elapsedMs)}
              </p>
            ) : (
              <p className="text-lg font-medium text-muted-foreground">Not in</p>
            )}
          </div>
        </div>

        <Button
          className="h-14 w-full gap-2 text-lg"
          variant={isClockIn ? "default" : "destructive"}
          onClick={handleAction}
          disabled={acting}
        >
          {isClockIn ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
          {acting ? "Please wait…" : isClockIn ? "Clock In" : "Clock Out"}
        </Button>

        <Button variant="ghost" className="w-full" onClick={onBack}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Different Person
        </Button>
      </CardContent>
    </Card>
  )
}

function DoneCard({
  action,
  onReset,
}: {
  action: "in" | "out"
  onReset: () => void
}) {
  const [countdown, setCountdown] = useState(5)

  // The countdown and the reset are separate effects. Calling `onReset()` from
  // inside the `setCountdown` updater ran a side effect during render, which
  // React's StrictMode double-invokes in development.
  useEffect(() => {
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (countdown > 0) return
    onReset()
  }, [countdown, onReset])

  return (
    <Card className="w-full max-w-md text-center">
      <CardContent className="space-y-4 py-14">
        <div
          className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${
            action === "in" ? "bg-green-100 dark:bg-green-900/30" : "bg-orange-100 dark:bg-orange-900/30"
          }`}
        >
          {action === "in" ? (
            <LogIn className="h-10 w-10 text-green-600 dark:text-green-400" />
          ) : (
            <LogOut className="h-10 w-10 text-orange-600 dark:text-orange-400" />
          )}
        </div>
        <div>
          <p className="text-2xl font-semibold">
            {action === "in" ? "Clocked In!" : "Clocked Out!"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Returning in {countdown}…
          </p>
        </div>
        <Button variant="outline" onClick={onReset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Start Over Now
        </Button>
      </CardContent>
    </Card>
  )
}
