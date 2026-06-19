# med-referral (standalone)

Medication referral **documentation** tool for non-prescribing clinicians. Captures a client's psychotropic regimen and observed response using validated instruments, then produces an SBAR referral for a prescriber. It **documents and routes** — it never assesses dosing, interactions, or labs. See `MedReferral_Clinical_Foundation.md` and `MedReferral_Schema_Spec.md`.

## Run locally
```bash
npm install
cp .env.example .env        # set MONGODB_URI (a TEST db), FIELD_ENCRYPTION_KEY
npm run dev                 # http://localhost:5000/health
```
Generate an encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Test
```bash
npm test                    # runs unit + integration (vitest)
npx vitest run src/__tests__/unit.test.js   # pure logic, no Mongo needed
```
- **unit.test.js** — encryption, totals, consent gate, export gating, no-verdict guarantee. Runs anywhere.
- **db.integration.test.js** — persistence + select:false + decrypt-on-export. Needs a MongoDB binary (mongodb-memory-server downloads one on first run, or set `MONGOMS_SYSTEM_BINARY`).

## Deploy (Render, isolated)
1. New GitHub repo (separate from CounselorReady).
2. New Render **web service** from it.
3. Env vars: `MONGODB_URI` (separate test DB / cluster), `FIELD_ENCRYPTION_KEY`, `STUB_CLINICIAN_ID`. Render injects `PORT`.
4. Smoke from the Render shell: `node src/scripts/smokeTest.js`.

## Design invariants (enforced in code)
- **Capture and route, never assess.** No `dosageStatus` / `mgPerKg` / `medicationLoadFlag` — a test asserts their absence.
- **Encrypt until needed.** Prescriber/pharmacy/ROI contact fields are AES-256-GCM encrypted, `select:false`, and decrypted **only** in the referral-export service.
- **Consent-gated export.** No referral generates unless `consent.roiOnFile` is true and unexpired.
- **Totals only.** Pre-save hook computes each instrument's own sum; never a verdict.
- **Audit.** create/update/export write `AuditEvent` rows.

## Open: auth
`clinicianId` and `middleware/auth.js` are **stubbed** for the test environment. Replace with independent JWT auth or wire to shared CounselorReady auth before any real use. This is the one decision the scaffold defers.
