import { useQuery } from "convex/react"
import { Link } from "react-router"
import { api } from "@convex/_generated/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDuration, formatTotalHours } from "@/lib/format"
import { useElapsedMs } from "@/hooks/use-elapsed-ms"
import { Clock, Timer, Users, UserCheck } from "lucide-react"

export default function DashboardPage() {
  const data = useQuery(api.dashboard.getDashboardData)

  if (!data) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of team hours and attendance</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Currently Clocked In
            </CardTitle>
            <UserCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.currentlySignedIn.length}</p>
            <p className="text-xs text-muted-foreground">
              of {data.members.length} members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Team Hours (YTD)
            </CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatTotalHours(data.totalCompletedMs)}
            </p>
            <p className="text-xs text-muted-foreground">completed hours this year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Team Members
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.members.length}</p>
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
                <TableHead>Member ID</TableHead>
                <TableHead className="text-right">Hours (YTD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No members yet.{" "}
                    <Link to="/members" className="text-primary underline-offset-4 hover:underline">
                      Add your first member →
                    </Link>
                  </TableCell>
                </TableRow>
              )}
              {data.members
                .slice()
                .sort((a, b) => b.completedMs - a.completedMs)
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
