# Live Data Notes

This demo is intentionally static-first.

## Best production data split

- Product metadata: maintained internally by MSX
- Market pulse: exchange feed or cached quote feed
- Risk events: rules engine and scheduled monitoring jobs
- Quest state / paper trading: account service

## Easy upgrades

1. Move `products` into a JSON endpoint.
2. Refresh pricing gap and stress from a cron job every 5-15 minutes.
3. Store paper trades in local storage or a lightweight backend.
4. Add a simple CMS for product-card copy and risk warnings.
