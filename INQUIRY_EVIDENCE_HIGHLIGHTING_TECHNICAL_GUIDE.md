# How Inquiry Evidence Highlighting Works

This feature opens the original document from a business rule and highlights the evidence text supplied by AI.

## 1. Get the Evidence from the Inquiry JSON

We read this field from the **Inquiry table (`aur_inquiry`)**:

```text
aur_ai_evaluation_json_response
```

Each evaluated rule can contain an `evidenceReferences` array:

```json
{
  "ruleName": "Driving licence verification",
  "evidenceReferences": [
    {
      "sourceType": "Document",
      "documentName": "02_Driving_Licence_Evidence",
      "exactText": "Document checks\nFront/back supplied; category and expiry legible"
    }
  ]
}
```

| JSON attribute | What we use it for |
| --- | --- |
| `sourceType` | Show the evidence icon only for a valid `Document` reference. Null and other source types do not show an icon. |
| `documentName` | Find the correct linked document. |
| `exactText` | Find and highlight these words inside the PDF. |

The document name and evidence text must both be present.
 the displayed rule details come from `aur_ai_extracted_response`. We match that rule to `businessRuleEvaluation` in the Inquiry JSON to get its document references.



## 2. Find That Document's Path

The same Inquiry has another field:

```text
aur_documents_url
```

It stores linked document paths, separated by commas. For example:

```text
/aur_inquiry/Example Inquiry/02_Driving_Licence_Evidence.pdf,/aur_quotes/Example Inquiry/Claims_and_Coverage_Declaration.pdf
```

We match the JSON's `documentName` against the filenames in this list, ignoring case and the file extension.

Example:

```text
JSON documentName:
02_Driving_Licence_Evidence

Matched path:
/aur_quotes/Example Inquiry/02_Driving_Licence_Evidence.pdf
```

If the file is missing from this list, or more than one file matches, the app shows an error and does not call the flow. Spaces and underscores are not interchangeable during matching.

## 3. Retrieve the File Using Power Automate

When the user clicks the evidence icon, the app opens the modal and calls our **Get Inquiry Evidence Document** flow.

**Flow ID:** `0ed53859-5d28-0992-c647-e0c0c40f14fb`

| Input | Value sent |
| --- | --- |
| `inquiryId` | The Inquiry record's GUID (`aur_inquiryid`). |
| `documentPath` | The matched path from `aur_documents_url`. |

The generated Power Apps service sends these inputs using the wire keys `text` and `text_1`.

Before sending `text_1`, the app converts full URLs from the configured SharePoint site into decoded, site-relative file paths. For example, `%20` becomes a space and `%40` becomes `@`. An exact duplicate of the same path appended to the file URL is collapsed to a single path. Hidden control characters (including `%02`) and zero-width characters are rejected before the flow is called. Links to a different site are also rejected. Literal plus signs and percent characters in filenames are preserved.

The SharePoint action must be **Get file content using path** (`GetFileContentByPath`), with `text_1` in its `path` parameter. **Get file content** expects a file identifier in `id` and cannot accept this path. If the flow validates the path against `aur_documents_url`, compare normalized paths rather than requiring the decoded input to equal an encoded full URL.

The flow:
1. Retrieves the Inquiry from Dataverse.
2. Checks that the requested path is in its `aur_documents_url`.
3. Uses SharePoint **Get file content using path** to retrieve the original file.
4. Returns the filename, MIME type, Base64 file content, and a success flag.

The files are stored in the configured SharePoint site. The app reads the site's address from the environment variable `aur_sharepoint_site_url`.

**The flow only retrieves the file. It does not perform the highlighting.**

## 4. Open the PDF and Highlight the Evidence

The app decodes the returned Base64 content into file bytes and checks that it is a PDF.

Then **PDF.js**, a PDF viewer library, does the following in the browser:

The PDF.js parser is bundled into the lazy-loaded viewer chunk. Its registered `WorkerMessageHandler` lets PDF.js use main-thread parsing without requesting a standalone `.mjs` worker from the Power Apps runtime proxy. This avoids worker asset loading failures in the published app; parsing large PDFs can briefly occupy the UI thread.

1. Opens the PDF and extracts the text from its pages.
2. Finds the AI's `exactText` in that text.
3. Renders the selected PDF page inside the modal.

Before searching, we normalize line breaks, tabs, repeated spaces, letter case, typographic quotes/dashes, ligatures, and soft hyphens. This lets the following text match:

```text
AI text:   Document checks\nFront/back supplied
PDF text:  Document checks Front/back supplied
```

The matcher checks both the PDF's stored extraction order and visual row order (using each text item's page coordinates). This handles two-column labels and values when the PDF stores the label column before the value column. Adjacent font runs within a word are joined when their coordinates show no word gap.

If the normalized full string is not found, the matcher also compares the complete sequence of words and values while ignoring sentence punctuation. It preserves numeric punctuation, currency symbols, percentages, signs, and negations. It does not accept a loose subset of the passage or highlight an unrelated short answer such as “None”.

We keep track of where every matched character belongs in the original PDF text spans, even when visual row order differs from extraction order. The browser measures only those source ranges, and we place colored highlight rectangles over those words. A searchable PDF with no match gets a wording/matching message; the OCR message appears only when no searchable text is extracted.

**This is a visual overlay only. The original SharePoint document is not changed.**

## 5. What the User Sees

- An evidence icon on rules with valid Document references.
- A modal showing the actual PDF and highlighted words.
- A custom dropdown when the rule references multiple documents.
- Evidence passages that can be clicked to jump to their matches.
- Page navigation, match navigation, and zoom starting at 100%.
- An **Open original** link to the SharePoint file.

The dropdown lists documents referenced by the selected rule, not every file attached to the Inquiry.

## Word (.docx) Evidence

The same retrieval flow can return original DOCX bytes, filename, and MIME type. The app detects the file format and loads `DocxEvidenceViewer` for DOCX documents. DOCX files are rendered in the browser with `docx-preview`; no PDF conversion or file upload to another service is required.

The Word viewer shares the evidence workspace's source selector, passage sidebar, page/match navigation, zoom, and expand controls with the PDF viewer. It uses the same JSON `exactText` references and full-passage matching rules. It indexes rendered text nodes across formatting runs, paragraphs, and table cells, then adds visual highlights only to matched ranges. Matches can span multiple text nodes and overlapping passages; the original file is unchanged. Page labels refer to the browser preview, whose pagination may differ from Microsoft Word.

The renderer's output is sanitized before being attached to the workspace. Embedded images and formatting are retained; active content and external asset loads are removed. Embedded image text still requires OCR. Legacy binary `.doc` files need conversion to `.docx` or PDF; the app provides an Open original fallback.

## Excel Evidence

The existing file retrieval flow can return XLSX, XLS, XLSM, or XLSB bytes. `ExcelEvidenceViewer` opens these files with SheetJS and shows a read-only grid with worksheet tabs, row/column headers, merged cells, zoom, and passage navigation. The app uses the file's saved formatted text for currencies, percentages, dates, and cached formula results. It does not recalculate formulas or run macros. Charts and embedded images are not rendered by this data preview.

Existing `documentName` and `exactText` references search across worksheets. Optional metadata can narrow a reference to its source sheet and cells:

```json
{
  "sourceType": "Document",
  "documentName": "Premium Schedule.xlsx",
  "sheetName": "Premiums",
  "cellRange": "A12:B12",
  "exactText": "Premium payable $1,500.00"
}
```

Absolute cell references (`$A$12:$B$12`) and sheet-qualified ranges (`'Premiums'!A12:B12`) are accepted. Invalid, missing, or conflicting sheet/range metadata is reported beside the passage; the app does not widen the search silently. Without metadata, repeated text produces separately navigable matches, each labeled with its worksheet and cell address. Numeric references must match the displayed value, preventing partial matches inside larger amounts or percentages.

Numeric calendar dates tolerate display-format differences: a passage containing `02/01/2026` can match a date cell displaying `2/1/26`. Matching ignores leading zeroes and equivalent numeric date separators while retaining the component order; it does not guess whether an ambiguous date uses day/month or month/day. Full years must agree with the underlying date-formatted Excel serial, including the workbook's 1900/1904 date system, or a four-digit year stored as text. A text-only two-digit year cannot establish a century. Complete dates are required, so partial dates such as `1/26` are rejected. The original displayed date is retained and highlighted in full, with its original character offsets. Blank cells between populated cells do not interrupt a passage.

Thousands-separator commas are optional in ordered numeric excerpts, including short label/value references, numeric-only references and inline passages. For example, `Passengers\n2476502\n2353049` matches `Passengers`, `2,476,502` and `2,353,049` in A14:C14, without including a trailing variance percentage. Valid three-digit comma grouping is normalized on either side; decimal points, precision, signs, currency symbols and percentages are retained. Decimal commas, malformed grouping and commas embedded in identifiers are not removed. Whole numeric cells must match, preventing partial numbers, missing negative signs or omitted currency symbols from matching via this fallback. Numeric cells whose displayed amount differs from the saved value because of rounding/scaling do not receive a grouping alias; correctly grouped text cells are supported too. Original offsets are retained and joined across removed separator gaps, so the highlights include the original commas. The sidebar explains that thousands-separator commas were ignored.

A passage with at least four newline-separated whole-cell fields can also match a single row using the saved numeric values. For example, `48495925` can identify a numeric cell displaying `€48,495,925`, and `1000000000` can identify `$1,000,000,000`. Both the displayed amount and stored value must agree exactly; the matcher does not treat percentages, scaled units or rounded displays as equivalent raw amounts. Currency symbols may be absent from the evidence, but an explicit symbol must agree with the source. Decimal zeroes and valid comma grouping may differ; signs and the complete value must match. Within a compact span of at most 32 columns, every populated cell must match in order, except adjacent identical text fields such as Model and Model short form may share one evidence field. Both source cells are highlighted; numeric duplicates are never silently skipped. All highlights use the original displayed characters, including currency symbols and separators. Sheet/cell scopes remain authoritative. Identical rows produce separate matches unless the evidence supplies a narrower range such as `Fleet!B6:J6`.

A longer JSON passage can quote a form area rather than the full worksheet width. If normal matching fails, a passage with at least four newline-separated whole-cell fields may identify a compact rectangular area across two adjacent rows. All fields must occur uniquely, in source order, within that local area; date fields retain the same year/century checks. The complete passage is then matched again against every populated cell inside the inferred rectangle. This permits unrelated columns beyond the form's edge (such as extra fleet metrics) to be omitted, but never skips a contradictory value inside the rectangle or joins distant rows. Ambiguous fields require narrower sheet/cell metadata. The sidebar explains that fields matched across adjacent rows, and highlights only the actual matched characters. Location labels bound every matched cell, including fields to the left of the initial label.

Blank layout rows no longer break an otherwise complete passage. For example, a merged `NEOS SPA` title in A5 followed by `Policy Year`, `Open Claims` and `Closed Claims` in A8:C8 matches across empty rows 6–7. Gaps exceeding seven row steps or containing unquoted populated cells inside the matched columns remain invalid. Invalid literal occurrences are filtered before trying the fallbacks, so an unrelated distant occurrence cannot suppress a valid local match elsewhere.

If ordered matching fails, a final **field-based** fallback tolerates reordered complete fields, trailing label colons and line wrapping. It can reassemble up to four evidence lines into one whole-cell field; equally plausible segmentations are declined. At least three complete fields, including two containing text, must occur in a compact area of at most eight rows and 32 columns on the same sheet. Every quoted field must be accounted for, with its occurrence count preserved. Every populated cell inside the resulting rectangle must also be accounted for; unrelated columns outside it are permitted. Adjacent identical text cells may represent one repeated field, as with Model/Model short form, but numeric duplicates are not dropped. Ambiguous repeated fields require a narrower source reference. Search candidates and attempts are bounded for large workbooks.

Field-based matches retain the existing numeric, currency, sign, percentage and date protections. A quoted text label immediately followed by a numeric/date field must still be associated with that value in the source: adjacent populated cells in a row, or the same column without an intervening value. This permits reordering whole field/value pairs but rejects swapping Premium and Tax amounts. The sidebar explicitly labels these results `Field-based match` and explains that layout or field order may differ. Only original source characters are highlighted. This is deterministic whole-field matching, not semantic similarity or an AI-generated replacement for missing evidence; missing words, negations, changed values and partial cell excerpts are not invented or silently accepted.

Only matched text within cells is highlighted. Passage navigation switches to the appropriate worksheet and brings its cells into view. Large or sparse worksheets are shown in bounded windows of 100 rows and 20 columns, with controls for browsing the rest. Matching indexes populated cells across the workbook rather than truncating to the visible window. Hidden sheets are labeled in the tabs and can be inspected. The original workbook is not modified.

## Image Evidence (English and Arabic)

PNG, JPEG, WebP, BMP, and GIF files open in `ImageEvidenceViewer`. The app decodes the original bytes and makes a fixed PNG raster using the browser's decoded orientation, with transparency flattened onto white. That exact raster is displayed and recognized, keeping OCR coordinates aligned. GIFs use a captured frame. Oversized images are capped at 6,000 pixels per edge and 16 megapixels for processing.

Tesseract.js runs English and Arabic OCR in a dedicated local worker. Its portable LSTM WebAssembly engine, worker script, and both compressed language models are bundled into a lazy-loaded JavaScript asset. A worker-local adapter answers language-model requests directly from memory. No separate worker, WASM, model, CDN, or network fetch is needed after the app asset loads; no OCR upload occurs. The worker and its Blob URL are released when work finishes or is cancelled. The preview itself uses data URLs, and language caching in IndexedDB is disabled.

The matcher searches the OCR words using the same whole-passage matching rules as other documents, including right-to-left Arabic word geometry. It highlights matched word boxes using SVG coordinates in the raster's natural dimensions, so highlights follow zoom. Progress, OCR confidence, recognition retry, passage navigation, and unmatched/error states are available. OCR spelling mistakes are not replaced with guessed matches; poor images and handwriting can therefore remain unmatched.

### Power Apps browser policy requirements

Microsoft's documented default Code Apps CSP sets `worker-src` to `'none'`. Before using browser OCR live, an administrator must review the environment's current policy and allow the locally created worker and WebAssembly compilation if they are blocked:

- `worker-src`: add `blob:`.
- `script-src`: add `'wasm-unsafe-eval'` for WebAssembly; ordinary JavaScript evaluation is not required.

These settings are environment-wide for Code Apps. This implementation does not change them or disable CSP. It requires no extra CDN, `connect-src`, or `img-src` allowances. If blocked, the viewer shows an actionable browser-security message and retains Open original. See [Microsoft's Code Apps CSP documentation](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/content-security-policy).

## PowerPoint Evidence

PPTX files open in `PptxEvidenceViewer` using pinned `@office-kit/pptx` 0.28.0 and `@office-kit/pptx-preview` 0.21.0. Both browser entry points are lazy-loaded with the viewer. The existing SharePoint retrieval flow returns the original bytes; no new flow action, upload service, worker, WebAssembly engine, or remote font request is required for this viewer.

Slides are rendered as inline SVG with native text. The preview measures authored font families with the browser canvas, sanitizes generated SVG, removes active content and external asset URLs, and gives each slide's gradients/clip paths unique identifiers. Missing or unsupported slide elements produce a preview notice; Open original remains available. This is an approximate preview and can differ from PowerPoint, especially for unavailable fonts, SmartArt, animations, media, or complex layouts.

The viewer matches each slide's rendered text separately against the JSON `exactText`, in source and visual row order. It joins formatting runs inside a line, separates lines and table cells, retains amounts/signs/percentages, and rejects partial-word/numeric matches. Hidden shapes, notes, effect/reflection copies, and generated fallback labels are excluded. A passage cannot match by concatenating text from different slides. Embedded image text is not automatically OCR'd.

Only matched character ranges receive SVG highlight rectangles. Character extents come from the browser's SVG text geometry; rectangles inherit the text's transform and its surrounding groups, preserving rotation and alignment during zoom. Text and its formatting are not rewritten. Match navigation selects and locates the source slide; slide navigation, zoom, sidebar collapse, and workspace expansion use the shared evidence UI. A browser unable to supply glyph geometry shows a highlight-positioning error instead of substituting guessed boxes.

The preview rejects malformed/empty decks and bounds local processing to a 50 MB input, 300 slides, and archive/XML limits. It checks cancellation between slides and releases detached previews on close or source changes. Legacy binary `.ppt` files require conversion to PPTX or PDF; the app does not perform that conversion automatically.

Some PowerPoint packages retain deleted entries under the reserved root `[trash]/` directory without registering content types. The pinned reader rejects these entries. Only after that precise error, following the reader's ZIP size/structure checks, the app retries using a private copy that excludes unreferenced trash. All active relationship files are checked first; a relationship into trash prevents cleanup and asks the user to re-save or export the presentation. JSZip repacks the preview copy without altering any retained part's uncompressed bytes. Other unregistered parts and archive-limit failures remain errors, and the reader applies the same limits on the retry. The original downloaded/SharePoint file is never changed; successful slide previews continue to use the session cache.

## Reopening Evidence: Session Cache

The app keeps downloaded documents and reusable preview data in browser memory. It does not write document content to `localStorage`, `sessionStorage` or IndexedDB. Reloading or closing the app destroys this cache; it is intended for moving between AI responses in the same app session.

`getInquiryEvidenceDocument` validates the inquiry's current document links before every lookup, then keys downloads by inquiry ID and normalized SharePoint path. Concurrent requests share one flow request. Successful results retain their original byte identity; failed responses are never cached. A manual refresh supersedes any older request, which cannot overwrite the newer result. Without a SharePoint version/ETag in the flow response, an in-place file replacement is detected on the next uncached fetch rather than on every cached view.

Each cache entry has an absolute 10-minute lifetime. Downloaded files use an 8-entry / 96 MiB byte budget; preparation uses a shared 6-entry / approximately 96 MiB budget. Oldest unused entries are evicted when limits are reached. Preparation size estimates include source bytes and markup/text/model estimates; they are not a hard limit on the JavaScript engine's entire heap. Expired entries are removed when the cache is next accessed. Oversized files can still open but are not retained in the applicable cache.

Reusable preparation is independent of the AI response: PDF keeps its parsed engine and extracted page text; Excel keeps its parsed sheets/cells; Word and PowerPoint keep pristine preview markup; images keep the normalized raster and completed English/Arabic OCR words. Every response calculates its own evidence matches and highlights. Word and PowerPoint create fresh DOM, so highlights from a previous response never become part of the cached document. Image Recognize again bypasses the OCR result cache.

PDF engines use viewer leases. Closing one viewer releases its lease while retaining a warm engine for reopening; expiry/eviction destroys it after any active viewers release it. Active page canvases and highlight overlays are still rendered for each view. Other previews also build fresh display elements as needed; caching avoids the flow request and expensive preparation, not all rendering work.

The evidence workspace includes **Reload source**, which bypasses the file cache and fetches from SharePoint. The new bytes also prevent reuse of older preparation. Use this when the source file changed; Try again after an error also requests a fresh copy. No automatic flow or environment security changes are required.

## Format Limits

| Situation | What happens |
| --- | --- |
| Referenced file is absent from `aur_documents_url` | Error before the flow is called. |
| File loads, but the evidence text is not found | PDF can be viewed, but unmatched text is not highlighted. |
| Scanned PDF without searchable text | No OCR is currently implemented, so its image text cannot be highlighted. |
| Word `.docx` | Browser preview and text highlighting are supported. Preview pagination can differ from Word. |
| Legacy Word `.doc` | Convert to DOCX or PDF; use Open original to view the source. |
| Excel XLSX, XLS, XLSM, XLSB | Read-only cell preview and text highlighting are supported. Formula results use saved values; no recalculation. |
| PowerPoint `.pptx` | Read-only SVG slide preview, evidence highlighting, slide/match navigation and zoom. Rendering can differ from PowerPoint. |
| Legacy PowerPoint `.ppt` | Convert to PPTX or PDF; use Open original to view the source. |
| PNG, JPEG, WebP, BMP, GIF | English/Arabic OCR and image highlighting are supported, subject to the browser policy above. |
| TIFF, HEIC, SVG | Convert to PNG or JPEG; use Open original to view the source. |
| Scanned PDF / embedded image text in Word, Excel or PowerPoint | Not automatically routed through image OCR yet. |


## In One Line

```text
Inquiry AI JSON -> documentName + exactText -> aur_documents_url -> Power Automate -> SharePoint file -> PDF.js viewer -> highlighted evidence
```
