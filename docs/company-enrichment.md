# Company enrichment

Applyline stores public company brand metadata in `brand_cache` for selected Brandfetch/Saved companies. Plain manual companies are local job data, not brand cache entries.

Do not truncate `brand_cache` while local development and the hosted Vercel app share the same Supabase project. Manually delete only obviously bad rows, such as test IDs or wrong-domain records.

Rows missing `brand_color` can be refreshed later when a user selects that company again. Local companies with a domain or Brandfetch ID but missing logo/color may refresh through the normal selection flow.

Do not add a full bulk IndexedDB or Supabase backfill until auth and Supabase company/job sync exist.
