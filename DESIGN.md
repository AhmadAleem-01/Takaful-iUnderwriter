# App Design Context

Health inquiry grid uses workflow filters rather than vehicle types: Intake (Draft/Created/Product Match/Emirates ID), Verification (ICP/DOH), KYC Required, AI Processing (including Determined), Awaiting Review and Quote Sent. Status codes drive membership, with shared-label fallback for missing numeric codes. Health uses the stage URL parameter and ignores vehicle-type scopes; Motor retains existing type chips. All Inquiries always includes every record in the selected product view.

Inquiry toolbar row one is Inquiry View label on the left and Motor/Health buttons on the right. Row two groups inquiry-type chips on the left with search and Clear Filters on the right, stacking responsively when needed. Search belongs to the type-filter row, not the product-view row.

Inquiry queue controls use a single compact toolbar: product-view buttons on the left, search and Clear Filters on the right, and inquiry-type chips on a separated second row within the same surface. Do not add separate view-description or search cards. Controls stack on narrow screens.

Inquiry list has Motor and Health product views, defaulting to Motor. URL view=health selects Health/Medical inquiries; other values default to Motor. Product scoping precedes inquiry-type, search and column filters, so rows, counts and filter options never mix products. Type links preserve the selected product view; switching views clears the previous type/search/column filters. Shared pressed-state buttons provide the compact view switch.

Health quote PDFs use compact 190x125mm landscape member cards matching the provided reference: two logos, plain label/value rows and thin dividers, without report-style colour fills. Each member starts a new card page with essential details, TPA/network, premiums and applicable loading rules. No standalone overview, policy loading appendix or Plan Benefits & Terms section is generated. Overflow pages retain branding and member context. Other products remain unchanged.

Health/Medical Generate Quote uses a dedicated health PDF with InsureAI Health left and NextCare right on every page. It reads the linked Inquiry afresh for members, TPA/network, Gross Premium and Premium to be Charged; member pages show age/gender, condition names only, member-base loading calculations, and applicable rules, never medical narrative or internal review notes. Member base fallback requires an unambiguous submitted-name match. Policy and member charges stay separate; never compound or add them twice. Other products retain the existing PDF. Download and the existing customer email flow share identical PDF content.

Health AI member summaries preview 220 characters with independent native Read more/Show less buttons, not interactive elements nested inside selection tabs. Condition tags use secondary-purple tint rather than white. Selection uses native smooth scrollIntoView after expansion, with scroll margin leaving some member-card context above the evaluation. Underwriting Action uses the same icon tile heading pattern as other sections.

Health AI condition tags show only condition names while accepting both structured and legacy JSON. Health/Medical inquiries show a read-only TPA card immediately after Underwriting Action and before premiums: aur_tpa preserves multiline text and aur_tpa_network displays its Dataverse formatted label, never its numeric code. Other products do not show the TPA card.

Health AI declaredConditions accepts structured condition/diagnosed/status objects and legacy strings. Member summaries display names, diagnosis dates and status as compact findings; omit empty values instead of rendering object placeholders.

Plan Business Rules is a separate read-only tab, inheriting associations from the selected Linked Product via getProductWorkspace. Match Product's grouped category/card design and share its existing categorization helper; never create plan-specific associations or expose Product unlink actions here. Changing the Linked Product reloads the rules; setup and pricing-order drafts remain intact.

Plan workspace has Plan Details and Plan Contents tabs. Details retains setup fields and pricing order; Contents holds the six-category related-record browser. Keep Details mounted when switching tabs so unsaved inputs remain intact.

Plan workspace retains side-by-side setup and rating-order editing, followed by a full-width read-only Plan Contents browser. Related Coverages, Benefits, Inclusions, Exclusions, Warranties and Deductibles reuse getQuotePlanLinkedSections and filter by the opened Plan ID, not Product ID. Shared tabs provide counts, category-local search and expandable descriptions; loading/error/retry/empty states are independent of plan editing. Viewing related records does not mutate them or reset unsaved plan fields.

Theme rounded-2xl is 24px (not Tailwind's default 16px). Inquiry section headers therefore use 23px inner radii for a 1px card border. Standard border tokens define visible outer section outlines; keep overflow visible on form sections so dropdowns and pricing popovers are not clipped.

Inquiry section headers are white in light mode and use the normal surface in dark mode, with rounded inner corners. Health AI member expansion only nudges the page downward when needed, capped at 120px, rather than scrolling the evaluation to the viewport top; reduced motion remains respected.

Health Information is flattened into Coverage & Residency and Insured People. Coverage summary values are not repeated in the field grid. Applicant and dependents share a single accessible tab selector; names appear only in selectors, not repeated in profile headers or Full Name fields. The selected person's personal, contact/background (applicant), and insurance/pricing groups sit directly on the section surface with no nested bordered profile cards. Preserve confirmation fallbacks and all other submitted fields.

Health AI member selection scrolls to the evaluation after expansion completes, respecting reduced motion. Member cards share equal-height grid tracks; evidence icons flow inline after the evidence text. Policy Overview keeps only the summary and premium, with icon-led section headings and member/loading counts.

Tinted inquiry headers match their parent card's inner 15px corner radius; keep section overflow visible for existing popovers. AI headers use a flat subtle secondary-purple tint in both themes, not a gradient.

Health member premium estimates add configured percentages without compounding against the supplied member base; null/invalid bases remain unavailable. The member's summary is shown only on its selection card, and activating the selected member again collapses its evaluation. Health policyPremiumBreakdown.finalPremium synchronizes to Inquiry aur_total_amount_charge when different, using a targeted update outside edit/save operations; never write member estimates or modify Base/Gross Premium. Successful sync patches local state without a page reload and failures are visible.

Health AI member summaries show age, medical summary, and declared findings before selection. Evaluation panels begin collapsed; selecting a member opens Business Rules/Premium with reduced-motion-aware height transitions and a collapse control. Documents & Review is omitted. Policy Overview ends after Policy Premium. Standard inquiry section headers use a subtle primary tint and icon tiles; the Health AI header stays white in light mode.

Health Information uses icon-led coverage/residency summaries and grouped read-only person profiles. Applicant fields are grouped into Personal Details, Contact & Background, and Insurance & Pricing. Dependents use shared keyboard-accessible tabs with initials and relationships, displaying one grouped profile at a time. Preserve submitted values, confirmed-detail fallbacks, and explicit missing-data states; this view does not edit or recalculate premiums.

Health AI uses shared Radix-based tabs at all three levels: Members/Policy Overview, compact avatar-and-name member tabs, and member Business Rules/Premium/Documents & Review. Selected AI navigation uses subdued secondary-purple fills and visible focus rings, neutral content surfaces, amber review indicators, and slim purple confidence bars. The final evaluated premium has restrained purple emphasis; monetary data, evidence, and re-evaluation behavior are unchanged.

Health/Medical AI evaluation reads aur_ai_evaluation_json_response from the Inquiry, not the legacy quote-detail response collection. The permanently expanded Health AI section has Members and Policy Overview views, member-scoped rules/premium/review views, and the existing evidence popup and re-evaluation action. Member premiums remain unavailable when null; policy-level charges are not allocated to members. Monetary AI figures preserve two decimals. Health Inquiry Details is also permanently expanded; other products retain their existing accordion and AI behavior.

Health stepper aliases Product Match (751820007) and Emirates Id Required (751820020) to Inquiry Created, Determined Inquiry (751820008) to AI Processing, and Quote Sent to Customer (751820016) to Awaiting Review, without changing the actual stored status. Shared Inquiry status choices include Emirates Id Required and use the label ICP Verification.

Health/Medical inquiries temporarily hide the Details Risk & Capacity section. Motor and Health premium cards use two fields per row on desktop and stack on mobile; both products hide the right-hand Completeness card. Header content and saved data remain unchanged.

The maintained visual reference is INSURANCE_APP_DESIGN_GUIDE.md. Runtime theme tokens in src/styles/globals.css and shared controls in src/components/ui remain authoritative.

Inquiry uses a compact action header with a five-metric strip and a 70/30 desktop Details layout. Inquiry Details is expanded initially; other form sections collapse independently. AI Extracted Response is expanded at the bottom, with individual response accordions initially collapsed, neutral surfaces, confidence bars, and the existing evidence popup. The decision, submitted-risk, and completeness cards use existing data and save paths. Email has its own tab with a conversation list, selected-message reader, filters, search, and the original rich-text composer. Actions, Quotes, RI Capacity Checks, Documents, and History remain separate tabs. Fields retain 11px title-case labels and 13px values. Layouts stack on small screens. The sidebar header toggles between 280px navigation and an 80px icon rail; AppShell owns shared state and page padding.

Inquiry field additions reuse the existing Field, ReadOnlyValue, and Select controls, two-column desktop layout, and stacked mobile layout. Dependent choice fields use numeric backend values, clear the dependent selection when the parent changes, and persist clearing as null through the normal Save action.

The Details decision rail scrolls normally rather than sticking. AI heading icons, active category filters, and confidence bars use the secondary purple theme token; surrounding surfaces stay neutral. Email list and reader are separated by a full-height border on desktop and a horizontal border when stacked.

Shared form-field-surface backgrounds use #e5eefa73 in light mode and the dark field-surface token in dark mode. The Re-evaluate AI Extraction button uses a refresh icon and solid secondary purple background. Underwriting Action appears only in the right-hand card, using the existing form state and save handler for both dependent choice fields.

Vehicle Value displays the average of the backend text range without overwriting the source range. Quote PDFs use src/assets/insureAIHealthLogo.png.png for Health/Medical Insurance and Al-Buhaira for Motor and other products; this does not change application branding. PDF download and customer email share the same generated document.

Inquiry product visibility follows the selected product lookup. Vehicle Value, driver/vehicle sections, vehicle header details, and Risk Signals are Motor-only. Health inquiries show read-only coverage/residency, applicant, dependents, and submitted premium breakdown accordions from their own aur_customer_data schema. Missing or malformed customer data has explicit fallback text. Product-specific displays never overwrite the saved inquiry premiums or submitted JSON.

Health Insurance and Medical Insurance share the health presentation. Base Premium Percentage and the header base-rate percentage are hidden for both; stored base premium is preserved.

Motor Insurance retains the editable Broker lookup and read-only Broker Agent field. Other products omit Broker and label the linked contact as Insured Member. Existing account relationships remain intact. Health coverage does not repeat the product and plan already shown in Inquiry Details.

Premium monetary fields use comma-grouped amount displays. The shared AmountInput shows the raw decimal value during editing and formatted grouping on blur; form state and backend payloads retain numeric values. Percentage fields keep their existing controls.

Motor and Health inquiries move submitted customer information to product-specific full-width tabs with permanently expanded sections. Premium controls appear directly below Underwriting Action in the right-hand column, using the same edit state, save path, and rating popover. Health premium combines editable inquiry values with nonduplicated submitted VAT and pricing details, and hides the Completeness card. Risk Signals is removed. Other products retain their Details premium accordion.

Health and Medical headers use a six-stage status-driven stepper instead of the metric strip: Inquiry Created, ICP Verification, DOH Review, KYC Info Required, AI Processing, Awaiting Review. Reached stages retain their icons and primary fill; displaying progress does not mutate status. Unmapped statuses do not invent progress. Motor headers are unchanged.

Quote creation copies saved inquiry total charge and gross premium, copies the selected plan VAT directly, and retains loading premium at 10 percent of gross premium without adding it to the copied total.

Motor Insurance inquiries show read-only Driver Information and Vehicle Information from aur_customer_data JSON, with safe fallbacks for missing or malformed answers. Base Premium Percentage displays without decimal places and keeps its stored value. Quote VAT is a percentage, including in PDF output. Quote IntegerType columns round to nearest integer at persistence; exact decimal storage requires a Dataverse schema change.
