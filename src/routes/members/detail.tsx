import { useState } from "react"
import { useParams, Link } from "react-router"
import { useMutation, useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { QRCodeSVG } from "qrcode.react"
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
import {
  ArrowLeft,
  Pencil,
  Plus,
  Trash2,
  QrCode,
} from "lucide-react"
import { toast } from "sonner"
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatTotalHours,
  toDatetimeLocal,
  fromDatetimeLocal,
} from "@/lib/format"

type MemberType = "student" | "mentor"

interface SessionForm {
  clockIn: string
  clockOut: string
}

interface MemberForm {
  firstName: string
  lastName: string
  memberId: string
  type: MemberType
}

function yearStart(): number {
  const d = new Date()
  return new Date(d.getFullYear(), 0, 1).getTime()
}

export default function MemberDetailPage() {
  const { memberId } = useParams<{ memberId: string }>()
  const id = memberId as Id<"teamMembers">

  const member = useQuery(api.teamMembers.getById, { id })
  const sessions = useQuery(api.clockSessions.getForMember, { teamMemberId: id })
  const updateMember = useMutation(api.teamMembers.update)
  const addSession = useMutation(api.clockSessions.addSession)
  const updateSession = useMutation(api.clockSessions.updateSession)
  const deleteSession = useMutation(api.clockSessions.deleteSession)

  const [editMemberOpen, setEditMemberOpen] = useState(false)
  const [memberForm, setMemberForm] = useState<MemberForm | null>(null)
  const [savingMember, setSavingMember] = useState(false)

  const [sessionDialogOpen, setSessionDialogOpen] = useState(false)
  const [editingSessionId, setEditingSessionId] = useState<Id<"clockSessions"> | null>(null)
  const [sessionForm, setSessionForm] = useState<SessionForm>({ clockIn: "", clockOut: "" })
  const [savingSession, setSavingSession] = useState(false)

  const [deleteSessionId, setDeleteSessionId] = useState<Id<"clockSessions"> | null>(null)
  const [showQr, setShowQr] = useState(false)

  if (!member || !sessions) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (member === null) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Member not found.{" "}
        <Link to="/members" className="text-primary underline-offset-4 hover:underline">
          Back to members
        </Link>
      </div>
    )
  }

  const ys = yearStart()
  const yearSessions = sessions.filter((s) => s.clockIn >= ys && s.clockOut)
  const totalYearMs = yearSessions.reduce((acc, s) => acc + (s.clockOut! - s.clockIn), 0)

  function openAddSession() {
    const now = Date.now()
    setSessionForm({ clockIn: toDatetimeLocal(now - 3_600_000), clockOut: toDatetimeLocal(now) })
    setEditingSessionId(null)
    setSessionDialogOpen(true)
  }

  function openEditSession(session: { _id: Id<"clockSessions">; clockIn: number; clockOut?: number }) {
    setSessionForm({
      clockIn: toDatetimeLocal(session.clockIn),
      clockOut: session.clockOut ? toDatetimeLocal(session.clockOut) : "",
    })
    setEditingSessionId(session._id)
    setSessionDialogOpen(true)
  }

  async function handleSaveSession(e: React.FormEvent) {
    e.preventDefault()
    const clockInTs = fromDatetimeLocal(sessionForm.clockIn)
    const clockOutTs = sessionForm.clockOut ? fromDatetimeLocal(sessionForm.clockOut) : undefined
    if (clockOutTs && clockOutTs <= clockInTs) {
      toast.error("Clock out must be after clock in")
      return
    }
    setSavingSession(true)
    try {
      if (editingSessionId) {
        await updateSession({ id: editingSessionId, clockIn: clockInTs, clockOut: clockOutTs })
        toast.success("Session updated")
      } else {
        await addSession({ teamMemberId: id, clockIn: clockInTs, clockOut: clockOutTs })
        toast.success("Session added")
      }
      setSessionDialogOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save session")
    } finally {
      setSavingSession(false)
    }
  }

  async function handleDeleteSession(sid: Id<"clockSessions">) {
    try {
      await deleteSession({ id: sid })
      toast.success("Session deleted")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete session")
    } finally {
      setDeleteSessionId(null)
    }
  }

  function openEditMember() {
    setMemberForm({
      firstName: member!.firstName,
      lastName: member!.lastName,
      memberId: member!.memberId,
      type: member!.type,
    })
    setEditMemberOpen(true)
  }

  async function handleSaveMember(e: React.FormEvent) {
    e.preventDefault()
    if (!memberForm) return
    setSavingMember(true)
    try {
      await updateMember({ id, ...memberForm })
      toast.success("Member updated")
      setEditMemberOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update member")
    } finally {
      setSavingMember(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/members">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-bold italic uppercase tracking-tight">
            {member.firstName} {member.lastName}
          </h1>
          <p className="text-sm text-muted-foreground">Member profile and sessions</p>
        </div>
      </div>

      {/* Member info card */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between">
            <CardTitle>Member Info</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowQr((v) => !v)}
              >
                <QrCode className="h-4 w-4" />
                {showQr ? "Hide" : "QR Code"}
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={openEditMember}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                First Name
              </p>
              <p className="mt-1 font-medium">{member.firstName}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Last Name
              </p>
              <p className="mt-1 font-medium">{member.lastName}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Member ID
              </p>
              <p className="mt-1 font-mono font-medium">{member.memberId}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Type
              </p>
              <div className="mt-1">
                <Badge variant={member.type === "mentor" ? "default" : "secondary"}>
                  {member.type}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Year-to-Date</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="font-heading text-4xl font-extrabold italic tabular-nums">{formatTotalHours(totalYearMs)}</p>
              <p className="text-sm text-muted-foreground">total hours</p>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              <p>{yearSessions.length} completed sessions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* QR Code */}
      {showQr && (
        <Card>
          <CardHeader>
            <CardTitle>Member QR Code</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <div className="rounded-xl border bg-white p-4">
              <QRCodeSVG value={member.memberId} size={160} />
            </div>
            <p className="text-sm text-muted-foreground">
              This QR code encodes the Member ID:{" "}
              <span className="font-mono font-medium">{member.memberId}</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sessions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Clock Sessions</CardTitle>
          <Button size="sm" className="gap-2" onClick={openAddSession}>
            <Plus className="h-4 w-4" />
            Add Session
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No sessions yet.
                  </TableCell>
                </TableRow>
              )}
              {sessions.map((session) => {
                const duration = session.clockOut
                  ? session.clockOut - session.clockIn
                  : null
                return (
                  <TableRow key={session._id}>
                    <TableCell className="text-sm">{formatDate(session.clockIn)}</TableCell>
                    <TableCell className="text-sm">{formatDateTime(session.clockIn)}</TableCell>
                    <TableCell className="text-sm">
                      {session.clockOut ? (
                        formatDateTime(session.clockOut)
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {duration !== null ? formatDuration(duration) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditSession(session)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteSessionId(session._id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Member Dialog */}
      <Dialog open={editMemberOpen} onOpenChange={setEditMemberOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
          </DialogHeader>
          {memberForm && (
            <form onSubmit={handleSaveMember} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={memberForm.firstName}
                    onChange={(e) =>
                      setMemberForm((f) => f && { ...f, firstName: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={memberForm.lastName}
                    onChange={(e) =>
                      setMemberForm((f) => f && { ...f, lastName: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Member ID</Label>
                <Input
                  value={memberForm.memberId}
                  onChange={(e) =>
                    setMemberForm((f) => f && { ...f, memberId: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={memberForm.type}
                  onValueChange={(v) =>
                    setMemberForm((f) => f && { ...f, type: v as MemberType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="mentor">Mentor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditMemberOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={savingMember}>
                  {savingMember ? "Saving…" : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Add / Edit Session Dialog */}
      <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSessionId ? "Edit Session" : "Add Session"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveSession} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clockIn">Clock In</Label>
              <Input
                id="clockIn"
                type="datetime-local"
                value={sessionForm.clockIn}
                onChange={(e) =>
                  setSessionForm((f) => ({ ...f, clockIn: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clockOut">Clock Out</Label>
              <Input
                id="clockOut"
                type="datetime-local"
                value={sessionForm.clockOut}
                onChange={(e) =>
                  setSessionForm((f) => ({ ...f, clockOut: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Leave blank for an active (ongoing) session.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSessionDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingSession}>
                {savingSession ? "Saving…" : editingSessionId ? "Update" : "Add Session"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Session Confirmation */}
      <AlertDialog
        open={deleteSessionId !== null}
        onOpenChange={(o) => !o && setDeleteSessionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this clock session. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteSessionId && handleDeleteSession(deleteSessionId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
