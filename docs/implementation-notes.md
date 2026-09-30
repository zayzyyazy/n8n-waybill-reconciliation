# Implementation and integration notes

## Carrier contract

The GET route `/v1/tracking/<tracking-number>` is expected to return JSON with `tracking_number`, `carrier`, and an `events` array. Each event can supply `code`, `description`, and `at`. The last array entry is treated as latest; events are not sorted. Optional fields include `replaced_by`, `supersedes`, `pod_available`, `pod_document_id`, and `delivery_anomaly`.

The public host is a placeholder. The original carrier was a mock API, not a verified production DHL/DPD/FedEx integration. Carrier-specific live authentication and response adapters must be configured separately.

## Scope of the rules

The Shopify query fetches the first 50 tagged orders without pagination. The requested order is selected after reconciliation, so the form can perform work for several orders before displaying one. Tracked fulfillments only are extracted. The fixed legacy-reference mapping is fixture-specific and should be replaced in a real integration.

The normal path uses tracking number as the join key. Duplicate tracking numbers overwrite earlier entries in its Map; there is no business-level duplicate fulfillment protection. Replacement tracking numbers are retained as metadata, but the workflow does not fetch a replacement automatically.

Carrier request retries are enabled in the node. Their count/delay use the installed node's defaults because the export does not specify them. On exhausted errors, the error normalizer searches the payload text for a known tracking number. Recoverable errors become WATCH. If recovery fails, it returns `FAILED_TO_RECOVER_SHIPMENT` without `waybill_id` or `final_status`; downstream rollup can create an incomplete group. This path needs an explicit exception response before operational deployment.

A successful response without events can default to HEALTHY. The final response therefore should not be treated as comprehensive proof of shipment health. Current evaluation also uses the wall clock to decide whether tracking is more than three days old.

## Document lookup

The Drive node has `alwaysOutputData` enabled, allowing downstream handling of empty search results. Filename substring matching produces FOUND or MISSING. Multiple matches remain FOUND, although a later decision node contains an AMBIGUOUS handler. POD presence is evidence of an available file, not verification of its contents. A found POD can overwrite a preceding shipment exception with HEALTHY; review rule precedence for a real deployment.

Shopify token/query failures and Drive request failures have no equivalent explicit recovery branch. Action labels are output only; no downstream ticket creation, persistence, or notification is implemented.

## Local verification

`node tests/smoke.mjs` executes selected Code nodes directly with a minimal n8n context and a fixed fixture clock. Tests cover missing POD, delivered status, the three-day boundary, carrier error recovery, unrecoverable errors, empty event data, multiple document matches, mixed-severity rollup, and order-not-found behavior. Several assertions intentionally record known limitations.

This verification does not run an n8n instance, import nodes, contact services, or validate branch synchronization. Use a development store and isolated Drive data for integration testing.
