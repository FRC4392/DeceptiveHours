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

---

## 1. Time Clock Kiosk

The kiosk is at `/clock`. A mentor must sign in on the kiosk browser first, then the shared screen can stay open for team members to clock in and out.

### Clocking In or Out

1. Enter your **Member ID** in the text field and press **Enter** or click the arrow button.
   - Your Member ID is the 10-digit number starting with `4392` assigned when you were added to the roster.
2. Your name and current status will appear on screen.
3. If you are clocked out, press **Clock In**.  
   If you are already clocked in, press **Clock Out**.
4. A confirmation screen will appear briefly, then the kiosk resets automatically for the next person.

### Using a QR Code

If your mentor has given you a printed QR code:

1. Click the **QR Code** icon button next to the input field.
2. Allow camera access when prompted.
3. Hold your QR code up to the camera — it will scan automatically.
4. Your member card will appear as if you had typed your ID manually.

> **Note:** QR scanning requires a device with a camera and browser camera permissions. The scanner uses `jsQR`, so typing the Member ID manually remains the fallback if camera access is unavailable.

### What the Kiosk Shows

Once your ID is found, the member card displays:

- Your name and member type (Student or Mentor)
- Your total hours for the configured reporting range
- How long your current session has been running (if clocked in)
- A Clock In or Clock Out button

If your Member ID is not found, an error message will appear and the kiosk will return to the entry screen.

---

## 2. Mentor Sign-In

Mentors access the protected dashboard at `/login`.

1. Click **Sign in with Clerk**.
2. You'll be taken to a Clerk sign-in page — enter your credentials there.
3. You'll be redirected back to the Dashboard automatically.

> Passwords and account recovery are managed by Clerk, not by this app. If you're stuck signing in, use the "forgot password" option on the Clerk sign-in page, or reach out to whoever manages the team's Clerk organization.

There is no public sign-up — accounts are created by existing mentors only (see [Section 6](#6-managing-users)).

---

## 3. Dashboard

The Dashboard (`/`) gives a live overview of team activity.

### Summary Cards

At the top of the page, three cards show:

- **Currently Clocked In** — the number of members presently in a session
- **Total Hours** — all completed team hours in the configured or applied reporting range
- **Total Members** — the total number of people on the roster

### Hours Range

Use the **Hours Range** controls to choose which completed sessions are counted.

- **Apply** temporarily changes the dashboard report without changing the team default.
- **Save Default** stores the range used by the dashboard, kiosk, and member detail pages.
- **Reset** returns the controls to the saved default range.
- **Export** downloads the currently displayed dashboard hours table as a CSV.

If no default range has been saved yet, the app uses January 1st of the current year through now.

### Currently Clocked In

A live grid shows every member who is currently clocked in, with a running timer showing how long they have been in the building.

### All Members

A table lists every team member sorted by total hours (highest first). Each row shows:

- Name
- Member type badge (Student / Mentor)
- Grade, when available
- Total hours in the selected range
- A link to their Member Detail page

---

## 4. Team Members

The Team Members page (`/members`) is where you view the roster. New people are invited from **Manage Users** (`/users`) and sync into the roster after accepting their Clerk invitation.

### Viewing Members

The page shows a table of all members with their name, type, grade, and Member ID. The roster is sorted by last name, first name, and Member ID by default.

Use the controls above the table to:

- Search by name, email, or Member ID
- Filter by role
- Filter by grade
- Sort by name, type, grade, or Member ID
- Export the currently visible roster rows as a CSV

### Adding a Member

1. Open **Manage Users** (`/users`).
2. Click **Invite User**.
3. Enter the person's email address and choose **Student** or **Mentor**.
4. Send the invitation.

A Member ID is generated automatically (a 10-digit number beginning with `4392`) after the invited user accepts and syncs into the roster. The member can find their assigned ID on their detail page, where a QR code can also be generated for printing.

### Student Info

Students can have two optional fields:

- **Student Start Year** — the year they started with the team.
- **Current Grade** — grades 6 through 12, or Alumni.

Grades advance automatically on July 1 each year. A student listed as grade 12 becomes Alumni after the next July 1 rollover.

### Removing a Member

1. Click the **trash icon** next to the member's name.
2. A confirmation dialog will warn you that all of the member's clock-in sessions will also be permanently deleted.
3. Click **Remove** to confirm.

> This action cannot be undone.

---

## 5. Member Detail

Click any member's name or the **view icon** to open their detail page (`/members/:id`).

### Member Info

The card at the top shows the member's name, ID, type, and student info when applicable. Click **Edit** to update these fields.

### QR Code

Click **Show QR Code** to display a scannable QR code containing the member's ID. This can be screenshotted or printed and given to the member to use at the kiosk.

### Hours Range Stats

A summary card shows the member's total completed hours and completed session count for the selected reporting range.

Use **Reporting Range** to temporarily change the date range for this member. Click **Export Hours** to download a CSV that includes:

- Member and range details
- Raw completed session rows
- Daily hour totals
- Monday-Sunday weekly hour totals
- Total completed hours, completed session count, and active sessions omitted from the export

### Session History

A table of clock sessions in the selected reporting range is shown, with columns for:

- **Date**
- **Clock In** time
- **Clock Out** time
- **Duration**
- Edit and delete buttons

#### Adding a Session Manually

Click **Add Session**, fill in the clock-in and clock-out times using the date/time pickers, and click **Save**.

#### Editing a Session

Click the **pencil icon** on any row, adjust the times, and click **Save**.

#### Deleting a Session

Click the **trash icon** on any row and confirm. Sessions that are still in progress (no clock-out time) can also be deleted this way.

---

## 6. Managing Users

Only a currently signed-in mentor can invite new accounts — there is no public sign-up.

1. Sign in to the mentor dashboard.
2. In the left sidebar, click **Manage Users**.
3. Click **Invite User** in the top-right corner.
4. Enter the person's **email address** and choose their **Role** (Student or Mentor).
5. Click **Invite User** to send the invitation.

The invited person receives an email from Clerk to accept the invitation and set their own password. Once accepted, they appear automatically in the Team Members roster with the role you selected — no manual account creation step is needed.

> Passwords are managed entirely by Clerk, not by this app. If someone needs a password reset, they can use the "forgot password" option on the Clerk sign-in page — mentors can't reset passwords on a user's behalf from within DeceptiveHours.

---

## Frequently Asked Questions

**My Member ID doesn't work at the kiosk.**  
Ask a mentor to check that your name appears in the Team Members list and that your ID is correct. IDs are 10-digit numbers beginning with `4392`.

**I forgot to clock out yesterday.**  
Ask a mentor to open your Member Detail page, find the session with the missing clock-out time, and edit it to add the correct time.

**The QR scanner isn't working.**  
Make sure the kiosk device has a camera and that you have granted camera permission to the site. You can always type your Member ID manually instead.

**The kiosk shows the wrong hours.**  
Hours shown use the saved reporting range from the dashboard and include completed sessions. A currently running session is shown separately as a live timer and is not counted in the saved completed total until you clock out.
