// Member IDs are the team number followed by six digits. Shared by the server
// (which enforces it) and the kiosk (which uses it to tell "that isn't a Member
// ID" apart from "no such member") so the two can never disagree.
//
// Not a Convex function module — plain constants and helpers.

export const MEMBER_ID_PATTERN = /^4392\d{6}$/

export const MEMBER_ID_HINT = "Member ID must be a 10-digit number starting with 4392"

export function isMemberId(value: string): boolean {
  return MEMBER_ID_PATTERN.test(value)
}
