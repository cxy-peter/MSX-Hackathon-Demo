# MSX Paper Trading / Wealth redesign notes

## Paper trading
- Product lane labels are reduced to Cash & Treasury, Listed / xStocks, and Private.
- USTB Treasury Reserve is available as Cash & Treasury; xStocks naming is kept for listed equities / ETF-style public exposure only.
- Trade teaching is reorganized around Spot and Perp definitions.
- Product disclosure chips show Asset layer, Own vs Synthetic, Rights, Liquidity, and Can Auto-Act.
- Perp Hedge is rebuilt as a beginner workflow: Protected sleeve -> Hedge type -> Hedge ratio -> Suggested size -> open short/perp.
- Hedge cards now foreground Before hedge net exposure, After hedge net exposure, and Residual exposure.
- Replay achievements now include IDs 8, 9, and 10 for Spot Loop, Perp Leverage, and Protective Hedge.
- Layout changes remove fixed hidden replay-desk overflow and make left shelf/right diligence sticky on desktop.

## Wealth
- Wealth entry blocks are Park Cash, Earn, xStocks / Public Holdings, Private Watchlist, and Auto / Managed.
- Product filtering now uses surface classification instead of only open/closed term type.
- Product cards show five fixed rows: What you own, How you earn, Liquidity, Main risk, Rights.
- A local wealth quest grid introduces beginner tasks before a fuller onchain badge ladder.
- Demo products were added for xStocks Public Holdings and Private Watchlist / SPV Access so the new surface taxonomy has concrete examples.

## Solidity
- MSXReplayAchievementBadge now supports achievement IDs 8-10 with labels.
- The contract keeps the existing self-claim pattern; stricter anti-farming would need an approval, signature, or score-attestation gate wired into claim().
