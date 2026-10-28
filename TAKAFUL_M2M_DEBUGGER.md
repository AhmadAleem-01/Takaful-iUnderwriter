# Dataverse many-to-many debugger

The navbar button opens a generic debugger for the Dataverse custom action `aur_TakafulManageManyToMany`. Enter the target table logical name and relationship schema name. `TargetId` is optional for Retrieve: leave it blank to ask the updated API for all rows and their relationships. Associate and Disassociate still require a target row GUID, review, and confirmation.

## API call

The generated Power Apps SDK service uses the app's authenticated Dataverse runtime. It calls the unbound action:

```http
POST /api/data/v9.2/aur_TakafulManageManyToMany
```

The generated service method is positional, with this signature:

```ts
aur_TakafulManageManyToMany(
  Operation: string,
  RelationshipName: string,
  TargetTable: string,
  RelatedIdsJson: string,
  PageSize: number,           // Int32
  PageNumber: number,         // Int32
  PagingCookie: string,
  ColumnsJson: string,
  TargetId?: string,          // optional Dataverse Guid
  TargetColumnsJson?: string, // optional JSON string array
)
```

The debugger builds a named payload then maps it to the generated positional signature in one place. It omits `TargetId` when blank. The custom API responds with `ResultJson` (String); the service checks operation errors before parsing the result.

## Generic parameters

| Name | Dataverse type | Required | Meaning / values |
| --- | --- | --- | --- |
| `Operation` | String | Yes | `Retrieve`, `Associate`, or `Disassociate`. |
| `RelationshipName` | String | Yes | Many-to-many relationship **schema name**, not the navigation property. |
| `TargetTable` | String | Yes | Main table logical name, e.g. `account` or `aur_products`. |
| `TargetId` | Guid | Optional | Omit for Retrieve all; otherwise the GUID of one row in `TargetTable`. Required by the debugger for Associate and Disassociate. |
| `TargetColumnsJson` | String | Optional | JSON-encoded target-table column names. Blank/`[]` requests the target primary ID and name. |
| `RelatedIdsJson` | String | Yes | JSON-encoded array of related-row GUID strings. Use `[]` for Retrieve. Mutation limit: 100 IDs. |
| `PageSize` | Integer / Int32 | No in API definition; always sent | Defaults to 100; range 1–500. |
| `PageNumber` | Integer / Int32 | No in API definition; always sent | Start at 1. |
| `PagingCookie` | String | No in API definition; always sent | Empty string on page 1; pass the prior response cookie unchanged for later pages. |
| `ColumnsJson` | String | No in API definition; always sent | JSON-encoded array of related-table column logical names. Blank/`[]` requests the related table primary ID and name. |

The plug-in discovers the related table and intersect columns from relationship metadata. With `TargetId`, selected target fields are in `targetRecord` and related rows are in `records`. Without `TargetId`, `records` contains target rows with nested `relatedRecords`. Pagination is controlled by `PageSize`, `PageNumber`, and `PagingCookie`.

## Payloads

All examples are generic placeholders. `RelatedIdsJson`, `TargetColumnsJson`, and `ColumnsJson` are strings that contain JSON arrays.

Retrieve:

```json
{
  "Operation": "Retrieve",
  "RelationshipName": "<relationship-schema-name>",
  "TargetTable": "<target-table-logical-name>",
  "TargetColumnsJson": "[]",
  "RelatedIdsJson": "[]",
  "PageSize": 100,
  "PageNumber": 1,
  "PagingCookie": "",
  "ColumnsJson": "[]",
  "TargetId": "<target-row-guid>",
  "TargetColumnsJson": "[]"
}
```

For Retrieve-all, omit `TargetId` entirely; `records` contains target rows with nested related rows. Set `TargetColumnsJson` and `ColumnsJson` separately to control the columns returned for each table.

Associate (links existing related rows):

```json
{
  "Operation": "Associate",
  "RelationshipName": "<relationship-schema-name>",
  "TargetTable": "<target-table-logical-name>",
  "TargetId": "<target-row-guid>",
  "TargetColumnsJson": "[]",
  "RelatedIdsJson": "[\"<related-row-guid>\"]",
  "PageSize": 100,
  "PageNumber": 1,
  "PagingCookie": "",
  "ColumnsJson": "[]"
}
```

Disassociate (removes links, does not delete rows):

```json
{
  "Operation": "Disassociate",
  "RelationshipName": "<relationship-schema-name>",
  "TargetTable": "<target-table-logical-name>",
  "TargetId": "<target-row-guid>",
  "TargetColumnsJson": "[]",
  "RelatedIdsJson": "[\"<related-row-guid>\"]",
  "PageSize": 100,
  "PageNumber": 1,
  "PagingCookie": "",
  "ColumnsJson": "[]"
}
```

## Result

Parsed `ResultJson` contains operation and paging metadata. Single-target retrieval can include `targetRecord` plus related rows in `records`; collection retrieval places target rows in `records`, each with nested `relatedRecords`. The debugger displays target fields separately from related fields and supports paging with the returned cookie. Failures are checked on the SDK operation result before `ResultJson` parsing and shown as the Dataverse error.
