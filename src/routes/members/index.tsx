import { Link } from "react-router"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronRight, UserPlus } from "lucide-react"

export default function MembersPage() {
  const members = useQuery(api.teamMembers.list)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold italic uppercase tracking-tight">Team Members</h1>
          <p className="text-muted-foreground">
            Roster synced from WorkOS. Add, invite, or remove people from Users.
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
        <CardHeader>
          <CardTitle>Roster ({members?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Member ID</TableHead>
                <TableHead className="w-16 text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!members && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {members?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
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
              {members?.map((member) => (
                <TableRow key={member._id}>
                  <TableCell className="font-medium">
                    {member.firstName} {member.lastName}
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.type === "mentor" ? "default" : "secondary"}>
                      {member.type}
                    </Badge>
                  </TableCell>
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
