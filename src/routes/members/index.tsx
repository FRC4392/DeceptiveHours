import { useMemo, useState } from "react"
import { Link } from "react-router"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { downloadCsv } from "@/lib/csv"
import { formatStudentGrade, type StudentGrade } from "@/lib/student-info"
import { ArrowUpDown, ChevronRight, Download, UserPlus } from "lucide-react"

type SortKey = "name" | "type" | "grade" | "memberId"
type SortDirection = "asc" | "desc"

export default function MembersPage() {
  const members = useQuery(api.teamMembers.list)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [gradeFilter, setGradeFilter] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  const visibleMembers = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (members ?? [])
      .filter((member) => {
        const grade = formatStudentGrade(member.displayGrade)
        const matchesSearch =
          !needle ||
          `${member.firstName} ${member.lastName}`.toLowerCase().includes(needle) ||
          member.memberId.toLowerCase().includes(needle) ||
          member.email.toLowerCase().includes(needle)
        const matchesRole = roleFilter === "all" || member.type === roleFilter
        const matchesGrade = gradeFilter === "all" || grade === gradeFilter
        return matchesSearch && matchesRole && matchesGrade
      })
      .slice()
      .sort((a, b) => {
        const direction = sortDirection === "asc" ? 1 : -1
        let result: number
        if (sortKey === "name") {
          result =
            a.lastName.localeCompare(b.lastName) ||
            a.firstName.localeCompare(b.firstName) ||
            a.memberId.localeCompare(b.memberId)
        } else if (sortKey === "type") {
          result = a.type.localeCompare(b.type)
        } else if (sortKey === "grade") {
          result = gradeSortValue(a.displayGrade) - gradeSortValue(b.displayGrade)
        } else {
          result = a.memberId.localeCompare(b.memberId)
        }
        return result * direction
      })
  }, [gradeFilter, members, roleFilter, search, sortDirection, sortKey])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(key)
      setSortDirection("asc")
    }
  }

  function exportRosterCsv() {
    downloadCsv("team-roster.csv", [
      ["Name", "Email", "Role", "Grade", "Student Start Year", "Member ID"],
      ...visibleMembers.map((member) => [
        `${member.firstName} ${member.lastName}`,
        member.email,
        member.type,
        formatStudentGrade(member.displayGrade),
        member.studentStartYear,
        member.memberId,
      ]),
    ])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold italic uppercase tracking-tight">Team Members</h1>
          <p className="text-muted-foreground">
            Roster synced from Clerk. Add, invite, or remove people from Users.
          </p>
        </div>
        <Link to="/users">
          <Button variant="outline" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Manage Users
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>Roster ({visibleMembers.length})</CardTitle>
            <Button variant="outline" className="gap-2" onClick={exportRosterCsv} disabled={!members}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
            <Input
              placeholder="Search name, email, or Member ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v ?? "all")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="student">Students</SelectItem>
                <SelectItem value="mentor">Mentors</SelectItem>
              </SelectContent>
            </Select>
            <Select value={gradeFilter} onValueChange={(v) => setGradeFilter(v ?? "all")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All grades</SelectItem>
                {[6, 7, 8, 9, 10, 11, 12].map((grade) => (
                  <SelectItem key={grade} value={String(grade)}>
                    Grade {grade}
                  </SelectItem>
                ))}
                <SelectItem value="Alumni">Alumni</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortButton label="Name" onClick={() => toggleSort("name")} />
                </TableHead>
                <TableHead>
                  <SortButton label="Type" onClick={() => toggleSort("type")} />
                </TableHead>
                <TableHead>
                  <SortButton label="Grade" onClick={() => toggleSort("grade")} />
                </TableHead>
                <TableHead>
                  <SortButton label="Member ID" onClick={() => toggleSort("memberId")} />
                </TableHead>
                <TableHead className="w-16 text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!members && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {members?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No members yet. Invite people from{" "}
                    <Link
                      to="/users"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Users
                    </Link>{" "}
                    to populate the roster.
                  </TableCell>
                </TableRow>
              )}
              {members && visibleMembers.length === 0 && members.length > 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No members match the current filters.
                  </TableCell>
                </TableRow>
              )}
              {visibleMembers.map((member) => (
                <TableRow key={member._id}>
                  <TableCell className="font-medium">
                    {member.firstName} {member.lastName}
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
                  <TableCell className="text-right">
                    <Link to={`/members/${member._id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
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

function gradeSortValue(grade: StudentGrade | null | undefined): number {
  if (grade === "alumni") return 13
  return grade ?? 0
}

function SortButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="-ml-3 gap-1 px-2" onClick={onClick}>
      {label}
      <ArrowUpDown className="h-3.5 w-3.5" />
    </Button>
  )
}
