# Insurance App Technical Guide

## Overview

This project is a Power Apps Code App built with Vite + React + TypeScript and connected to Dataverse. It delivers a premium insurance operations workspace for underwriting, quote management, renewals, analytics, product administration, templates, and supporting admin data.

The app follows a read-first, progressively editable model:

- Core records load from Dataverse through generated Power Apps services.
- Page-facing services normalize records, resolve lookups, stitch relationships, and prepare UI-ready models.
- Users work inside premium routed workspaces instead of simple single-record forms.
- Most operations update Dataverse directly and then refresh the local query state without reloading the entire app shell.

## Architecture

### Frontend stack

- Vite
- React
- TypeScript
- React Router
- Tailwind-based design system
- Lucide icons
- Power Apps Code App generated Dataverse services

### App shell

The shared shell is mounted from `src/components/layout/AppShell.tsx`.

It provides:

- Fixed left navigation
- Shared top header
- Route outlet for all pages
- Scroll reset behavior
- Shared role-aware navigation

### Role model

Defined in the app domain and role hooks:

- `underwriter`
- `seniorUnderwriter`
- `administrator`

Access buckets:

- `leads`
- `products`
- `admin`

Routes are protected through `GuardedRoute`, and sidebar visibility is filtered by access bucket.

## Route Map

Defined in [src/app/router.tsx](/abs/path/C:/AI-Insuarance-App/src/app/router.tsx:1).

### Core operations

- `/` -> Executive Dashboard
- `/inquiries` -> Inquiry list
- `/inquiries/:id` -> Inquiry workspace
- `/quotes` -> Quotes list
- `/quotes/:id/edit` -> Quote workbench
- `/renewals` -> Renewal operations
- `/policies/:id` -> Policy workspace
- `/analytics` -> AI Analytics

### Product management

- `/admin/products`
- `/admin/products/create`
- `/admin/products/:id/edit`
- `/admin/plans`
- `/admin/coverages`
- `/admin/benefits`
- `/admin/inclusions`
- `/admin/exclusions`
- `/admin/warranties`
- `/admin/deductibles`
- `/admin/business-rules`
- `/admin/business-rules/create`
- `/admin/business-rules/:id/edit`

### Administration

- `/admin/policies`
- `/admin/business-units`
- `/admin/business-units/:id`
- `/admin/users`
- `/admin/users/:id`
- `/admin/brokers`
- `/admin/accounts`
- `/admin/accounts/:id`
- `/admin/contacts`
- `/admin/contacts/:id`
- `/admin/email-templates`
- `/admin/document-templates`
- `/admin/document-templates/preview/:templateId`
- `/access-denied`

## Backend Dataverse Tables

Below are the main Dataverse tables currently connected through `power.config.json`.

### Core underwriting and quote processing

- `aur_inquiry`
  Purpose: Inquiry table
- `aur_quote`
  Purpose: Quote table
- `aur_ai_extracted_response`
  Purpose: AI extracted responses linked to an inquiry
- `aur_policy`
  Purpose: Policy records
- `aur_plan`
  Purpose: Insurance plans
- `aur_products`
  Purpose: Insurance products

### Rules, outcomes, and product logic

- `aur_business_rules`
  Purpose: Reusable underwriting/business rules
- `aur_consequences`
  Purpose: Master consequence definitions
- `aur_consequences_result`
  Purpose: Inquiry-linked outcome/action results
- Product-to-business-rule custom Web API
  Purpose: Read and update the native product/business-rule association

### Plan-linked catalog tables

- `aur_coverages`
- `aur_benefits`
- `aur_inclusions`
- `aur_exclusions`
- `aur_warranties`
- `aur_deductibles`

These tables are filtered by plan in Quote and Product experiences.

### Communication and templates

- `email`
  Purpose: Activity timeline emails shown in inquiry workspace
- `activitymimeattachment`
  Purpose: Email attachments for the Dataverse email activity
- `template`
  Purpose: Reusable email templates
- `aur_custom_document_templates`
  Purpose: Reusable document templates
### Accounts, contacts, users, and admin data

- `account`
- `contact`
- `systemuser`
- `businessunit`

## Key Relationships

## Inquiry relationships

- Inquiry (`aur_inquiry`) to Product
  Many inquiries to one product
- Inquiry (`aur_inquiry`) to Plan
  Many inquiries to one plan
- Inquiry (`aur_inquiry`) to Account
  Many inquiries to one account
  Used as Broker display/source in the UI
- Inquiry (`aur_inquiry`) to Contact
  Broker agent / linked contact
- Inquiry (`aur_inquiry`) to AI Extracted Responses (`aur_ai_extracted_response`)
  One inquiry to many AI extracted response records
- Inquiry (`aur_inquiry`) to Consequence Results (`aur_consequences_result`)
  One inquiry to many outcome/action result records
- Inquiry (`aur_inquiry`) to Email (`email`)
  Inquiry record used as `regardingobjectid`

## Quote relationships

- Quote (`aur_quote`) to Inquiry (`aur_inquiry`)
- Quote (`aur_quote`) to Product (`aur_products`)
- Quote (`aur_quote`) to Plan (`aur_plan`)

## Product relationships

- Product (`aur_products`) to Business Rule (`aur_business_rules`)
  Many-to-many association managed through the custom Web API
- Product (`aur_products`) to Plan
  Product workspaces organize linked plans

## Plan relationships

- Plan (`aur_plan`) to Coverages / Benefits / Inclusions / Exclusions / Warranties / Deductibles
  One plan to many catalog items

## Consequence relationships

- Consequence Result (`aur_consequences_result`) to Consequence (`aur_consequences`)
- Consequence (`aur_consequences`) to Email Template (`template`) through lookup
- Consequence (`aur_consequences`) to Document Template (`aur_custom_document_templates`) through lookup

## Account and Contact relationships

- Account to Contacts
  One account to many contacts
- Contact to linked account / managing partner account
  Used in account/contact workspaces and contact list columns

## Service Layer

The service layer lives in [src/services](/abs/path/C:/AI-Insuarance-App/src/services:1).

### `dashboardService.ts`

Builds the Executive Dashboard snapshot:

- inquiries
- quotes
- premium metrics
- conversion flow
- inquiry by product
- inquiry by broker
- won premium by product
- won premium by plan
- recent activity datasets

### `analyticsService.ts`

Builds the AI Analytics page:

- premium totals
- win rate
- inquiry trend
- premium trend
- product distribution
- status distribution
- risk distribution
- conversion funnel
- drill-down analytics

### `inquiriesService.ts`

Main inquiry orchestration layer:

- inquiry list retrieval
- inquiry detail loading
- staged detail loading
- editor options
- inquiry update
- quote creation from inquiry
- quote copy into inquiry
- inline AI extracted response updates
- consequence application
- email creation
- linked template preview retrieval

### `quotesService.ts`

Quote list and quote workbench behavior:

- quote summary datasets
- quote detail retrieval
- quote updates
- plan-linked content loading
- quote generation support data

### `productsService.ts` and `productWorkspaceService.ts`

Handle product listing and product editor workflows:

- product detail
- linked plans
- linked business rules
- bridge table association logic
- product-level settings such as auto-apply actions

### `businessRulesService.ts`

Handles business rule list and workspace logic:

- business rule list
- create/edit form options
- consequence create/edit
- import assistant support

### `accountContactWorkspaceService.ts`

Handles account and contact edit workspaces:

- account detail
- contact detail
- account-linked contacts
- contact-linked account resolution

### `adminCatalogService.ts` and `adminDetailService.ts`

Provide reusable admin table/detail patterns for shared catalog pages.

### `renewalsService.ts`

Builds renewal watch and renewal queue datasets.

### `policiesService.ts`

Builds policy workspace datasets.

## Page-Wise Documentation

## 1. Executive Dashboard

Page:

- [src/pages/dashboard/ExecutiveDashboard.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/dashboard/ExecutiveDashboard.tsx:1)

Purpose:

- High-level executive operations overview
- Underwriting and quote pipeline visibility
- Premium and conversion metrics
- Inquiry distribution by product and broker

Main data sources:

- `aur_quotes`
- `aur_quote`
- `aur_products`
- `aur_plan`
- `account`
- `email`
- `template`
- `aur_custom_document_templates`

Key behaviors:

- Dashboard cards are populated from real Dataverse metrics
- Broker and product breakdowns use normalized lookup names
- Inquiry and quote conversions are calculated from live data

## 2. Inquiry List

Pages:

- [src/pages/inquiries/InquiryListPage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/inquiries/InquiryListPage.tsx:1)
- [src/pages/inquiries/InquiryDetailPage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/inquiries/InquiryDetailPage.tsx:1)

Purpose:

- Main underwriting queue
- Search, business-type slicing, and column-based filtering
- Direct navigation into the inquiry workspace

Key UI behaviors:

- Tabs for inquiry business type views
- Table and card presentation
- Hyperlink-based record opening
- Column-level filtering per column type

Important fields shown:

- inquiry reference/name
- broker
- product
- inquiry status
- plan
- risk score
- premium-related values

## 3. Inquiry Workspace

Page:

- [src/pages/inquiries/InquiryWorkspacePage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/inquiries/InquiryWorkspacePage.tsx:1)

Purpose:

- Primary underwriting workbench for a single inquiry

Current tabs:

- Details
- Actions
- Quotes
- Documents
- History

### Details tab

Sections:

- Details
- Risk
- Premium
- AI Extracted Response
- Expandable/collapsible email activity rail

Key behaviors:

- Read-only by default, editable through `Edit Inquiry`
- Saves update Dataverse without full-screen reload
- Broker comes from inquiry account lookup
- Broker Agent comes from inquiry contact lookup
- Inquiry status uses the configured status workflow behavior
- Risk Summary uses `aur_risk_summary`

### AI Extracted Response

Data source:

- `aur_ai_extracted_response`

What is shown:

- AI generated summary from inquiry
- Quote detail responses linked to the current inquiry
- Category filters
- Card view and table view
- Editable response field
- Confidence score visualization
- Evidence/source popover
- Request a Draft action

Inline save behavior:

- Only the edited AI extracted response is saved
- Uses inquiry-facing service mutation
- Updates local UI in place

### Email activity rail

Data source:

- `email`
- `activitymimeattachment`

Behavior:

- Sticky right-side email activity pane
- Expand/collapse interaction
- Timeline presentation
- Compose email
- Draft generation from AI extracted responses

### Actions tab

Data source:

- `aur_consequences_result`
- `aur_consequences`

Behavior:

- Results grouped by business rule in accordions
- Small consequence cards inside each business-rule accordion
- Supports apply actions for case control and risk logic
- Supports notification rendering
- Supports linked template opening for document/email consequence types

Applied action rules:

- Case control actions can update inquiry status/statuscode
- Risk score actions increment inquiry risk score
- Risk summary actions append/merge into inquiry risk summary
- Consequence result action status is updated to Applied/Not Applied

### Quotes tab

Behavior:

- Shows inquiry-linked quotes
- Supports direct quote creation
- Supports copy-quote flow using won quotes
- Copy source list can be based on relevant product won quotes
- Versions are shown in a dedicated version column
- Creating/copying quote deactivates older quotes as required by workflow

### Documents and History

Used as supporting workspace tabs for record context and future additions.

## 4. Quotes List and Quote Workbench

Pages:

- [src/pages/quotes/QuotesPage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/quotes/QuotesPage.tsx:1)
- [src/pages/quotes/QuoteWorkbenchPage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/quotes/QuoteWorkbenchPage.tsx:1)

Purpose:

- Quote operations and quote editing

Key quote behaviors:

- Quote list with hyperlink navigation
- Quote detail/edit workbench
- Plan-linked catalog accordion in Plan Details
- Quote status selection and update
- Generate Quote output
- Back navigation respects whether the quote was opened from inquiry or quote list

Plan-linked catalog sources:

- `aur_benefits`
- `aur_inclusions`
- `aur_exclusions`
- `aur_deductibles`
- `aur_warranties`
- `aur_coverages`

These are filtered by the selected quote plan.

## 5. Renewals

Pages:

- [src/pages/renewals/RenewalsPage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/renewals/RenewalsPage.tsx:1)
- [src/pages/renewals/RenewalOperationsPage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/renewals/RenewalOperationsPage.tsx:1)

Purpose:

- Renewal monitoring and due/pipeline management

Typical data focus:

- policy-linked due states
- renewal urgency
- watchlist behaviors

## 6. Policies

Page:

- [src/pages/policies/PolicyWorkspacePage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/policies/PolicyWorkspacePage.tsx:1)

Purpose:

- Policy workspace for policy-specific detail and linked context

Primary data source:

- `aur_policy`

## 7. AI Analytics

Page:

- [src/pages/analytics/AnalyticsPage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/analytics/AnalyticsPage.tsx:1)

Purpose:

- Premium analytics
- risk analytics
- conversion analytics
- product and status distribution

Key behaviors:

- Multiple chart types
- 2-column responsive component layout
- Real aggregates rather than mock metrics

## 8. Products

Pages:

- [src/pages/products/ProductsPage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/products/ProductsPage.tsx:1)
- [src/pages/products/ProductEditorPage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/products/ProductEditorPage.tsx:1)

Purpose:

- Product administration
- Product detail editing
- Plan and business rule association management

Product editor tabs:

- Product Details
- Plans
- Business Rule

Key behaviors:

- Auto Apply Actions toggle updates `aur_apply_action_automatically`
- Plans are created/edited in modal flows
- Business rules are associated through the product-to-business-rule custom Web API
- Business rule association modal uses grouped/accordion presentation

## 9. Business Rules

Pages:

- [src/pages/admin/BusinessRulesPage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/admin/BusinessRulesPage.tsx:1)
- [src/pages/admin/BusinessRuleWorkspacePage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/admin/BusinessRuleWorkspacePage.tsx:1)

Purpose:

- Manage underwriting rules
- Manage linked consequences
- Support AI-assisted import workflow

Business rule fields in the workspace:

- Rule name
- Category
- Property
- Inquiry Type

Key behaviors:

- Table and card list views
- Column-level filtering in table view
- Property and inquiry type shown as option-set driven values
- Consequences managed inside the business rule workspace
- Consequence UI changes based on type/action

Consequence-specific workflow:

- Risk type can expose risk score or risk summary fields
- Document type can bind document template lookup
- Email type can bind email template lookup
- Conditional-rule property controls whether consequences are shown

AI assistant:

- Floating assistant on the business rule page
- Upload spreadsheet
- Parse rows
- Create business rules in Dataverse
- Refresh list after import

## 10. Accounts and Contacts

Pages:

- [src/pages/admin/AccountWorkspacePage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/admin/AccountWorkspacePage.tsx:1)
- [src/pages/admin/ContactWorkspacePage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/admin/ContactWorkspacePage.tsx:1)

Purpose:

- Manage account and contact records with relationship context

### Account workspace

Tabs:

- Account Details
- Contacts

Account details show/edit:

- account name
- account type
- industry
- ownership
- number of employees
- email
- phones
- website
- address information
- credit limit / credit hold context

Contacts tab:

- Shows contacts linked to the account
- Search/filter against linked contact records

### Contact workspace

Shows/edit:

- first name
- last name
- full name preview
- job title
- email
- business phone
- mobile phone
- linked account

Important relationship source:

- Contact account relationship is resolved through the account/managing-partner lookup patterns already normalized in the service layer.

## 11. Email Templates

Page:

- [src/pages/admin/EmailTemplatesPage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/admin/EmailTemplatesPage.tsx:1)

Purpose:

- Create, edit, preview, duplicate, and delete reusable communication templates

Key behaviors:

- Rich text editing
- Category/status filtering
- Placeholder insertion
- Modal create/edit experience

Primary table:

- `template`

## 12. Document Templates

Pages:

- [src/pages/admin/DocumentTemplatesPage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/admin/DocumentTemplatesPage.tsx:1)
- [src/pages/admin/DocumentTemplatePreviewPage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/admin/DocumentTemplatePreviewPage.tsx:1)

Purpose:

- Create and manage reusable document templates
- Upload source file, extract/edit content, and save reusable template records

Primary table:

- `aur_custom_document_templates`

Stored fields:

- `aur_name`
- `aur_template_content`
- `statuscode`

Key behaviors:

- Template fields panel for merge fields
- Rich document workspace
- Upload/extraction UI
- Saved template table
- Delete action from table

## Main Business Processes

## Inquiry intake to quote

1. Inquiry is created in `aur_quotes`.
2. Inquiry detail loads related product, plan, broker/account, contact, emails, AI details, and consequence results.
3. Underwriter reviews AI extracted responses and edits missing values if required.
4. Underwriter reviews actions/outcomes and applies valid business actions.
5. Quote can be created directly from inquiry.
6. Quote is linked back to the inquiry and carries inquiry-linked context.

## Quote creation from inquiry

When creating quote from inquiry, the app:

- checks current inquiry
- derives quote name from inquiry number/reference + inquiry/customer context
- carries product and plan lookup
- carries AI summary
- calculates quote premium values from inquiry premium
- creates the new quote record
- refreshes linked quote list in the workspace

## Quote copy workflow

The app can duplicate eligible won quotes into the current inquiry:

- user opens copy quote modal
- user selects won source quotes
- app creates fresh active quote rows for the target inquiry
- inquiry quote list refreshes

## AI extracted response correction

1. AI extracted response records load from `aur_ai_extracted_response`.
2. User edits `aur_response` inline.
3. Only the affected row is saved.
4. UI refreshes in place without restarting the whole inquiry experience.

## Draft email generation from missing information

When AI extracted responses contain `No information provided`:

- user can trigger `Request a Draft`
- app opens/expands the email activity composer
- draft subject/body are prefilled
- message references missing business-rule items

## Consequence application workflow

The app supports different apply paths depending on consequence type/action:

- Case Control
  Updates inquiry status/statuscode and marks consequence result as applied
- Risk Score
  Adds configured consequence risk score to inquiry risk score and marks result applied
- Risk Summary
  Concatenates configured consequence risk summary into inquiry risk summary and marks result applied
- Notification
  Notification text is surfaced in the inquiry workspace notification UI
- Document/Email template
  Linked templates can be previewed from the consequence context

## Product to business rule assignment

1. Product editor loads available business rules.
2. Existing associations are loaded through the custom Web API.
3. User associates or removes rules.
4. Product-specific rule associations are updated through the custom Web API.

## Business rule import assistant

1. User opens assistant on Business Rules page.
2. User uploads spreadsheet.
3. File is parsed row by row.
4. Business rule create payloads are built from:
   - Rule Name
   - Category
   - Property
   - Inquiry Type
5. Records are created.
6. Table refreshes and imported rows are visually tagged.

## CRUD and Lookup Patterns

## General pattern

The app follows this pattern for most pages:

1. Generated service reads raw Dataverse records.
2. App service maps raw data to UI-friendly models.
3. Page consumes normalized models.
4. On save, page sends a focused payload through the app service.
5. UI refreshes only the affected area when possible.

## Lookup retrieval pattern

Lookup values are usually surfaced using:

- lookup id
- formatted value
- logical name

The service layer normalizes these into compact objects such as:

- `{ id, name1 }`
- `{ id, accountname }`
- `{ id, fullname }`

## Lookup update pattern

For Dataverse lookup updates, the app typically:

1. Resolves the target record id.
2. Constructs the correct bind payload through the generated service or request model.
3. Saves only the changed lookup field.
4. Refreshes the local record state after save.

Examples in the app include:

- inquiry -> account/broker
- inquiry -> plan
- quote -> plan
- consequence -> email template
- consequence -> document template
- product -> business rule bridge association

## Adding a New Dataverse Table

Recommended process for this project:

1. Add the datasource through Power Apps Code App tooling.
2. Confirm it appears in `power.config.json`.
3. Regenerate/verify `.power` schema artifacts and `src/generated/*`.
4. Create or extend an app-facing service under `src/services`.
5. Add a domain mapping in `dataMappers.ts` or a page-specific service mapper.
6. Keep page components consuming normalized models instead of raw Dataverse records.

## Performance Notes

The app already uses a staged pattern in several workflows:

- render the workspace shell first
- prioritize core detail fetch
- load supplementary panels afterward

This is especially important in:

- Inquiry workspace
- Quote workbench
- Product editor
- Business rule workspace

Recommended rule:

- load primary form context first
- defer secondary analytics, timelines, linked collections, and previews

## Important File Reference Map

### Routes and shell

- [src/app/router.tsx](/abs/path/C:/AI-Insuarance-App/src/app/router.tsx:1)
- [src/components/layout/AppShell.tsx](/abs/path/C:/AI-Insuarance-App/src/components/layout/AppShell.tsx:1)

### Core pages

- [src/pages/dashboard/ExecutiveDashboard.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/dashboard/ExecutiveDashboard.tsx:1)
- [src/pages/inquiries/InquiryListPage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/inquiries/InquiryListPage.tsx:1)
- [src/pages/inquiries/InquiryWorkspacePage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/inquiries/InquiryWorkspacePage.tsx:1)
- [src/pages/quotes/QuoteWorkbenchPage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/quotes/QuoteWorkbenchPage.tsx:1)
- [src/pages/products/ProductEditorPage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/products/ProductEditorPage.tsx:1)
- [src/pages/admin/BusinessRuleWorkspacePage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/admin/BusinessRuleWorkspacePage.tsx:1)
- [src/pages/admin/EmailTemplatesPage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/admin/EmailTemplatesPage.tsx:1)
- [src/pages/admin/DocumentTemplatesPage.tsx](/abs/path/C:/AI-Insuarance-App/src/pages/admin/DocumentTemplatesPage.tsx:1)

### Services

- [src/services/inquiriesService.ts](/abs/path/C:/AI-Insuarance-App/src/services/inquiriesService.ts:1)
- [src/services/quotesService.ts](/abs/path/C:/AI-Insuarance-App/src/services/quotesService.ts:1)
- [src/services/productsService.ts](/abs/path/C:/AI-Insuarance-App/src/services/productsService.ts:1)
- [src/services/productWorkspaceService.ts](/abs/path/C:/AI-Insuarance-App/src/services/productWorkspaceService.ts:1)
- [src/services/businessRulesService.ts](/abs/path/C:/AI-Insuarance-App/src/services/businessRulesService.ts:1)
- [src/services/dashboardService.ts](/abs/path/C:/AI-Insuarance-App/src/services/dashboardService.ts:1)
- [src/services/analyticsService.ts](/abs/path/C:/AI-Insuarance-App/src/services/analyticsService.ts:1)
- [src/services/accountContactWorkspaceService.ts](/abs/path/C:/AI-Insuarance-App/src/services/accountContactWorkspaceService.ts:1)

## Notes

- This document reflects the current implemented app structure and workflows in the repository.
- Some tables remain available as connected datasources even if the latest UI now prefers another source for the same process.
- When adding new features, prefer extending the service layer first instead of placing Dataverse mapping logic directly inside page components.
