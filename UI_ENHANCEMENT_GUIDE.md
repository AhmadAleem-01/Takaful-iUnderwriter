# UI Enhancement Guide: Dashboard and Inquiry Workspace

Updated: 17 November 2026

## Purpose and how to use this guide

Use the revamped executive dashboard and inquiry Details tab as the visual references for enhancing other pages, forms, and inquiry tabs. This guide records the latest implemented patterns and the conventions to carry forward. It complements the older design documents in the repository; check the linked components when an older example differs from this guide.

For each new enhancement, preserve existing business behavior, permissions, data loading, calculations, and save payloads. Change presentation unless a functional change is explicitly requested. Do not replace real records with illustrative data.

## 1. Typography

Use **Poppins, sans-serif** throughout. Local font weights 400, 500, 600, and 700 are loaded in [main.tsx](src/main.tsx); the font family is also configured in the global styles and Tailwind theme.

| Element | Size | Weight | Usage |
| --- | --- | --- | --- |
| Standard content, field values, descriptions | 12px | 400 / normal | Default for enhanced component content |
| Field labels and supporting text | 12px | 400 / normal | Muted foreground |
| Inquiry page title | 26px | 600 / semibold | Inquiry name |
| Dashboard welcome title | 26px | 700 / bold | Existing welcome component exception |
| Dashboard panel title | 16px | 600 / semibold | Product Mix, Brokers, Conversion Flow, Reinsurance, Inquiry Type Mix |
| Form section and AI headings | 14px | 600 / semibold | Inquiry sections, AI Summary, suggested product heading |
| Selected Product / Selected Plan metric values | 14px | 600 / semibold | Inquiry summary strip |
| Other inquiry summary metric values | 16px | 600 / semibold | Amount, rate, and risk values |
| Large dashboard counts | Component-specific | 600 / semibold | Follow the matching dashboard component |
| AI badges, filters, tabs, reasoning text, actions | 12px where applicable | 400 / normal | Avoid uniformly bold AI content |

Use semibold for hierarchy and key metrics, not entire cards. Body text and explanatory paragraphs should remain normal weight. Some compact metadata in existing components is 10–11px; do not extend that smaller size to regular form content.

**Important implementation detail:** the current global body size is 14px. Shared Button and form components also have older size/weight defaults. Apply explicit `text-[12px] font-normal` classes where needed; do not assume those shared defaults already implement this guide.

## 2. Theme, surfaces, and spacing

Theme tokens are defined in [globals.css](src/styles/globals.css). Prefer tokens over new arbitrary colors.

| Purpose | Convention |
| --- | --- |
| Light page background | `#F6F8FB`, represented by the background token |
| Normal cards | `bg-surface` or light `bg-white` with `dark:bg-surface` |
| Main text | `text-foreground` |
| Supporting text | `text-muted-foreground` |
| Primary actions, links, focus | `primary`, `primary-light`, `primary-dark` tokens |
| Borders | `border-border` or `border-border-soft` |
| AI panel light background | `#EBF8FE` |
| AI panel accents | Primary blue; subtle primary borders and icon surfaces |
| AI panel dark background | Follow `InquiryAiSection`; suggestion details use the dark surface-soft token |
| Semantic states | Blue information, amber warning, emerald success, rose error |

- Main page groups generally use `space-y-6`; form section stacks use `space-y-3`, and right-hand cards use `space-y-4`.
- Use compact section headers, normally `px-5 py-4`, and content padding around `px-5 py-5`.
- Main dashboard cards and value cards generally use `rounded-xl`; inquiry section shells retain `rounded-2xl` where already used.
- Use subtle borders and little or no shadow on ordinary cards. Reserve stronger shadows for overlays and notifications.
- Avoid animated borders, glowing fields, oversized pills, bright gradients, and hover movement on normal form actions.
- Make long values wrap using `min-w-0`, `break-words`, or `[overflow-wrap:anywhere]`. Preserve line breaks for narrative values.
- Check every surface and text treatment in dark mode. Do not leave a white surface with light dark-mode text.

## 3. Sidebar and topbar

References: [Sidebar](src/components/layout/Sidebar.tsx), [TopHeader](src/components/layout/TopHeader.tsx).

- Preserve the existing logo, routes, role switching, and light/dark switching.
- Keep the navigation compact: menu items are 12px and 40px high; sidebar group stacks use `space-y-3`.
- Sidebar group labels are 12px with normal letter spacing (`tracking-normal`), not widely tracked labels.
- Do not restore the removed sidebar user/role card.
- Keep the topbar light background white and its breadcrumb trail visible, with **Insure AI** as the root label and a relevant icon.
- Keep the topbar compact and omit the search box.
- The username/role trigger has no hover background. Role options use the compact dropdown styling already implemented.

## 4. Dashboard reference patterns

Reference: [ExecutiveDashboard](src/pages/dashboard/ExecutiveDashboard.tsx) and [dashboard components](src/components/dashboard).

- The welcome card occupies the left column; Broker intake signal, Conversion focus, and Template readiness stack vertically on the right and stretch to match the left column height.
- Welcome metrics use equal-width cards. Reinsurance wraps to the next row without spanning the entire row.
- Display `AED` as small, normal-weight supporting text beside the larger amount. Apply the same principle to metric units such as percentages and `/ 100`.
- Product Mix uses a doughnut chart with a center total and an adjacent product breakdown. Format the row count and share together as **`1 (50%)`**.
- Broker Mix uses real linked contact data, totals, and proportional bars. Keep its empty state consistent with Product Mix.
- Conversion Flow is full width, with the eyebrow **Pipeline** and title **Conversion Flow**. Use subtle stage-card surfaces and compact headers.
- Reinsurance by Product and Reinsurance by Plan appear together in the following row. Use product bars and a plan table respectively, with consistent empty states.
- Inquiry Type Mix uses a category bar chart and a compact supporting metrics card.
- Do not add illustrative capsules, demonstration controls, or bottom component footers that were removed during the revamp.
- Retain chart tooltips, legends, units, actual totals, and responsive behavior. Do not change the meaning of ratios or won-quote calculations while restyling.

## 5. Inquiry workspace layout

References: [InquiryWorkspacePage](src/pages/inquiries/InquiryWorkspacePage.tsx), [InquiryWorkspaceHeader](src/components/inquiries/InquiryWorkspaceHeader.tsx), [InquirySummaryMetrics](src/components/inquiries/InquirySummaryMetrics.tsx).

The Details tab follows this structure:

1. Inquiry header: Back to Inquiries on the left, inquiry number/type/status capsules on the right, followed by inquiry name and received date.
2. Summary strip: Selected Product, Selected Plan, Sum Insured, Premium to be Charged, Annual Base Rate, Risk Score.
3. Main form column: AI Extracted Response first, then Inquiry Details and the applicable risk/premium sections.
4. Right column: Quick Actions, Completeness, Underwriting Action, then applicable additional information or premium cards.
5. Fixed icon tab rail on the right, vertically centered within its available desktop area.

Do not reintroduce the removed header action cluster or completeness metric in the summary strip. Selected Plan omits the redundant `- Plan` suffix and secondary “Not specified” line. Payment term is a compact 12px colored capsule beside the premium information.

Desktop form content reserves space using `lg:pr-[72px]`. The Details grid uses a 7:3 main/sidebar proportion with a minimum 260px rail. On smaller screens, stack columns and allow the icon navigation to scroll horizontally.

Other tabs should adopt the same surfaces, typography, spacing, and notification behavior. Preserve their existing functionality; do not assume all other tabs have already been redesigned.

### Read-only and edit modes

Use [ReadOnlyValueCard](src/components/inquiries/ReadOnlyValueCard.tsx) for view-mode values.

- Show informational cards, not disabled inputs, dropdown arrows, or inset input shadows.
- Values are 12px normal weight with subtle borders and a normal card surface.
- Missing values show “Not provided”; multiline values preserve line breaks.
- **Edit Inquiry** reveals existing editable inputs and selects. Permanently read-only information stays as cards.
- Underwriting Action shows selected **labels** for Action Status and Sub Action in view mode; it shows dependent dropdowns only while editing.
- Successful Save returns to cards with saved values. Cancel restores saved values. Failed saves retain the editable draft.
- Keep Save and Cancel under Quick Actions. Preserve busy-state disabling and duplicate-submission guards.
- Preserve existing AED formatting and calculations when switching between modes.

### Buttons and fields

Use shared controls with local styling overrides rather than redesigning global defaults for one page.

- Compact normal actions: approximately 40px high, `rounded-xl`, primary solid fill, no glow or gradient, 12px text.
- The **Check RI - Capacity** button uses this solid primary treatment. Preserve its loading spinner, busy state, and capacity-check behavior.
- Keep form controls and value cards aligned in their grid. Do not add a tall decorative wrapper around Product.
- Keep visible labels for editable controls and accessible names for icon-only controls.

## 6. AI components

References: [InquiryAiSection](src/components/inquiries/InquiryAiSection.tsx), [InquiryAiDecisionSuggestion](src/components/inquiries/InquiryAiDecisionSuggestion.tsx), [HealthAiEvaluation](src/components/inquiries/HealthAiEvaluation.tsx).

### Extracted responses

- AI details are **collapsed by default** for standard and Health inquiries.
- **AI Summary always remains visible**, including facts and conflicts when present.
- Re-evaluation actions stay visible beside the heading even while details are collapsed.
- Collapse detailed checks, filters, response editing, and Health member/policy content together.
- Health uses the evaluation summary above the collapsible content; do not duplicate it in Policy Overview.
- Use the existing summary placeholder when no summary is available. Preserve loading, retry, and error behavior.
- Metrics use opaque white surfaces in light mode and theme surfaces in dark mode, not translucent fills over blue.

### Product suggestion and reasoning

- Render Product as a standard card or select with a separate **AI reasoning** control beneath it.
- Do not overlay the reasoning button on the field or bring back animated purple outlines.
- The expanded suggestion uses `#EBF8FE`, subtle primary-blue accents, a 14px semibold product heading, and normal body/action/badge weights.
- Confidence can retain semantic green/amber styling. Preserve its real value and progress semantics.
- Keep Apply suggestion, selected-in-draft feedback, reasoning, and alternatives behavior intact.
- Suggestions modify drafts through the established edit workflow; do not silently change save behavior.

### Inline semantic cards

Use `InquiryAiStatus` for inline AI information, warnings, success, and errors. It provides an icon, heading, readable 12px body, and an opaque semantic surface.

| Variant | Light palette | Dark palette |
| --- | --- | --- |
| Info | Blue 50 background / 200 border / 900 text | Blue 950 / 800 / 200 |
| Warning | Amber 50 / 200 / 900 | Amber 950 / 800 / 200 |
| Success | Emerald 50 / 200 / 900 | Emerald 950 / 800 / 200 |
| Error | Rose 50 / 200 / 900 | Rose 950 / 800 / 200 |

Avoid low-opacity semantic backgrounds over the blue AI surface: they produce muddy colors. Ensure long error messages wrap without horizontal overflow.

## 7. Notifications

References: [useNotifications](src/hooks/useNotifications.ts), [NotificationToast](src/components/ui/NotificationToast.tsx).

- Use top-right popup notifications for completed inquiry actions and save failures instead of standalone page-level success text.
- Support `success`, `error`, `warning`, and `info` variants with appropriate colors and icons.
- Each notification has a heading, message, manual close control, and a five-second countdown bar; dismiss it after 5,000ms.
- Use 14px semibold headings and 12px normal messages. Support narrow viewports and dark mode.
- These are non-blocking notifications, not confirmation dialogs. Keep inline validation or contextual AI warnings near their relevant content.
- The current hook is local, not an app-wide notification provider. Reuse it and mount the viewport when adopting it on another page.

## 8. Loading and empty states

References: [CardSkeleton](src/components/ui/CardSkeleton.tsx), [DashboardSkeleton](src/components/dashboard/DashboardSkeleton.tsx), [InquiryWorkspaceSkeleton](src/components/inquiries/InquiryWorkspaceSkeleton.tsx).

- Use **whole-card skeleton placeholders**, not many text bars and disabled-looking fields inside each loading card.
- Shared light skeleton: background `#E7EDF5`, border `#E1E7EF`.
- Shared dark skeleton: background `#24384C`, border `#2A4055`.
- Match the actual page layout: header, metrics, main cards, right rail, and navigation clearance.
- Keep pulse animation subtle and disable it for reduced-motion preferences.
- Expose one accessible loading status and hide decorative placeholders from assistive technology.
- Treat missing data as an empty state, not an indefinite skeleton. Use concise headings, supporting copy, and a relevant icon with normal card styling.

## 9. Workflow for enhancing another page or tab

1. Inspect the existing page, its data sources, permissions, actions, and loading/error states.
2. Choose the closest reference: dashboard panel, inquiry section, read-only value card, AI card, notification, or whole-card skeleton.
3. Apply typography and theme tokens explicitly; account for legacy shared-control defaults.
4. Reuse existing components before introducing another card, button, toast, or loading implementation.
5. Keep responsive grids, wrapping, focus visibility, tab selection, tooltips, and dark-mode contrast intact.
6. Verify the UI in view mode, edit mode, saving, successful save, cancellation, failure, loading, and empty states as applicable.
7. Run TypeScript and targeted lint checks. Run relevant behavior tests when actions, mode switching, selection, or data presentation changes.
8. Update this guide if a new reusable pattern is intentionally adopted.

### Acceptance checklist

- [ ] Poppins and the appropriate 12px/14px/16px/26px hierarchy are used.
- [ ] Body text, badges, and AI actions do not inherit excessive weight.
- [ ] Normal cards, AI cards, semantic cards, and overlays are visually distinct.
- [ ] View-mode values are cards; editable controls appear through the established edit action.
- [ ] Currency prefixes and units follow the existing metric hierarchy.
- [ ] Primary actions are compact and use theme colors.
- [ ] Long labels, values, and errors wrap; mobile layouts do not overflow.
- [ ] Dark mode, keyboard operation, focus states, and reduced motion are supported.
- [ ] Loading uses matching whole-card skeletons; empty/error states remain meaningful.
- [ ] Existing data, permissions, calculations, and save behavior are preserved.

### Reusable implementation request

> Enhance [page or tab] using UI_ENHANCEMENT_GUIDE.md and the current dashboard/inquiry Details tab as references. Reuse existing components, synchronize typography/colors/cards/loading states, preserve existing business behavior, and verify view/edit, responsive, dark, loading, empty, success, and error states where applicable.
