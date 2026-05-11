import { query } from "./_generated/server"

function yearStart(): number {
  const d = new Date()
  return new Date(d.getFullYear(), 0, 1).getTime()
}

export const getDashboardData = query({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db.query("teamMembers").collect()
    const allSessions = await ctx.db.query("clockSessions").collect()

    const ys = yearStart()

    const membersWithStats = members.map((member) => {
      const sessions = allSessions.filter((s) => s.teamMemberId === member._id)
      const currentSession = sessions.find((s) => !s.clockOut) ?? null
      const completedMs = sessions.reduce((acc, s) => {
        if (s.clockOut && s.clockIn >= ys) return acc + (s.clockOut - s.clockIn)
        return acc
      }, 0)
      return { ...member, completedMs, currentSession }
    })

    const currentlySignedIn = membersWithStats.filter((m) => m.currentSession !== null)
    const totalCompletedMs = membersWithStats.reduce((acc, m) => acc + m.completedMs, 0)

    return { members: membersWithStats, currentlySignedIn, totalCompletedMs }
  },
})
