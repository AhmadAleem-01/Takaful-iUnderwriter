# Duplicate inquiry criteria v1

Store the JSON document in `aur_duplicate_inquiry_criteria` on the parent product referenced by an inquiry's `aur_line_of_business` lookup. The Aviation example is [aviation.json](aviation.json). Other parent products need their own JSON; an empty field is reported as **not configured**.

The format has three checks:

- `insured`: `normalizedEqual` compares whole text values after Unicode, case, and whitespace normalization. An insured mismatch excludes the candidate.
- `identifiers`: `anyOverlap` compares normalized identifier values across named groups. At least one group must overlap. Different values from evidence excerpts require review because the excerpt may not show the full fleet; direct complete answer values can establish a separate risk.
- `period`: `overlapOrRenewalEqual` compares inclusive ISO `YYYY-MM-DD` start and end ranges. If complete ranges are unavailable, two renewal dates may match. Different known dates mean separate transactions; missing or contradictory dates require review.

Sources are `inquiry.insuredName` for the insured, or saved AI extraction records identified by business rule: `response:Renewal Date`, `evidence:Fleet Schedule (Reg No, Pass/Crew Seat, Attachment date, Status)`, `responseId:<business-rule-guid>`, and `evidenceId:<business-rule-guid>`. The insured can also be mapped to an exact AI answer in the editor. The editor stores a rule ID when a listed business rule is selected. Answer text is used when it contains an exact value; evidence is used when the answer merely summarizes a document. The Aviation template reads registrations and `MSN` serials from Fleet Schedule evidence and the start and end dates from Policy Period evidence. Missing or ambiguous values lead to manual review. Customer Information is not scanned.

The parent product editor's **Duplicate Inquiries** tab builds and validates this JSON before saving it to the field. Existing plain-English criteria stay in place until a guided rule is saved. The original email record's earliest inbound `createdon` is used for provisional broker priority. When there is no inbound email timestamp, the inquiry's `createdon` is used and labeled as such. Underwriters retain the final decision.
