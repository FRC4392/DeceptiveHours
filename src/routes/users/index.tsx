import { useCallback, useEffect, useState } from "react"
import { useAction, useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Mail, RefreshCw, Trash2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { formatDate } from "@/lib/format"

type Role = "student" | "mentor"

interface RemoveTarget {
  id: Id<"teamMembers">
  clerkUserId: string
}

interface PendingInvitation {
  id: string
  email: string
  role: Role
  createdAt: number
}

export default function UsersPage() {
  const members = useQuery(api.teamMembers.list)
  const me = useQuery(api.users.me)
  const inviteUser = useAction(api.clerk.inviteUser)
  const removeUser = useAction(api.clerk.removeUser)
  const syncUsers = useAction(api.clerk.syncUsers)
  const listPendingInvitations = useAction(api.clerk.listPendingInvitations)
  const revokeInvitation = useAction(api.clerk.revokeInvitation)

  const [search, setSearch] = useState("")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>("student")
  const [inviting, setInviting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null)
  const [removing, setRemoving] = useState(false)
  const [pruneCount, setPruneCount] = useState<number | null>(null)
  const [pruning, setPruning] = useState(false)

  // Invitations live in Clerk, so they come from an action rather than a live
  // query and are refreshed explicitly after anything that changes them.
  const [invitations, setInvitations] = useState<PendingInvitation[] | null>(null)
  const [loadingInvitations, setLoadingInvitations] = useState(true)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  // No setState before the first await: `loadingInvitations` starts true, so
  // the mount-time fetch below never has to flip it synchronously inside the
  // effect (which would cascade a render).
  const loadInvitations = useCallback(async () => {
    try {
      const pending = await listPendingInvitations({})
      setInvitations(pending)
    } catch (err) {
      setInvitations(null)
      toast.error(err instanceof Error ? err.message : "Failed to load invitations")
    } finally {
      setLoadingInvitations(false)
    }
  }, [listPendingInvitations])

  async function refreshInvitations() {
    setLoadingInvitations(true)
    await loadInvitations()
  }

  // Pending invitations live in Clerk and are reachable only through a Node
  // action, so unlike every other list in the app they cannot be a reactive
  // `useQuery` — fetching once on mount is the only option. The setState
  // happens after an await, which the lint rule cannot see through.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInvitations()
  }, [loadInvitations])

  async function handleRevoke(invitationId: string, email: string) {
    setRevokingId(invitationId)
    try {
      await revokeInvitation({ invitationId })
      toast.success(`Invitation to ${email} revoked`)
      await refreshInvitations()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke invitation")
    } finally {
      setRevokingId(null)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setInviting(true)
    try {
      await inviteUser({ email: trimmed, role })
      toast.success(`Invitation sent to ${trimmed}`)
      setInviteOpen(false)
      setEmail("")
      setRole("student")
      await refreshInvitations()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation")
    } finally {
      setInviting(false)
    }
  }

  async function handleRemove() {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await removeUser({ clerkUserId: removeTarget.clerkUserId })
      toast.success("User removed")
      setRemoveTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove user")
    } finally {
      setRemoving(false)
    }
  }

  // Sync never deletes on its own. It reports how many roster rows have no
  // Clerk account left, and removing those — which also deletes every clock
  // session they own — is a separate, confirmed step.
  async function handleSyncUsers() {
    setSyncing(true)
    try {
      const result = await syncUsers({})
      toast.success(
        `Synced ${result.scanned} Clerk users: ${result.created} created, ${result.updated} updated`,
      )
      if (result.removable > 0) setPruneCount(result.removable)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync Clerk users")
    } finally {
      setSyncing(false)
    }
  }

  async function handlePrune() {
    setPruning(true)
    try {
      const result = await syncUsers({ removeMissing: true })
      toast.success(
        `Removed ${result.deleted} roster ${result.deleted === 1 ? "record" : "records"} with no Clerk account`,
      )
      setPruneCount(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove stale records")
    } finally {
      setPruning(false)
    }
  }

  const removeMember = members?.find((m) => m._id === removeTarget?.id)

  const visibleMembers = (members ?? []).filter((member) => {
    const needle = search.trim().toLowerCase()
    if (!needle) return true
    return (
      `${member.firstName} ${member.lastName}`.toLowerCase().includes(needle) ||
      member.email.toLowerCase().includes(needle)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold italic uppercase tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Invite or remove Clerk accounts. Use Sync Clerk if webhooks miss an
            update — it never deletes anything without asking first.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleSyncUsers} disabled={syncing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync Clerk"}
          </Button>
          <Button onClick={() => setInviteOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Invite User
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <CardTitle>All Users ({visibleMembers.length})</CardTitle>
          <Input
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search users"
          />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-16 text-right">Remove</TableHead>
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
                    No users yet. Click{" "}
                    <button
                      className="font-medium text-primary underline-offset-4 hover:underline"
                      onClick={() => setInviteOpen(true)}
                    >
                      Invite User
                    </button>{" "}
                    to get started.
                  </TableCell>
                </TableRow>
              )}
              {members && visibleMembers.length === 0 && members.length > 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No users match that search.
                  </TableCell>
                </TableRow>
              )}
              {visibleMembers.map((member) => {
                // The server rejects self-removal anyway; disabling the control
                // says so before the mentor commits to a confirmation dialog.
                const isSelf = member.email === me?.email
                return (
                  <TableRow key={member._id}>
                    <TableCell className="font-medium">
                      {member.firstName} {member.lastName}
                      {isSelf && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{member.email}</TableCell>
                    <TableCell>
                      <Badge variant={member.type === "mentor" ? "default" : "secondary"}>
                        {member.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        disabled={!member.clerkUserId || isSelf}
                        aria-label={
                          isSelf
                            ? "You cannot remove your own account"
                            : `Remove ${member.firstName} ${member.lastName}`
                        }
                        title={isSelf ? "You cannot remove your own account" : undefined}
                        onClick={() =>
                          setRemoveTarget({ id: member._id, clerkUserId: member.clerkUserId })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="person@team.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={role} onValueChange={(v) => v && setRole(v as Role)}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="mentor">Mentor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviting} className="gap-2">
                <Mail className="h-4 w-4" />
                {inviting ? "Sending…" : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pending invitations — Clerk-side only until accepted */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Pending Invitations{invitations ? ` (${invitations.length})` : ""}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={refreshInvitations}
            disabled={loadingInvitations}
          >
            <RefreshCw className={`h-4 w-4 ${loadingInvitations ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead className="w-24 text-right">Revoke</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations === null && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    {loadingInvitations ? "Loading…" : "Could not load invitations."}
                  </TableCell>
                </TableRow>
              )}
              {invitations?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No invitations are waiting to be accepted.
                  </TableCell>
                </TableRow>
              )}
              {invitations?.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="font-medium">{invitation.email}</TableCell>
                  <TableCell>
                    <Badge variant={invitation.role === "mentor" ? "default" : "secondary"}>
                      {invitation.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(invitation.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-destructive hover:text-destructive"
                      disabled={revokingId === invitation.id}
                      onClick={() => handleRevoke(invitation.id, invitation.email)}
                    >
                      {revokingId === invitation.id ? "…" : "Revoke"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Stale-record pruning, offered only when a sync finds some */}
      <AlertDialog open={pruneCount !== null} onOpenChange={(o) => !o && setPruneCount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove stale roster records?</AlertDialogTitle>
            <AlertDialogDescription>
              {pruneCount} roster{" "}
              {pruneCount === 1 ? "record has" : "records have"} no matching Clerk
              account. Removing {pruneCount === 1 ? "it" : "them"} also permanently
              deletes {pruneCount === 1 ? "that person's" : "those people's"} clock
              sessions and logged hours. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handlePrune}
              disabled={pruning}
            >
              {pruning ? "Removing…" : "Remove records"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Confirmation */}
      <AlertDialog open={removeTarget !== null} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{" "}
              <strong>
                {removeMember?.firstName} {removeMember?.lastName}
              </strong>{" "}
              from Clerk, along with their local roster record and clock-in sessions. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemove}
              disabled={removing}
            >
              {removing ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
