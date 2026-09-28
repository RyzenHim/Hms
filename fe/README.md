# Document Workspace

The application chooser at `/` opens either the existing healthcare workspace at
`/hms` or the WiFi bill generator at `/wifi`.

## WiFi bills

Choose **Current month** (the device's local month, refreshed before export) or
**Custom month** (any selected month/year). Both preserve the reference PDF's
schedule: service from the previous month's 5th to the selected month's 4th, bill
date on the 6th, due date on the 16th. Dates are derived together, including across
year boundaries. The visible August reference bill opens as an editable template,
including customer/provider details, account/invoice numbers, plan, payment
history, tariff, GST, issuer and statutory values. Change any input, or switch to
**Current month** to use the device-derived schedule, then preview or download a
four-page A4 PDF.

Amounts may include or exclude GST. The total GST rate can be split into CGST and
SGST/UTGST or shown as IGST. The plan amount covers all connections. Discounts
reduce the plan charge before tax; previous balances, payments, payment coupons and credits adjust
the amount payable after tax. The amount after the due date is calculated automatically
from that outstanding value: no late fee below ₹300; ₹100 from ₹300 through ₹5,000;
or 2% above ₹5,000, capped at ₹750. A fixed 18% GST is added to the late fee.
The left-side late-fee editor can override the calculated fee for a specific draft;
clearing the override restores the automatic policy. Monetary calculations use integer
paise and preserve rounding differences.

Bills and QR codes are generated in the browser. **Save draft** stores the current
edits in MongoDB at any time after a customer name is entered; incomplete bill
fields are allowed. Use **Saved customers & bills** to reopen a saved draft or
start a new bill for a customer. Reopened bills keep their saved month. Unsaved
changes are indicated, and replacing/leaving an edited draft prompts before
discarding changes. Saving is explicit; PDF preview/download does not save a draft.

Enter the operator's UPI ID, payment recipient, acquiring-bank MCC and transaction
description. For Airtel bills, the UPI ID follows `<accountNumber>.FL@mairtel`
until it is manually overridden. The QR and visible payment link use a `upi://pay` intent whose `am`
and `mam` values equal the current amount payable. Scanning the QR therefore opens
a compatible UPI app with the recipient, reference and amount prefilled. The same
link is clickable in the live preview and is added as a URI annotation over the QR
and payment text in exported PDFs (viewer support for custom URI schemes varies).

The reference payment QR's complete field set is retained: `pa`, `pn`, `mc`, `tr`,
`tn`, `cu`, `am`, `mam`, `mode`, `purpose`, and its comma-delimited `orgId`
invoice metadata (`InvNo`, bill date, item count, HSN/SAC, seller GSTIN, bank/IFSC,
GST breakdown, CESS and invoice total). Every bill-specific value is rebuilt from
the current form and calculated totals. The reference PDF's inconsistent hidden QR
amount/tax values are not copied. A zero payable balance has no payment QR. The
reference contains no signed e-invoice QR. The visible customer details and all
three historical payment rows are prefilled and remain editable.

The tax invoice uses one Code 128 symbol in the Billing Address block. Its scan
payload is editable independently from the printed bill and account identifiers;
blank values fall back to the account number. The supplied bill prefills its decoded
payload, while the identifiers and state/place-of-supply labels retain the reference layout.

The exact Airtel logo extracted from the reference PDF is bundled at
`../be/assets/wifi/airtel-logo.png` and stored in Cloudinary. The backend serves its
persisted cloud URL from `GET /api/wifi/operator`; `POST /api/wifi/operator/logo`
ensures upload with a deterministic source-hash ID if needed. Credentials stay in
the backend (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
`CLOUDINARY_API_SECRET`). Only the logo is uploaded. The browser embeds a loaded
copy of that cloud image on all PDF pages and waits for QR/logo decoding before
capture; failures are shown with a retry action. Editing the provider to another
business removes Airtel branding.

### Code organization

- `src/types/wifi-bill.ts`: editable bill data and calculated totals.
- `src/lib/wifi-bill.ts`: defaults, validation, dates, currency and tax calculations.
- `src/lib/wifi-api.ts`: customer history, draft persistence, version/error handling.
- `src/lib/wifi-qr.ts`: UPI payload and invoice metadata built from the current bill.
- `src/components/wifi/`: form, workspace and printable four-page template.
- `src/lib/pdf-export.ts`: shared `html2canvas-pro` / `jsPDF` export used by both HMS
and WiFi, with the existing A4 sizing and image compression.
- `src/components/PdfPreviewModal.tsx`: shared PDF preview and download interface.

### Customer and bill storage

`WifiCustomer` stores the customer's current profile under a stable MongoDB ID.
Names are indexed labels, not unique identifiers, so two people may share a name.
Each `WifiBill` references its customer and stores an independent typed snapshot
of all bill fields. The customer's `bills` virtual and the bill's compound
customer/date index support history without an unbounded list of IDs in the
customer record. Amounts use Decimal128; empty draft amounts remain null and
roundtrip to empty form fields. Unknown fields are rejected.

Creation uses a client-generated UUID to prevent duplicate drafts when retrying a
timed-out request. Updates compare and increment a version atomically; stale
updates return 409 without overwriting edits. Customer/profile changes and bill
saves run in a transaction, requiring MongoDB Atlas or a replica set. Editing an
old bill's charges does not revert newer customer profile fields; explicitly
changed profile fields update the customer while other bills keep their snapshots.

Backend routes (under `/api/wifi`):

- `GET /customers`, `GET /customers/:id`: customer list and bill history.
- `GET /bills/:id`: full saved snapshot and version.
- `POST /bills`: `{ clientDraftId, customerId?, data }` creates a draft.
- `PUT /bills/:id`: `{ version, data }` updates a draft.

The backend uses the existing `DB` environment variable. Unavailable connections
return a retryable error, and the form retains the user's edits. Backend schemas
live in `be/models/WifiCustomer.js` and `be/models/WifiBill.js`, with draft
validation and serialization in `be/services/wifi-bill-data.js`.

### Checks

Use Node 22.18+ or Node 24+ for the test command, which runs the TypeScript domain
directly through Node's built-in type stripping; no additional test dependencies
are required.

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Tests cover the sample's ₹999 + 18% = ₹1,178.82, tax-inclusive charges, split-tax
rounding, discounts, payment adjustments, credit balances, invalid amounts,
reference cycle/year boundaries, current/custom month selection, payment QR
metadata, and the field limits for printable documents. Backend logo tests run
with `npm test` from `be`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The chooser is in `src/app/page.tsx`; the healthcare editor is in
`src/app/hms/page.tsx`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
