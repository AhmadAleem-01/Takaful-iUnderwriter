# App Design Context

The maintained visual reference is INSURANCE_APP_DESIGN_GUIDE.md. Runtime theme tokens in src/styles/globals.css and shared controls in src/components/ui remain authoritative.

Inquiry uses a compact action header with a five-metric strip and a 70/30 desktop Details layout. Inquiry Details is expanded initially; other form sections collapse independently. AI Extracted Response is expanded at the bottom, with individual response accordions initially collapsed, neutral surfaces, confidence bars, and the existing evidence popup. The decision, submitted-risk, and completeness cards use existing data and save paths. Email has its own tab with a conversation list, selected-message reader, filters, search, and the original rich-text composer. Actions, Quotes, RI Capacity Checks, Documents, and History remain separate tabs. Fields retain 11px title-case labels and 13px values. Layouts stack on small screens. The sidebar header toggles between 280px navigation and an 80px icon rail; AppShell owns shared state and page padding.

Inquiry field additions reuse the existing Field, ReadOnlyValue, and Select controls, two-column desktop layout, and stacked mobile layout. Dependent choice fields use numeric backend values, clear the dependent selection when the parent changes, and persist clearing as null through the normal Save action.

The Details decision rail scrolls normally rather than sticking. AI heading icons, active category filters, and confidence bars use the secondary purple theme token; surrounding surfaces stay neutral. Email list and reader are separated by a full-height border on desktop and a horizontal border when stacked.

Shared form-field-surface backgrounds use #e5eefa73. Underwriting Action appears only in the right-hand card, using the existing form state and save handler for both dependent choice fields.

Vehicle Value displays the average of the backend text range without overwriting the source range. Quote PDFs use the Al-Buhaira logo; this does not change application branding.

Premium monetary fields use comma-grouped amount displays. The shared AmountInput shows the raw decimal value during editing and formatted grouping on blur; form state and backend payloads retain numeric values. Percentage fields keep their existing controls.

Underwriting Action is a separate two-column section immediately after Details. Quote creation copies saved inquiry total charge and gross premium, copies the selected plan VAT directly, and retains loading premium at 10 percent of gross premium without adding it to the copied total.

Motor Insurance inquiries show read-only Driver Information and Vehicle Information from aur_customer_data JSON, with safe fallbacks for missing or malformed answers. Base Premium Percentage displays without decimal places and keeps its stored value. Quote VAT is a percentage, including in PDF output. Quote IntegerType columns round to nearest integer at persistence; exact decimal storage requires a Dataverse schema change.
