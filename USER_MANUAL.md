# DeceptiveHours — User Manual

**Deceivers Robotics Team 4392**

DeceptiveHours is the team's hour tracking system. It has two parts: a public **Time Clock Kiosk** that any team member uses to clock in and out, and a protected **Mentor Dashboard** for managing the roster and reviewing hours.

---

## Table of Contents

1. [Time Clock Kiosk](#1-time-clock-kiosk)
2. [Mentor Sign-In](#2-mentor-sign-in)
3. [Dashboard](#3-dashboard)
4. [Team Members](#4-team-members)
5. [Member Detail](#5-member-detail)
6. [Adding Mentor Accounts](#6-adding-mentor-accounts)

---

## 1. Time Clock Kiosk

The kiosk is the home screen (`/`) and is always public — no login required. It is designed to run on a shared screen such as a Raspberry Pi display at the build space entrance.

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

> **Note:** QR scanning requires a device with a camera and a browser that supports the BarcodeDetector API (Chrome and Edge on desktop/Android). It is not supported on Safari.

### What the Kiosk Shows

Once your ID is found, the member card displays:

- Your name and member type (Student or Mentor)
- Your total hours for the current year
- How long your current session has been running (if clocked in)
- A Clock In or Clock Out button

If your Member ID is not found, an error message will appear and the kiosk will return to the entry screen.

---

## 2. Mentor Sign-In

Mentors access the protected dashboard at `/login`.

1. Enter your **email address** and **password**.
2. Click **Sign In**.
3. You will be redirected to the Dashboard.

> If you have forgotten your password, contact another mentor who can create a new account for you, or reach out to whoever manages the system.

There is no public sign-up — accounts are created by existing mentors only (see [Section 6](#6-adding-mentor-accounts)).

---

## 3. Dashboard

The Dashboard (`/dashboard`) gives a live overview of team activity.

### Summary Cards

At the top of the page, three cards show:

- **Currently Clocked In** — the number of members presently in a session
- **Total Hours YTD** — all completed team hours since January 1st of the current year
- **Total Members** — the total number of people on the roster

### Currently Clocked In

A live grid shows every member who is currently clocked in, with a running timer showing how long they have been in the building.

### All Members

A table lists every team member sorted by total hours (highest first). Each row shows:

- Name
- Member type badge (Student / Mentor)
- Total hours year-to-date
- A link to their Member Detail page

---

## 4. Team Members

The Team Members page (`/members`) is where you manage the roster.

### Viewing Members

The page shows a table of all members with their name, type, and Member ID.

### Adding a Member

1. Click **Add Member** in the top-right corner.
2. Fill in:
   - **First Name** and **Last Name**
   - **Member Type** — Student or Mentor
3. Click **Add Member**.

A Member ID is generated automatically (a 10-digit number beginning with `4392`). The member can find their assigned ID on their detail page, where a QR code can also be generated for printing.

### Removing a Member

1. Click the **trash icon** next to the member's name.
2. A confirmation dialog will warn you that all of the member's clock-in sessions will also be permanently deleted.
3. Click **Remove** to confirm.

> This action cannot be undone.

---

## 5. Member Detail

Click any member's name or the **view icon** to open their detail page (`/members/:id`).

### Member Info

The card at the top shows the member's name, ID, and type. Click **Edit** to update any of these fields.

### QR Code

Click **Show QR Code** to display a scannable QR code containing the member's ID. This can be screenshotted or printed and given to the member to use at the kiosk.

### Year-to-Date Stats

A summary card shows the member's total completed hours for the current year.

### Session History

A full table of every clock session is shown, with columns for:

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

## 6. Adding Mentor Accounts

Only a currently signed-in mentor can create new accounts — there is no public sign-up.

1. Sign in to the mentor dashboard.
2. In the left sidebar, click **Add Mentor Account**.
3. Enter the new mentor's **email address** and a **temporary password**.
4. Click **Create Account**.
5. Share the credentials with the new mentor and ask them to sign in.

> Passwords cannot be changed from within the app. If a mentor needs a new password, delete their account and create a new one with a new password, or have your system administrator update it directly via the Convex dashboard.

---

## Frequently Asked Questions

**My Member ID doesn't work at the kiosk.**  
Ask a mentor to check that your name appears in the Team Members list and that your ID is correct. IDs are 10-digit numbers beginning with `4392`.

**I forgot to clock out yesterday.**  
Ask a mentor to open your Member Detail page, find the session with the missing clock-out time, and edit it to add the correct time.

**The QR scanner isn't working.**  
Make sure you are using Chrome or Edge (not Safari), and that you have granted camera permission to the site. If the browser doesn't support QR scanning, you can always type your Member ID manually instead.

**The kiosk shows the wrong hours.**  
Hours shown are year-to-date (since January 1st of the current year) and include only completed sessions. A currently running session is shown separately as a live timer and is not counted in your total until you clock out.
