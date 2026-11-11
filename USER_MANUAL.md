# DeceptiveHours — User Manual

**Deceivers Robotics Team 4392**

DeceptiveHours is the team's hour tracking system. It has two parts: a mentor-unlocked **Time Clock Kiosk** that team members use to clock in and out, and a protected **Mentor Dashboard** for managing the roster and reviewing hours.

---

## Table of Contents

1. [Time Clock Kiosk](#1-time-clock-kiosk)
2. [Mentor Sign-In](#2-mentor-sign-in)
3. [Dashboard](#3-dashboard)
4. [Team Members](#4-team-members)
5. [Member Detail](#5-member-detail)
6. [Managing Users](#6-managing-users)
7. [Kiosks](#7-kiosks)
8. [Getting Around the Mentor Area](#8-getting-around-the-mentor-area)

---

## 1. Time Clock Kiosk

The kiosk is at `/clock`. There are two ways to use it.

**The tablet in the room.** A mentor sets it up once (see [Section 7](#7-kiosks)) and the tablet then runs the time clock for the rest of the season — nobody stays signed in on it, and nothing expires mid-meeting. Because no mentor is signed in, the tablet can only clock people in and out: it can't open the roster, invite anyone, or change hours, so it's safe to leave out on a bench.

**A mentor's phone.** A mentor who is already signed in can just open the time clock and sign someone in from their own phone. They stay signed in and keep full access — opening the time clock never signs them out.

### Clocking In or Out

1. Enter your **Member ID** in the text field and press **Enter** or click **Continue**.
   - Your Member ID is the 10-digit number starting with `4392` assigned when you were added to the roster. The kiosk checks the format before looking you up, so a mistyped ID tells you the number is wrong rather than that you don't exist.
2. Your name and current status will appear on screen.
3. If you are clocked out, press **Clock In**.  
   If you are already clocked in, press **Clock Out**.
4. A confirmation screen appears with a 5-second countdown, then the kiosk resets automatically for the next person. Press **Start Over Now** to skip the countdown.

If the card that comes up isn't you, press **Different Person** to go back to the entry screen without clocking anything.

### Using a QR Code

If your mentor has given you a printed QR code:

1. Click the **Scan QR Code** button below the Member ID field.
2. Allow camera access when prompted.
3. Hold your QR code inside the square outline on the camera preview — it scans automatically.
4. Your member card will appear as if you had typed your ID manually.

If the camera picks up some other QR code — a poster, a sticker — the kiosk says it isn't a Member ID and keeps scanning, so you don't have to reopen the camera.

Close the camera with the **×** in the corner of the preview. If the camera is blocked or unavailable, the scanner says so and offers **Go Back**; typing the Member ID always works instead.

> **Note:** QR scanning requires a device with a camera and browser camera permissions. The scanner uses `jsQR`, so typing the Member ID manually remains the fallback if camera access is unavailable.

### What the Kiosk Shows

Once your ID is found, the member card displays:

- Your initials, name, and member type (Student or Mentor)
- **Range Hours** — your hours for the configured reporting range. While you are clocked in, this figure includes your current session and keeps counting up.
- **Session** — how long your current session has been running, or **Status: Not in** when you are clocked out
- A Clock In or Clock Out button

If your Member ID is not found, an error message will appear and the kiosk will return to the entry screen.

---

## 2. Mentor Sign-In

Mentors sign in on the protected sign-in screen at `/login`.

1. Enter your email and password in the sign-in form on the page.
2. Complete any extra verification Clerk prompts for (for example a one-time code or a multi-factor step, if your organization requires it).
3. You'll be taken to the Dashboard automatically once sign-in succeeds.

> The sign-in form is provided by Clerk and embedded directly in the page — there's no separate site to visit. Passwords and account recovery are managed by Clerk, not by this app. If you're stuck signing in, use the "forgot password" option in the sign-in form, or reach out to whoever manages the team's Clerk organization.

There is no public sign-up — accounts are created by existing mentors only (see [Section 6](#6-managing-users)).

If you sign in with a **student** account, you'll see a "Mentor access required" screen with a **Sign out** button. Only mentor accounts can open the dashboard or unlock the kiosk.

---

## 3. Dashboard

The Dashboard (`/`) gives a live overview of team activity.

### Reporting Range

The **Reporting Range** card at the top controls which completed sessions are counted.

- **Apply** temporarily changes the dashboard report without changing the team default.
- **Save Default** stores the range used by the dashboard, kiosk, and member detail pages.
- **Reset** returns the controls to the saved default range.
- **Export** downloads the currently displayed hours table as a CSV (name, email, role, grade, Member ID, hours).

The card also spells out the active range in words, for example "Showing Jan 1, 2026 to now". If no default range has been saved yet, the app uses January 1st of the current year through now.

### Summary Cards

Three cards summarize the current range. Each one breaks its number down into **Mentors** and **Students**:

- **Currently Clocked In** — how many members are presently in a session, out of the total roster
- **Total Team Hours** — completed team hours in the selected range
- **Team Members** — how many people are on the roster

### Currently Clocked In

When at least one person is clocked in, a live grid shows each of them with a running timer. Click a name to jump to that member's detail page, or click **Clock out** to end their session from here — useful when someone has left for the day without clocking out.

Sessions open longer than 12 hours are highlighted in amber and labelled "forgot to clock out?", with a summary line above the grid. Those sessions count toward nobody's hours until they're closed, so it's worth clearing them: clocking the person out records their hours up to now, or you can correct the exact end time on their detail page.

### All Team Members

A table lists every team member sorted by hours (highest first), then by name. Columns are:

- Name (click it to open the member's detail page)
- Type badge (Student / Mentor)
- Grade, when available
- Member ID
- Hours in the selected range

---

## 4. Team Members

The Team Members page (`/members`) is where you view the roster. New people are invited from **Manage Users** (`/users`) and sync into the roster after accepting their Clerk invitation.

### Viewing Members

The table shows each member's name, type, grade, and Member ID, with a **›** button on the right that opens their detail page. The roster is sorted by last name, first name, and Member ID by default.

Use the controls above the table to:

- Search by name, email, or Member ID
- Filter by role (all / students / mentors)
- Filter by grade (6–12 or Alumni)
- Sort by clicking the **Name**, **Type**, **Grade**, or **Member ID** column headers — click the same header again to reverse the direction. The sorted column's arrow points up for ascending and down for descending; the other headers show a dimmed double arrow.
- **Export** the currently visible roster rows as a CSV

### Adding a Member

1. Open **Manage Users** (`/users`).
2. Click **Invite User**.
3. Enter the person's email address and choose **Student** or **Mentor**.
4. Send the invitation.

A Member ID is generated automatically (a 10-digit number beginning with `4392`) after the invited user accepts and syncs into the roster. The member can find their assigned ID on their detail page, where a QR code can also be generated for printing.

### Student Info

Students can have two optional fields, edited on the member's detail page:

- **Student Start Year** — the year they started with the team.
- **Current Grade** — grades 6 through 12, or Alumni.

Grades advance automatically on July 1 each year. A student listed as grade 12 becomes Alumni after the next July 1 rollover.

### Removing a Member

Members are removed from **Manage Users** (`/users`), not from the roster table.

1. Open **Manage Users** (`/users`).
2. Click the **trash icon** in the member's row.
3. A confirmation dialog will warn you that the Clerk account, roster record, and clock-in sessions will be permanently deleted.
4. Click **Remove** to confirm.

> This action cannot be undone.

---

## 5. Member Detail

Click a member's name on the Dashboard, or the **›** button on the Team Members page, to open their detail page (`/members/:id`). The **←** button in the header returns to the roster.

### Member Info

The card at the top shows the member's first name, last name, Member ID, and type, plus student start year and grade for students. Click **Edit** to change any of these in a dialog — including the Member ID, which must stay a 10-digit number starting with `4392` and must not already belong to someone else.

Set **Current Grade** to **Not set**, or clear **Student Start Year**, to remove either value again.

> Changing **Type** writes the new role to the person's Clerk account, so it sticks. You cannot remove your own mentor access — the app blocks that so you can't lock yourself out.

> Names are a local correction only. Clerk is the source of truth for them, so a later Clerk update or **Sync Clerk** run can overwrite a name you edit here.

### QR Code

Click **QR Code** to reveal a card with a scannable QR code containing the member's ID, alongside their name and Member ID. **Print** sends just that card to your printer — the rest of the page is left off — which is how you make badges for the kiosk. Click **Hide** to collapse it again.

### Hours in Range

A summary card shows the member's total completed hours and completed session count for the selected reporting range.

### Reporting Range

The **Reporting Range** card sets the range used by this page only.

- **Apply** shows the member's hours and sessions for the dates you picked.
- **Reset** returns to the team's saved default range.
- **Export Hours** downloads a CSV containing:
  - Member and range details
  - Raw completed session rows
  - Daily hour totals
  - Monday–Sunday weekly hour totals
  - Total completed hours, completed session count, and the number of active sessions omitted from the export

### Clock Sessions

A table of clock sessions in the selected reporting range, with columns for:

- **Date**
- **Clock In** time
- **Clock Out** time — or an **Active** badge if the session is still running, which turns into an amber **Open 12h+** badge once it looks like a forgotten clock-out
- **Duration**
- Edit and delete buttons

#### Adding a Session Manually

Click **Add Session**, fill in the clock-in and clock-out times using the date/time pickers, and click **Add Session**. Leave **Clock Out** blank to create an active (ongoing) session.

Times can't be in the future. A session dated ahead of now would make the live timers count backwards and would block that member from clocking in at the kiosk until it was corrected.

#### Closing an Active Session

An active session's row has a **Clock out** button that ends it at the current time. Use **Edit** instead if you need to set the exact time the person actually left.

#### Editing a Session

Click the **pencil icon** on any row, adjust the times, and click **Update**.

#### Deleting a Session

Click the **trash icon** on any row and confirm. Sessions that are still in progress (no clock-out time) can also be deleted this way.

> Sessions can't overlap. If a new or edited session runs into another one for the same member, the save is rejected with "Session overlaps an existing session" — fix the other session's times first.

---

## 6. Managing Users

Only a currently signed-in mentor can invite new accounts — there is no public sign-up.

### Inviting

1. Sign in to the mentor dashboard.
2. In the left sidebar, click **Manage Users**.
3. Click **Invite User** in the top-right corner.
4. Enter the person's **email address** and choose their **Role** (Student or Mentor).
5. Click **Send Invitation**.

The invited person receives an email from Clerk to accept the invitation and set their own password. Once accepted, they appear automatically in the Team Members roster with the role you selected — no manual account creation step is needed.

### Pending Invitations

The **Pending Invitations** table lists everyone who has been invited but hasn't accepted yet, with the role they were invited as and the date the invitation was sent. **Revoke** cancels one, and **Refresh** re-reads the list from Clerk.

If you try to invite an address that already has an invitation waiting, the app says so and points you here — revoke the old one first if you need to change their role.

### Removing

Use the search box above the table to narrow a long roster, then click the **trash icon** in a user's row and confirm. This deletes the Clerk account, the roster record, and all of that person's clock sessions. Your own row is marked **(you)** and its trash icon is disabled — the app will not let you remove the account you are signed in with.

### Sync Clerk

**Sync Clerk** re-reads every account from Clerk and reconciles the local roster with it: missing people are created and changed names/emails/roles are updated. Use it if an invitation was accepted but the person never showed up in the roster, or if a role change in Clerk didn't take effect — those are signs a webhook was missed. A toast reports how many users were scanned, created, and updated.

**Sync never deletes anything on its own.** If it finds roster records whose Clerk account no longer exists, it tells you how many and asks whether to remove them. Removing them also permanently deletes those people's clock sessions and logged hours, so the confirmation spells that out — choose **Keep them** if you're not certain.

> Passwords are managed entirely by Clerk, not by this app. If someone needs a password reset, they can use the "forgot password" option on the sign-in form — mentors can't reset passwords on a user's behalf from within DeceptiveHours.

---

## 7. Kiosks

A **kiosk** is a tablet that runs the time clock without anyone signed in. Manage them from **Kiosks** in the sidebar.

### Setting up the tablet

Do this **on the tablet itself**, not on your own computer:

1. Sign in on the tablet as a mentor.
2. Open **Kiosks** in the sidebar.
3. Give it a name you'll recognise later, like "Shop tablet".
4. Click **Set up and sign out**.

The tablet registers itself, signs you out, and lands on the time clock. From then on:

- It keeps working for about a year — no one has to sign in again each meeting.
- It can **only** clock people in and out. Anyone who pokes at the address bar and tries to reach the roster or Manage Users gets a sign-in page.
- You stay signed in everywhere else. Signing out happens on the tablet only.

### Keeping track of kiosks

The **Active kiosks** table shows each tablet's name, when it was last used to clock someone in, and when it expires. Use it to confirm the tablet in the room is the one that's actually being used.

### Removing a kiosk

Click the **trash icon** next to a kiosk and confirm. It stops working immediately and shows a "Kiosk not active" screen until a mentor sets it up again. Do this if a tablet is lost, replaced, or retired at the end of the season. Removing a kiosk doesn't touch anybody's hours.

> You don't need a kiosk to use your own phone. Just open the time clock while signed in.

---

## 8. Getting Around the Mentor Area

The mentor area has a left sidebar (a **☰** menu button on phones and tablets) with:

- **Dashboard**, **Team Members**, **Manage Users**, and **Kiosks** navigation
- **← Deceivers Apps** — back to the team's app portal
- **← Time Clock Kiosk** — open the kiosk on this browser

The kiosk has a matching **Mentor dashboard →** link in the top-right of its header, so you aren't stranded there after opening it.

The header on every mentor page has a **light / dark / system** theme switcher and your Clerk account button, which is where you manage your profile and sign out.

---

## Frequently Asked Questions

**My Member ID doesn't work at the kiosk.**  
Ask a mentor to check that your name appears in the Team Members list and that your ID is correct. IDs are 10-digit numbers beginning with `4392`.

**I forgot to clock out yesterday.**  
Ask a mentor to clock you out. They can do it straight from the Dashboard's **Currently Clocked In** grid, or open your Member Detail page and edit the session to set the exact time you actually left.

**The kiosk says "Kiosk locked" or "Kiosk not active".**  
That tablet isn't registered as a kiosk, or its registration was removed or expired. A mentor can sign in on the tablet and set it up again from **Kiosks** — no hours are lost.

**The kiosk says "Already clocked in" or "Not clocked in."**  
Someone (or a stale session) already put you in the opposite state. A mentor can fix it from your Member Detail page by editing or deleting the session in question.

**The QR scanner isn't working.**  
Make sure the kiosk device has a camera and that you have granted camera permission to the site. You can always type your Member ID manually instead.

**Why don't the kiosk and dashboard totals match?**  
The dashboard, roster, and exports count only completed sessions. The kiosk's **Range Hours** adds your currently running session on top, so it reads higher until you clock out.

**Someone accepted their invitation but isn't on the roster.**  
Open **Manage Users** and click **Sync Clerk**. That pulls the roster straight from Clerk instead of waiting on a webhook.

**How do I make someone a mentor?**  
Open their Member Detail page, click **Edit**, and change **Type** to Mentor. That writes the role to their Clerk account. You can't change your own role away from Mentor.

**A report says there are too many sessions in the range.**  
A single member can hold up to 500 sessions in one reporting range. Narrow the start and end dates and apply the range again — the app refuses to show a total it would have to cut short rather than quietly under-reporting someone's hours.

**All the dates look like team time, even when I'm travelling.**  
That's deliberate. Every date and time in the app is shown in the team's local time zone so a session always falls on the day the team worked it, whatever zone you're reading from.
