# SiLapor - Facility Service & Complaints Information System
**Target Audience:** Students (Mahasiswa) and Administrators/Technicians of Universitas Sanata Dharma.
**Core Purpose:** A ticketing and tracking system for reporting broken facilities, tracking repair status, and managing maintenance tasks.

## 1. Design System & Theme

### 1.1. Color Palette
*   **Primary Brand (Red/Maroon):** `#8C1515` (Approximate based on sidebar/buttons). Used for the main sidebar, primary buttons, and headers.
*   **Background:** Light Gray `#F9FAFB` (Tailwind `bg-gray-50`).
*   **Surface/Cards:** White `#FFFFFF`.
*   **Text:** 
    *   Primary: `#111827` (Tailwind `text-gray-900`)
    *   Secondary: `#6B7280` (Tailwind `text-gray-500`)
*   **Status Colors (Badges & Charts):**
    *   **Success (Selesai/Verified):** Green `#10B981`
    *   **Warning (Sedang Diproses):** Yellow/Orange `#F59E0B`
    *   **Danger (Ditolak/Batal):** Red `#EF4444`
    *   **Info (Terkirim/Draft):** Blue `#3B82F6`
    *   **Purple (Diproses admin):** Purple `#8B5CF6`

### 1.2. Typography
*   **Font Family:** Clean Sans-Serif (e.g., `Inter`, `Poppins`, or `Roboto`).
*   **Headings:** Bold, dark gray.
*   **Body:** Regular weight, easily readable for forms and data tables.

### 1.3. UI Components
*   **Buttons:** Rounded corners (approx. `rounded-md` or `rounded-lg`). Solid primary color for primary actions, outlined or ghost variants for secondary actions.
*   **Cards:** White background, slight shadow (`shadow-sm`), rounded corners (`rounded-xl`), used to contain forms, dashboard widgets, and list items.
*   **Inputs/Forms:** Light gray borders (`border-gray-200`), rounded (`rounded-md`), focus state should highlight with a subtle ring.
*   **Status Badges:** Small rounded pills with background color at 10-20% opacity and text color at 100% opacity of the status color.

---

## 2. Layout Structures

### 2.1. Student Portal Layout
*   **Left Sidebar:** Fixed width. Deep red background, white text. Contains logo, app name, navigation links with icons (Submit Report, View Status, Report History, Edit Submission), and a Logout button at the bottom.
*   **Top Header (Content Area):** App title "SiLapor - Universitas Sanata Dharma" on the left, User Profile (Avatar, Name, Role) on the right.
*   **Main Content:** Scrollable area containing the active page content (cards, forms, tables).

### 2.2. Admin Portal Layout
*   **Top Navigation Bar:** White background, sticky top. Contains Logo and App Name on the left. Centered navigation pills (Ubah Status, Riwayat, Rekap). Right side contains Date/Period selector and Admin Profile.
*   **Main Content:** Full width, taking advantage of screen space for dashboards and detailed split-view panels.

---

## 3. Page Specifications

### Page 1: Authentication (Login / Create Account)
*   **Background:** Full-screen high-quality photo of the university campus with a dark overlay.
*   **Header (Floating):** University logo and centered bold text: "Biro Layanan Umum dan Sarana Prasarana Universitas Sanata Dharma".
*   **Auth Card:** Center-aligned white card with rounded corners (`rounded-3xl`).
*   **Fields:** NIM (Student ID), Email, Password, Confirm Password, Phone Number.
*   **Actions:** Full-width deep red "Login" / "Register" button. Text link at the bottom to toggle between Login and Sign Up.

### Page 2: Student - Submit Report (`Buat Laporan`)
*   **Layout:** Student Portal Sidebar + Header.
*   **Main Card:** "Buat Laporan" title.
*   **Form Grid:** 2-column layout for shorter inputs.
    *   Category Dropdown & Date Picker (Row 1).
    *   Report Title & Location Dropdown/Input (Row 2).
    *   Problem Description: Full-width Textarea (max 500 characters).
*   **Attachment Section:** "Foto/Lampiran". Displays up to 3 image thumbnails with red 'x' delete badges. Dashed border box with a "+" icon to add more.
*   **Footer Actions:** Right-aligned "Batal" (Cancel - outline/gray) and "Kirim" (Send - solid red with send icon) buttons.

### Page 3: Student - Report History (`Riwayat Laporan`)
*   **Layout:** Student Portal Layout.
*   **Summary Widgets (Top):** 4 horizontal cards showing status summaries:
    *   Total Laporan (Gray/Neutral)
    *   Sedang Diproses (Orange/Yellow indicator)
    *   Selesai (Green indicator)
    *   Ditolak/Dibatalkan (Red indicator)
*   **Filter Bar:** Search input, Status dropdown, Category dropdown, Date/Month dropdown, Filter icon button.
*   **Data List/Table:** A clean, borderless list view. Each row contains:
    *   Date & Time
    *   Title & Location (with pin icon)
    *   Category Badge
    *   Status Badge (color-coded)
    *   Attachment count (e.g., "3 Foto")
    *   Action Button: "Detail ->" (Dark red button) + Star/Bookmark icon.
*   **Pagination:** Bottom right (Previous, 1, 2, 3, Next).

### Page 4: Admin - Ticket Detail & Update Status (`Ubah Status`)
*   **Layout:** Admin Topbar Layout.
*   **Left Column (Information):** 
    *   Report Title & Description text.
    *   Reporter Info (Name, NIM, Major) and Location.
    *   Photo Evidence grid.
    *   Handling History (Vertical stepper/timeline showing Laporan Masuk, Diterima Dispatcher, Verifikasi Koordinator, etc.).
*   **Right Column (Action Form):** 
    *   "Perbarui Status & Penugasan" Title.
    *   Ticket Status Dropdown.
    *   Technician Assignment Dropdown (with Name and NIP).
    *   Target Time input & Spare parts needed input.
    *   Checklist Field: Actionable checkboxes for field readiness (e.g., "MCB Dimatikan", "Suku Cadang Siap").
    *   Message for Reporter: Textarea for user-facing response.
    *   Internal Notes (Locked icon): Textarea for internal technician instructions.
    *   Actions: "Tolak Laporan" (Reject - text link), "Simpan Draft" (Save outline), "Terbitkan Surat Tugas" (Publish Task - solid red button).

### Page 5: Admin - Dashboard Analytics (`Rekap`)
*   **Layout:** Admin Topbar Layout.
*   **Top KPI Cards (5 items):** Showing Count, Status Name, and percentage of total.
    *   Terkirim (Orange), Sedang Diverifikasi (Blue), Ditolak (Red), Terverifikasi (Green), Diproses (Purple), Selesai (Dark Green).
*   **Main Grid layout (Bento-box style):**
    *   **Trend Chart:** Line chart showing "Tren Laporan per Hari" with a smooth curve and markers.
    *   **Status Distribution:** Donut chart showing "Laporan Berdasarkan Status" with a total number in the center.
    *   **Category Breakdown:** Horizontal progress bars/bar chart showing top categories and percentages.
    *   **Top Locations:** List of locations with count and percentage (Campus III, Campus II, etc.).
    *   **Recent Reports:** Mini list view of the latest incoming reports with icon, title, location, date, and status badge.
    *   **Map Distribution:** Interactive map view with clustered numbered map pins indicating problem hotspots.

---

## 4. Vibe Coding Prompts & Tips

*   **UI Framework:** Prefer React with Tailwind CSS. Use `lucide-react` for icons (they closely match the UI icons shown).
*   **Components:** When generating forms, utilize `react-hook-form`. For charts on the admin dashboard, utilize `recharts` or `chart.js` (Recharts is preferred for React vibe coding).
*   **Layout Wrapper:** Create two distinct layout components: `<StudentLayout>` (Sidebar based) and `<AdminLayout>` (Topbar based). 
*   **Micro-interactions:** Add hover states on table rows (`hover:bg-gray-50`), focus rings on inputs (`focus:ring-2 focus:ring-red-700`), and smooth transitions for interactive elements.