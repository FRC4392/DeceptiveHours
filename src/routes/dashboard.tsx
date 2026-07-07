import { useMemo, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { Link } from "react-router"
import { api } from "@convex/_generated/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatDate,
  formatDuration,
  formatTotalHours,
  fromDateInput,
  fromDateInputExclusiveEnd,
  toDateInput,
} from "@/lib/format"
import { downloadCsv } from "@/lib/csv"
import { formatStudentGrade } from "@/lib/student-info"
import { useElapsedMs } from "@/hooks/use-elapsed-ms"
import { Clock, Download, RotateCcw, Save, Timer, Users, UserCheck } from "lucide-react"
import { toast } from "sonner"

type HoursRange = { startAt: number; endAt?: number }

export default function DashboardPage() {
  const [appliedRange, setAppliedRange] = useState<HoursRange | null>(null)
  const [startDateDraft, setStartDateDraft] = useState<string | null>(null)
  const [endDateDraft, setEndDateDraft] = useState<string | null>(null)
  const data = useQuery(api.dashboard.getDashboardData, appliedRange ?? {})
  const updateHoursRange = useMutation(api.settings.updateHoursRange)

  const startDate = startDateDraft ?? (data ? toDateInput(data.hoursRange.startAt) : "")
  const endDate =
    endDateDraft ?? (data?.hoursRange.endAt ? toDateInput(data.hoursRange.endAt - 1) : "")

  const rangeDraft = useMemo(() => {
    if (!startDate) return null
    const range: HoursRange = { startAt: fromDateInput(startDate) }
    if (endDate) range.endAt = fromDateInputExclusiveEnd(endDate)
    return range
  }, [endDate, startDate])

  if (!data) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  async function saveGlobalRange() {
    if (!rangeDraft) return
    try {
      await updateHoursRange(rangeDraft)
      setAppliedRange(null)
      toast.success("Default hours range updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save hours range")
    }
  }

  function applyRange() {
    if (!rangeDraft) return
    if (rangeDraft.endAt !== undefined && rangeDraft.endAt <= rangeDraft.startAt) {
      toast.error("End date must be after start date")
      return
    }
    setAppliedRange(rangeDraft)
  }

  function exportDashboardCsv() {
    if (!data) return
    downloadCsv("dashboard-hours.csv", [
      ["Name", "Email", "Role", "Grade", "Member ID", "Hours"],
      ...data.members.map((member) => [
        `${member.firstName} ${member.lastName}`,
        member.email,
        member.type,
        formatStudentGrade(member.displayGrade),
        member.memberId,
        formatTotalHours(member.completedMs),
      ]),
    ])
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold italic uppercase tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of team hours and attendance</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hours Range</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="grid gap-2 sm:grid-cols-2 lg:w-auto">
            <div className="space-y-2">
              <Label htmlFor="dashboard-start">Start date</Label>
              <Input
                id="dashboard-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDateDraft(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dashboard-end">End date</Label>
              <Input
                id="dashboard-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDateDraft(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={applyRange}
              disabled={!rangeDraft}
            >
              Apply
            </Button>
            <Button variant="outline" className="gap-2" onClick={saveGlobalRange} disabled={!rangeDraft}>
              <Save className="h-4 w-4" />
              Save Default
            </Button>
            <Button
              variant="ghost"
              className="gap-2"
              onClick={() => {
                setAppliedRange(null)
                setStartDateDraft(null)
                setEndDateDraft(null)
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button variant="outline" className="gap-2" onClick={exportDashboardCsv}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
          <p className="text-sm text-muted-foreground lg:ml-auto">
            Showing {formatDate(data.hoursRange.startAt)}
            {data.hoursRange.endAt ? ` to ${formatDate(data.hoursRange.endAt - 1)}` : " to now"}
          </p>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="not-italic normal-case font-mono text-xs font-medium tracking-wider text-muted-foreground">
              Currently Clocked In
            </CardTitle>
            <UserCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="font-heading text-3xl font-extrabold italic">{data.currentlySignedIn.length}</p>
            <p className="text-xs text-muted-foreground">
              of {data.members.length} members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="not-italic normal-case font-mono text-xs font-medium tracking-wider text-muted-foreground">
              Total Team Hours
            </CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="font-heading text-3xl font-extrabold italic">
              {formatTotalHours(data.totalCompletedMs)}
            </p>
            <p className="text-xs text-muted-foreground">completed hours in range</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="not-italic normal-case font-mono text-xs font-medium tracking-wider text-muted-foreground">
              Team Members
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="font-heading text-3xl font-extrabold italic">{data.members.length}</p>
            <p className="text-xs text-muted-foreground">registered members</p>
          </CardContent>
        </Card>
      </div>

      {/* Currently clocked in */}
      {data.currentlySignedIn.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              Currently Clocked In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.currentlySignedIn.map((member) => (
                <ClockInCard key={member._id} member={member} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All members table */}
      <Card>
        <CardHeader>
          <CardTitle>All Team Members</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Member ID</TableHead>
                <TableHead className="text-right">Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No members yet.{" "}
                    <Link to="/users" className="text-primary underline-offset-4 hover:underline">
                      Invite your first user →
                    </Link>
                  </TableCell>
                </TableRow>
              )}
              {data.members
                .map((member) => (
                  <TableRow
                    key={member._id}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link
                        to={`/members/${member._id}`}
                        className="font-medium hover:text-primary"
                      >
                        {member.firstName} {member.lastName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.type === "mentor" ? "default" : "secondary"}>
                        {member.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatStudentGrade(member.displayGrade) || "—"}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {member.memberId}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatTotalHours(member.completedMs)} hrs
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function ClockInCard({
  member,
}: {
  member: {
    _id: string
    firstName: string
    lastName: string
    currentSession: { clockIn: number } | null
  }
}) {
  const clockInTime = member.currentSession?.clockIn ?? null
  const elapsed = useElapsedMs(clockInTime)

  return (
    <Link
      to={`/members/${member._id}`}
      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
        {member.firstName[0]}
        {member.lastName[0]}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {member.firstName} {member.lastName}
        </p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Timer className="h-3 w-3" />
          {formatDuration(elapsed)}
        </p>
      </div>
    </Link>
  )
}
