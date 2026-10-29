# Insurance App Workflow Guide

## Purpose

This document explains how the InsureAI Code App is structured, how it talks to Dataverse, how CRUD is handled, how lookup fields are read and written, and how to onboard a new table as a data source.

It is written for this project specifically, based on the current Vite + Power Apps Code App implementation.

## Current Architecture

The app follows this flow:

1. `src/generated/*`
   Generated Power Apps Code App models and services for each Dataverse table.
2. `src/services/*`
   App-facing service layer that combines tables, resolves relationships, applies UI logic, and prepares create/update payloads.
3. `src/services/dataMappers.ts`
   Maps raw Dataverse records into clean UI/domain objects.
4. `src/domain/app.ts`
   Defines the UI-facing interfaces used by pages and components.
5. `src/pages/*`
   Screen-level pages such as Inquiries, Quotes, Renewals, Analytics, Products, and Admin pages.
6. `src/components/*`
   Reusable shell, cards, fields, tables, toggles, inputs, tabs, and interaction components.

## Routing and Shell

- Routing is defined in [src/app/router.tsx](/C:/AI-Insuarance-App/src/app/router.tsx).
- The shared shell is in [src/components/layout/AppShell.tsx](/C:/AI-Insuarance-App/src/components/layout/AppShell.tsx).
- Global route scroll reset is handled by [src/components/system/ScrollToTop.tsx](/C:/AI-Insuarance-App/src/components/system/ScrollToTop.tsx).
- Role-aware access is handled through `GuardedRoute` and the app role provider.

## How Data Flows

The standard pattern in this app is:

1. Page loads.
2. Page calls a service function from `src/services/*`.
3. Service reads one or more generated services from `src/generated/services/*`.
4. Raw Dataverse records are normalized with `dataMappers.ts`.
5. Page receives UI-ready objects and renders them.

Example:

- Inquiry workspace page calls `getInquiryDetail(id)`.
- `getInquiryDetail` reads:
  - `aur_inquiries`
  - `aur_quotes`
  - `aur_ai_extracted_response`
  - `aur_business_rules`
  - `aur_consequences_result`
  - `email`
  - related tables like `account`, `contact`, `aur_plan`, `aur_products`
- The service stitches the records into one `InquiryDetail` object.

## Generated Services Pattern

Each table usually has:

- model file in `src/generated/models/*`
- service file in `src/generated/services/*`

Generated services usually expose:

- `get(id)`
- `getAll(options?)`
- `create(record)`
- `update(id, changedFields)`
- `delete(id)`

Example service:

- `src/generated/services/Aur_inquiriesService.ts`

## CRUD Pattern Used in This App

## Read

Reads are done using generated `get` or `getAll`.

Examples:

- list inquiries:
  - `Aur_inquiriesService.getAll()`
- get one inquiry:
  - `Aur_inquiriesService.get(id)`
- get all plans:
  - `Aur_plansService.getAll()`

Reads are usually wrapped in a service function instead of being called directly from pages.

## Create

Creates are done with generated `create(...)`.

Examples already in the app:

- create quote from inquiry
- create consequence result
- create email activity
- create product/admin records

Create flow:

1. collect page/form values
2. map UI values to Dataverse field names
3. bind lookups using `@odata.bind`
4. call generated `create(...)`

Example:

```ts
await Aur_quotesService.create({
  aur_name: 'Quote Name',
  'aur_product@odata.bind': `/aur_productses(${productId})`,
  'aur_plan@odata.bind': `/aur_plans(${planId})`,
  'aur_quotes@odata.bind': `/aur_inquiries(${inquiryId})`,
} as never)
```

## Update

Updates are done with generated `update(id, changedFields)`.

Examples already in the app:

- update inquiry details
- update quote workbench
- update policy reminder flags
- update admin catalog records

Update flow:

1. page builds a save payload
2. service converts it to Dataverse field names
3. lookups are sent with `@odata.bind`
4. choices/option sets are sent as numeric values
5. generated `update(...)` is called

Example:

```ts
await Aur_inquiriesService.update(recordId, {
  aur_name: payload.name,
  statuscode: payload.inquiryStatus as never,
  'aur_plan@odata.bind': `/aur_plans(${payload.planId})`,
})
```

## Delete

Deletes use generated `delete(id)`.

This pattern is already used in admin catalog flows where records can be removed from management tables.

## Lookup Fields: How We Read Them

Dataverse lookup fields usually appear in generated models in two ways:

1. raw id field
   - example: `_aur_plan_value`
2. formatted name field
   - example: `aur_planname`

Typical reading pattern:

- use the raw lookup id for logic and updates
- use the formatted name for display
- if formatted name is missing, resolve from the related table map

Example used in inquiry mapping:

```ts
aur_planname:
  inquiry.aur_planname || !inquiry._aur_plan_value
    ? inquiry.aur_planname
    : planMap.get(inquiry._aur_plan_value) ?? inquiry.aur_planname
```

## Lookup Fields: How We Set Them

We do not directly send lookup ids as plain values.

We set them using `@odata.bind`.

Examples from this app:

- Inquiry to Product:
  - `'aur_product@odata.bind': \`/aur_productses(${productId})\``
- Inquiry to Plan:
  - `'aur_plan@odata.bind': \`/aur_plans(${planId})\``
- Inquiry to Account/Broker:
  - `'aur_account@odata.bind': \`/accounts(${brokerId})\``
- Quote to Inquiry:
  - `'aur_quotes@odata.bind': \`/aur_inquiries(${inquiryId})\``
- Email to Inquiry:
  - `'regardingobjectid_aur_inquiry@odata.bind': \`/aur_inquiries(${inquiryId})\``

## Choice / Option Set Fields

Choice fields are stored as numbers in Dataverse.

UI pattern used in this app:

1. show a user-friendly label in dropdowns
2. save the numeric option-set value
3. on display, prefer formatted label from Dataverse
4. if formatted label is missing, map numeric value to label in the app

Example:

- `statuscode`
  - `1 = Decline`
  - `2 = Refer to Underwriter`
  - `3 = Escalate to Head of Aviation`
  - `4 = Property or Reinsurance Team`

## Relationship Loading Strategy

This app follows a read-and-stitch approach for relationships.

Pattern:

1. fetch parent record first
2. fetch child/related tables separately
3. filter by lookup ids
4. merge the results in the service layer
5. send a UI-ready object to the page

This is how we handle:

- Inquiry -> Quotes
- Inquiry -> AI Extracted Responses
- Inquiry -> Consequence Results
- Inquiry -> Email Activity
- Inquiry -> Account / Contact / Product / Plan

Why we use this pattern:

- keeps pages clean
- avoids page-level Dataverse complexity
- makes relationship bugs easier to debug
- keeps dynamic UI logic inside services

## Major Flows Already Integrated

## Inquiry List

- reads from `aur_inquiries`
- resolves product, plan, broker/account context
- supports inquiry type tabs and filters
- inquiry name is clickable to open the workspace

## Inquiry Workspace

- reads inquiry master data from `aur_inquiries`
- edits details, risk, premium
- saves inquiry updates back to Dataverse
- supports:
  - product lookup
  - plan lookup
  - broker/account lookup
  - inquiry status option set

## AI Extracted Response

- reads `aur_ai_extracted_response`
- filters records by inquiry lookup
- groups records by business rule category
- supports:
  - card view
  - table view
  - category filter tabs
  - request draft flow for missing information

## Consequences / Actions

- reads `aur_consequences_result`
- resolves linked consequence names from `aur_consequences`
- supports case-control and risk apply logic
- can update inquiry status or risk score

## Quotes

- quote list page
- quote workbench page
- create quote directly from inquiry
- carries inquiry linkage, product, plan, and premium-derived values

## Email Activity

- reads standard Dataverse `email`
- supports compose email in inquiry workspace
- creates linked email activity against the current inquiry

## Renewals

- uses policy records plus linked inquiry/quote context
- supports reminder and consequence-related actions

## Products and Product Management

- product admin list
- product editor
- linked plan and business-rule-aware structures
- admin catalog pattern reused for related product-management tables

## Admin Catalog CRUD

Admin pages use a shared catalog pattern in:

- [src/services/adminCatalogService.ts](/C:/AI-Insuarance-App/src/services/adminCatalogService.ts)

This service centralizes:

- list datasets
- create record
- update record
- delete record
- resolve related dropdown options

Used for:

- plans
- coverages
- benefits
- inclusions
- exclusions
- warranties
- deductibles
- business rules
- accounts
- contacts
- brokers
- business units
- users
- email templates
- document templates
- policies

## How to Add a New Dataverse Data Source

When adding a new table, follow this order.

1. Add the table as a Power Apps Code App data source.
2. Regenerate or confirm generated files exist:
   - `src/generated/models/*`
   - `src/generated/services/*`
   - `.power/schemas/*`
   - `power.config.json`
3. Create or update a service in `src/services/*`.
4. Add mapper logic in `dataMappers.ts` if the UI needs a normalized shape.
5. Update domain interfaces in `src/domain/app.ts` if needed.
6. Connect the page to the new service output.

Typical command pattern:

```powershell
npx power-apps add-data-source --api-id dataverse --resource-name <logical_table_name> --org-url "<org_url>"
```

After adding the datasource, confirm:

- the table appears in `power.config.json`
- a schema exists under `.power/schemas`
- generated model/service files were created

## How to Add a New Page That Uses a New Table

Recommended pattern:

1. Add datasource
2. Inspect generated model for actual logical fields
3. Create a service function
4. Map raw Dataverse records to a domain shape
5. Render that domain shape in the page
6. Add create/update/delete helpers only after read flow is stable

## Debugging Tips

When a field is not updating:

1. confirm the exact logical field name in generated model
2. confirm whether it is:
   - plain field
   - choice field
   - lookup field
3. if lookup:
   - use `@odata.bind`
4. if choice:
   - send the numeric value
5. log the payload in the service before calling update
6. verify the page is updating the correct Dataverse record id

When a relationship is not showing:

1. inspect the lookup raw id field
2. inspect formatted name field
3. confirm the page is filtering on the correct lookup id
4. normalize ids if needed before comparing

## Files to Know

- App shell:
  - [src/components/layout/AppShell.tsx](/C:/AI-Insuarance-App/src/components/layout/AppShell.tsx)
- Router:
  - [src/app/router.tsx](/C:/AI-Insuarance-App/src/app/router.tsx)
- Scroll restoration:
  - [src/components/system/ScrollToTop.tsx](/C:/AI-Insuarance-App/src/components/system/ScrollToTop.tsx)
- Inquiry service:
  - [src/services/inquiriesService.ts](/C:/AI-Insuarance-App/src/services/inquiriesService.ts)
- Quote service:
  - [src/services/quotesService.ts](/C:/AI-Insuarance-App/src/services/quotesService.ts)
- Admin catalog service:
  - [src/services/adminCatalogService.ts](/C:/AI-Insuarance-App/src/services/adminCatalogService.ts)
- Mappers:
  - [src/services/dataMappers.ts](/C:/AI-Insuarance-App/src/services/dataMappers.ts)
- Domain types:
  - [src/domain/app.ts](/C:/AI-Insuarance-App/src/domain/app.ts)

## Working Rules We Are Following

- Dataverse remains the system of record.
- Generated Power Apps services are the low-level integration layer.
- Pages should avoid direct Dataverse mapping logic.
- Service layer should handle relationships and payload shaping.
- UI should use domain objects, not raw Dataverse entities, wherever possible.
- Lookup ids and option-set values should be preserved correctly even if formatted labels are missing.

## Next Recommended Practice

For each new table we add in future:

1. verify logical names from generated model first
2. test read flow first
3. then wire create/update
4. then polish the UI once the relationship logic is proven

This keeps the app stable and avoids UI work being built on top of wrong Dataverse assumptions.
