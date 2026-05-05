# Proforma Builder Showcase

A collection of production code samples extracted from a real-world proforma invoice generator built with Laravel 13, React 19, and Inertia.js — a heavy machinery sales tool covering client management, machine template presets, dynamic proforma editing with live currency conversion, DomPDF export, and email delivery with PDF attachments.

## Samples

### Proforma Controller (`ProformaController`)
The core controller handling the full proforma lifecycle — creation, PDF generation, email delivery, and status management.

- Generates proforma PDFs via `barryvdh/laravel-dompdf` using a private `buildPdf()` helper that resolves company settings, logo path, and machine image filesystem paths
- Streams inline PDF preview (`preview()`) and forces download (`pdf()`) from the same blade template
- `send()` validates multiple recipients, generates the PDF in memory, dispatches `ProformaMailable`, and transitions status to `sent` only after successful mail dispatch
- `duplicate()` wraps cloning in a `DB::transaction`, copies all fields and related items, nulls `client_id`, resets status to `draft`, and relies on the model boot hook for a new unique number
- `index()` eager-loads client with email for send dialog prefill, supports debounced backend search across proforma number and client name
- Total calculation: `subtotal`, `tax_amount`, and `total` computed from line items on every store/update

### Machine Template Controller (`MachineTemplateController`)
Manages reusable machine spec presets with image upload, compression, and safe deletion.

- `storeUploadedImages()` stores each uploaded file to the `public` disk then immediately opens it via `Intervention\Image`, scales it down to max 1200px width preserving aspect ratio, re-encodes as JPEG at 80% quality, and writes the optimized version back — reducing typical upload sizes from ~3MB to ~200KB
- On update, `retained_images` (an explicit array of paths to keep) is compared against current images; removed entries are deleted from disk via `deletePublicImage()` before the new set is persisted
- `duplicate()` copies all fields including `base_price` and structured `optional_extras` but excludes images

### Client Controller (`ClientController`)
Standard resource controller extended with CSV bulk import.

- `import()` reads an uploaded CSV file row-by-row using `fgetcsv`, skips rows with a blank `name`, and upserts by `email` when present — otherwise always inserts
- Handles nullable fields explicitly: empty strings are cast to `null` before persistence
- `importTemplate()` returns a streamed CSV download containing only the header row for user reference
- Search filters across `name`, `email`, `city`, `tax_number`, `registration_number`, and `phone` using `LIKE` queries

### Proforma Model (`Proforma`)
Eloquent model with automatic proforma number generation.

- `booted()` registers a `static::creating()` hook that assigns `number` only when absent
- Number format: `PRF-{YEAR}-{0001}` with 4-digit zero-padded sequence
- Yearly reset: queries only the current year's prefix (`PRF-YYYY-`) using `withTrashed()` to include soft-deleted records and avoid duplicate key violations
- Safe fallback: malformed or missing historical suffixes default to `0001`
- JSON casts on `spec_fields`, `included_features`, `optional_extras`, and `images`; `status` cast to `ProformaStatus` backed enum

### Proforma Mailable (`ProformaMailable`)
Laravel Mailable that attaches a pre-generated PDF in memory.

- Constructor accepts `Proforma`, dynamic `$subject`, optional `$customMessage`, and raw `$pdfContent` string
- `envelope()` sets the dynamic subject and conditionally adds `replyTo` from `company_email` company setting — skipped if not configured
- `attachments()` uses `Attachment::fromData()` with a closure returning the raw PDF bytes, named `{proforma->number}.pdf` with `application/pdf` MIME type — no temp files written to disk
- Mail view receives proforma details (number, issue date, total, currency) and company name for signature

### DomPDF Blade Template (`proforma.blade.php`)
Server-side PDF template reproducing the original Excel proforma layout with inline CSS.

- All styling is inline (DomPDF limitation — no external stylesheets)
- Header: company logo loaded via `public_path()` (DomPDF cannot load assets over HTTP), company details right-aligned, multiple bank accounts iterated from JSON setting
- Items table: first item's description cell contains a nested `spec-table` rendering all spec key-value pairs as bordered sub-rows; amount columns vertically centered against the full spec row height
- Gratis detection: `unit_price === 0.0 && tax_rate === 0.0` renders `0,00` across all amount columns
- Two-column section below items: included features and optional extras as bullet lists
- Dimensions line derived by scanning `spec_fields` for keys containing `length`, `width`, or `height` (case-insensitive)
- Machine images loaded as filesystem paths via `public_path(ltrim($url, '/'))` with existence check — missing files silently skipped
- Currency line: for RSD/HUF includes exchange rate clause; for EUR omits it
- Money formatting: `number_format($value, 2, ',', '.')` for European decimal style

### Proforma Form (`proforma-form.tsx`)
Rich React editor component for creating and editing proformas.

- Searchable client and machine template selectors using shadcn Combobox (Popover + Command)
- Template selection auto-populates spec fields, included features, optional extras labels, images, and line items — first item uses `base_price`, subsequent items use `optional_extras` with `is_gratis` controlling tax rate (0% vs 20%)
- Currency selector (RSD / EUR / HUF); switching to RSD or HUF automatically fetches the current EUR rate from `api.exchangerate-api.com/v4/latest/EUR` and prefills the editable exchange rate field
- Unit prices auto-converted on currency or exchange rate change: `base_price * exchange_rate` for RSD/HUF, raw `base_price` for EUR
- Dynamic line items: add/remove rows, chassis number field on first row only, read-only row total (`quantity * unit_price`)
- Live subtotal / VAT / total recalculation on every item change
- `sanitizeFormData()` strips empty spec rows, features, and extras before submit; normalizes numeric fields

### Proforma Index (`index.tsx`)
List page combining table interactions, inline status management, PDF preview, and email sending.

- Row click opens inline PDF preview in a new browser tab via `window.open(preview.url(id), '_blank')`
- Actions column: Preview, Download, Copy, Send (Mail icon), Edit, Delete — all with `e.stopPropagation()` to prevent row click conflict
- Status badge opens a shadcn DropdownMenu with all four statuses; selection sends `router.patch()` to update status without leaving the list
- Send dialog: dynamic recipient list pre-filled with `proforma.client?.email`, editable subject pre-filled as `Proforma Invoice {number}`, optional message textarea, submitted via Inertia `useForm` with `forceFormData: true`
- Debounced backend search (300ms) across proforma number and client name
- Ellipsis pagination on desktop, ±1 on mobile

## Stack

- **Backend:** Laravel 13, PHP 8.4, MySQL
- **Frontend:** React 19, Inertia.js v2, TypeScript, Tailwind CSS v4, shadcn/ui
- **Tables:** TanStack Table v8
- **PDF:** barryvdh/laravel-dompdf
- **Images:** Intervention Image
- **Email:** Laravel Mailable
- **Routing:** Laravel Wayfinder
