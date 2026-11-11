import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { useNavigate } from "react-router"
import { useClerk } from "@clerk/react"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate, formatDateTime } from "@/lib/format"
import { readKioskToken, writeKioskToken } from "@/lib/kiosk-token"
import { Tablet, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { errorMessage } from "@/lib/errors"

export default function KiosksPage() {
  const devices = useQuery(api.kiosk.listDevices)
  const registerDevice = useMutation(api.kiosk.registerDevice)
  const revokeDevice = useMutation(api.kiosk.revokeDevice)
  const { signOut } = useClerk()
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [registering, setRegistering] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<{
    id: Id<"kioskDevices">
    name: string
  } | null>(null)
  const [revoking, setRevoking] = useState(false)
  const alreadyKiosk = readKioskToken() !== null

  /**
   * Turns the device the mentor is holding into the kiosk, then signs them out
   * of Clerk on it. Signing out is the point: afterwards the tablet is
   * authorized only by its device token, so it can clock people in and out and
   * reach nothing else — and it keeps working once the mentor's Clerk session
   * would have expired.
   */
  async function handleSetUpThisDevice(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setRegistering(true)
    try {
      const { token } = await registerDevice({ name: trimmed })
      if (!writeKioskToken(token)) {
        throw new Error(
          "This browser blocked local storage, so the kiosk token could not be saved. Turn off private browsing and try again.",
        )
      }
      toast.success(`${trimmed} is now a kiosk — signing out of this device`)
      // Replace history so Back cannot return to the mentor area.
      await signOut({ redirectUrl: "/clock" })
      navigate("/clock", { replace: true })
    } catch (err) {
      toast.error(errorMessage(err, "Failed to set up this kiosk"))
      setRegistering(false)
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      await revokeDevice({ deviceId: revokeTarget.id })
      toast.success(`${revokeTarget.name} can no longer clock anyone in`)
      setRevokeTarget(null)
    } catch (err) {
      toast.error(errorMessage(err, "Failed to remove kiosk"))
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold italic uppercase tracking-tight">
          Kiosks
        </h1>
        <p className="text-muted-foreground">
          Tablets that run the time clock without a mentor signed in.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Set up this device</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Do this <strong>on the tablet itself</strong>. It registers this browser
            as a kiosk and signs you out of it. From then on the tablet can clock
            people in and out and nothing else — it can't reach the roster, invites
            or anyone's hours — and it keeps working for about a year without
            anyone signing in again.
          </p>
          {alreadyKiosk && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              This browser already holds a kiosk token. Setting it up again replaces
              that token; the old one keeps working until you remove it below.
            </p>
          )}
          <form onSubmit={handleSetUpThisDevice} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="kiosk-name">Kiosk name</Label>
              <Input
                id="kiosk-name"
                placeholder="Shop tablet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="gap-2" disabled={registering || !name.trim()}>
              <Tablet className="h-4 w-4" />
              {registering ? "Setting up…" : "Set up and sign out"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Using your own phone to clock someone in? You don't need this — just open
            the time clock. You'll stay signed in.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active kiosks ({devices?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-16 text-right">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!devices && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {devices?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No kiosks yet. Set one up from the tablet you leave in the room.
                  </TableCell>
                </TableRow>
              )}
              {devices?.map((device) => (
                <TableRow key={device._id}>
                  <TableCell className="font-medium">{device.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {device.lastSeenAt ? formatDateTime(device.lastSeenAt) : "Never"}
                  </TableCell>
                  <TableCell>
                    {device.isExpired ? (
                      <Badge variant="secondary">Expired</Badge>
                    ) : (
                      <span className="text-muted-foreground">
                        {formatDate(device.expiresAt)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      aria-label={`Remove ${device.name}`}
                      onClick={() => setRevokeTarget({ id: device._id, name: device.name })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={revokeTarget !== null} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this kiosk?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{revokeTarget?.name}</strong> will stop working immediately and
              will ask for a mentor to set it up again. Use this if a tablet is lost
              or retired. No hours or roster records are affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRevoke}
              disabled={revoking}
            >
              {revoking ? "Removing…" : "Remove kiosk"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
