<!-- Thanks for contributing a tariff! Keep PRs to plan STRUCTURES only. -->

## What this adds / changes
<!-- e.g. "Add AGL Night Saver EV (NSW / Ausgrid)" -->

## Checklist
- [ ] **No personal data** — no account number, NMI/MPAN, meter id, name, address,
      email or phone. Only the plan *structure*. (CI runs a PII scan.)
- [ ] Entry validates against `schema/v1/tariff.schema.json` (`npm run validate`).
- [ ] `meta.id` is unique; file path mirrors country/region/provider/plan.
- [ ] `meta.source` + `meta.license` are correct:
  - `manual`/`urdb` → `CC0-1.0`; `cdr` (AER) → `other` (public CDR Product Reference Data; attribution in `notes`).
  - I did **not** paste Octopus (or other non-redistributable) data — `source: octopus`
    is rejected; real Octopus rates are imported on-device only.
- [ ] Times in `import.schedule[]` are local to `meta.timezone`; I used real
      boundaries (e.g. `15:30`), not rounded.
- [ ] `meta.verified` is `true` only if I checked the rates against an
      authoritative source/bill (and set `meta.verifiedAgainst`).

## Source
<!-- Where the rates came from (link). For your own plan: "own bill" (don't attach it). -->
