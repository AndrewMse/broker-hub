# Broker Hub — Planning

Multi-broker aggregation app (React Native, Expo Go, mocked API).
Brokers differ in what they offer (e.g. eToro vs Interactive Brokers), so the app
normalizes them into one model and shows where each asset/tool is available.

## Status

- [x] Reference UI received (Cryven dashboard mockup, `reference/cryven.png`)
- [x] Questions answered (7 / 7)
- [x] Design plan approved
- [x] Scaffold Expo project (SDK 57, React Native 0.86, Expo Router, TypeScript)
- [x] Mock API + broker adapters (eToro, IBKR), aggregation backend
- [x] Overview screen
- [x] Markets screen
- [x] Instrument detail screen
- [x] Brokers screen
- [x] Trade preview sheet
- [x] Settings sheet (display currency)
- [x] Typecheck + lint clean; mock backend checked by running it directly
- [x] Visual review on iOS simulator (iPhone 18 Pro, iOS 27). The web clipping was headless Chrome's
      ~500px minimum window width, not a layout bug.
- [x] Markets broker filter: cards now only show the selected broker's lines (before, the list filtered
      but every card still showed both brokers, so nothing seemed to change)
- [x] **v2: stocks + options** (see "v2" below): Exposure tab, Options tab (positions + premium income),
      earnings / ex-dividend calendar, option legs on instrument pages
- [x] **v3**: tax view (Romania), wheel tracking, local alert notifications, projected dividends (see "v3" below)
- [x] **Frontend polish pass** (2026-09-26): status-bar backdrop on tab screens, chart end dot no longer
      clipped, full 4-letter tickers in avatars, short-option return sign on Overview (was −52% for a put
      that's 52% kept), "1 earlier step" plural. All screens checked on the iOS simulator and web.
- [ ] Simulator.app is missing from the Xcode install (simctl works, no window). Reinstall the iOS
      simulator component in Xcode → Settings → Components. `xcode-select` still points at
      Command Line Tools; run with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` until fixed.
- [ ] Test on a physical phone with Expo Go
- [ ] IBKR market data subscription for real Greeks (user to decide later). Mock uses Black-Scholes.

Last updated: 2026-09-26

### Next steps
1. User: install Xcode, then run
   `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer && sudo xcodebuild -license accept && sudo xcodebuild -runFirstLaunch`
2. `xcodebuild -downloadPlatform iOS`, boot an iPhone simulator, `npx expo start --ios`.
3. Screenshot each screen, compare against the reference and design plan, fix issues.

## v2: stocks and options

Focus: an aggregated view to check exposure per stock / sector quickly, plus covered calls and
cash-secured puts (the user's options are usually covered). Brokers stay eToro + IBKR (the two with APIs).
Indexes, crypto etc. stay in the app as before.

- **Options live at IBKR only** (eToro's API has no options). Mock positions: AAPL 400 sh with short
  1× 250C 2 Oct + 3× 270C 20 Nov, NVDA 400 sh with 4× 200C 20 Nov, MSFT 490P 16 Oct and TSLA 290P 23 Oct
  cash-secured. IBKR cash raised to €71k to secure the puts.
- **Greeks** come from Black-Scholes in `mock-server/greeks.ts` with a per-stock IV. Real IBKR Greeks need
  a market data subscription; swap in the adapter later, the app contract doesn't change.
- **Pairing** (`mock-server/options.ts`): at each broker, short calls take real shares (not CFDs, not
  shares at another broker), short puts take free cash, earliest expiry first. Anything left unbacked
  is flagged `Uncovered` / `Not cash-secured`.
- **Risk flags**: ITM (warn if ≤ 7 days to expiry), earnings before expiry, ex-dividend before expiry
  (high only when ITM and time value < dividend, the real early-assignment condition).
- **Exposure** (`mock-server/exposure.ts`): shares and CFDs at notional, options at delta × price,
  ETFs / index CFDs looked through to their named constituents (SPY/SPX, QQQ/NDX, VWCE), beta-weighted
  to the S&P 500. Limits: one stock 15% of the portfolio, one sector 50% of stock exposure (constants).
- **Premium income**: 12 months of mock IBKR Flex-style option trades. Net of buybacks and commissions,
  by month (calls/puts), by stock with cost basis after premium, trade list.
- **Calendar**: earnings and ex-dividend dates for held stocks; each event lists the short options still
  open that day. Reachable from the Overview and Options headers and on instrument pages.
- Mock "today" is fixed at 2026-09-25 (`market.ts` `asOf`) so days-to-expiry stay stable.

## v3: tax, wheel, alerts, dividends

- **Tax view** (`mock-server/tax.ts`, `/tax`, card on Overview). Per-year, per-source-country results in the
  display currency (the user asked not to convert to RON; the form needs RON at BNR rates, a note says so).
  Losses offset only within a country and carry forward (7 years) from the prior mock year. Dividend tax
  net of foreign withholding credit. CASS meter at 6/12/24 minimum wages. Option premium is a gain at
  expiry / buyback; assigned options adjust the share lot instead. Crypto excluded.
  - **Country rule is a setting** (issuer default, or broker: IBKR Ireland, eToro Cyprus). CFDs always
    broker. Dividends always issuer. The user hasn't confirmed which rule their accountant uses.
  - Rates live in `market.ts` `roTax`: 10% gains, dividends 10% (2025) / 16% (2026), CASS 10%,
    minimum wage 4,050 (2025) / 4,325 (2026) RON. **Unverified, check yearly.**
- **Wheel** (`mock-server/wheel.ts`, Options → Wheel). Cycles rebuilt from option trades + closed lots:
  puts until assigned → shares + calls until called away. Covered calls on shares bought outright are
  cycles that "started with shares"; their annualized figure is income only (premium + dividends), since
  the share gain predates the cycle. Mock: TSLA completed cycle Jan–Jun 2026 (+$4,905), TSLA and MSFT
  in puts, AAPL and NVDA holding shares.
- **Alerts** (`lib/alerts.ts`, hook in `(tabs)/_layout.tsx`, toggles in Settings). Local notifications
  only, no server: assignment-risk flags fire once when detected (deduped via kv-store), expiry
  reminders 2 days before at 09:00, earnings / ex-dividend the evening before when a short option is
  open. Deterministic identifiers (`bh:` prefix) so re-syncs replace instead of duplicate. Works in
  Expo Go on iOS; Android Expo Go dropped notifications in SDK 53 (needs a dev build). No-op on web.
- **Projected dividends** (`mock-server/dividends.ts`, top of Calendar, amounts on ex-div rows).
  Schedule per instrument in `market.ts` `dividendSchedules`; calendar ex-dividend events are now
  generated from it. Withholding by issuer country (US 10%, NL 15%, DE 26.375%, IE 0%). CFDs and
  VWCE (accumulating) are listed as not counted.
- Settings persist via `expo-sqlite/kv-store` on device, localStorage on web (`lib/storage.ts`).
- Trade history now includes closed stock lots and dividends for both brokers (`fetchStockTrades`,
  `fetchDividends` on the adapter).

### Open ideas (not scheduled)
- Tax: RON conversion at BNR daily rates once a rate source exists; export for the Declarația Unică.
- Concentration limits editable in Settings.
- Roll helper: suggest next-month strikes for calls near assignment.
- Wheel chain view (put → assignment → covered call) once assignments show up in trade history.
- Greeks for index/ETF options (SPY/QQQ) in exposure are already handled; add chain view later.
- Add XTB / Trading 212 / Revolut adapters (model already supports N brokers).
- Persist display currency (e.g. `expo-sqlite/kv-store`).
- Options chain in trade preview (options routes currently show "Not in preview").
- Dark mode (colors are already tokens).

## Reference UI notes

Desktop web dashboard; needs translating to a phone layout.

- Light grey canvas, white rounded panels, soft borders.
- Single accent: periwinkle blue (~#6B7FF0), with a blue→violet gradient on the balance card.
- Large, light-weight grotesk numerals for money values ($4,862.97, 18.959).
- Price chart: smooth line over a dense field of thin vertical volume bars, highlighted
  around the selected point; range scrubber below; time-range pills (1h … 1y).
- Asset table with icon, price, amount, status pill (Trending / Limited / Rising), volume.
- Buy/Sell panel with swap between two assets, primary + secondary CTAs.

## Questions

| # | Question | Status | Answer / proposed default |
|---|----------|--------|---------------------------|
| 1 | How closely should the app follow the reference UI? | answered | Adapt faithfully: keep palette, light numerals, bar-field chart, status pills; re-laid out for phone |
| 2 | Same instrument held at 2+ brokers: merged row or separate rows? | answered | One merged row (combined qty/value, broker names listed); tap to expand the per-broker split |
| 3 | Make CFD vs real ownership visible? | answered | Yes: pill tag per broker line (CFD / Share / Future / Option / ETF), reference pill style |
| 4 | Base currency? | answered | USD default, switchable (EUR and more) in settings; mock FX rates |
| 5 | Which brokers to mock? | answered | eToro + Interactive Brokers only. Model stays N-broker so XTB / Trading 212 / Revolut can be added later |
| 6 | Scope of v1: read-only, no trading / connect flow? | answered | Read-only + trade preview: Buy/Sell sheet compares which broker can execute, form (share/CFD/…), fee, spread. Places nothing. Brokers pre-connected |
| 7 | Project location, light/dark mode? | answered | `~/broker-hub`; light only, colors as tokens so dark can be added later |

## Plan

### Stack
- Expo (latest SDK, Expo Go compatible), TypeScript, `expo-router` (tabs + stacks).
- TanStack Query for data fetching, caching, pull-to-refresh.
- `react-native-svg` for charts, `expo-linear-gradient`, `expo-haptics` (all in Expo Go).
- Font: Hanken Grotesk via `@expo-google-fonts/hanken-grotesk`.
- Mock API behind a typed client interface; in-memory JSON per broker with simulated latency.
  Swap for a real backend later without touching screens.

### Domain model
```
Broker adapters (eToro, IBKR; more later)
        │  normalize
        ▼
Broker { id, name, capabilities }
BrokerCapabilities {
  assetClasses: stock | etf | option | future | forex | crypto | bond | cfd
  features: fractional, shorting, margin, copyTrading
}
Instrument { id (ISIN/symbol), name, type, availability[]: { brokerId, form: real|cfd|future|option|etf } }
Position   { brokerId, instrumentId, qty, avgPrice, currency, form }
        │
        ▼
Aggregation layer: merge by instrument, convert to base currency, per-broker totals
```

### Screens (v1)
1. **Overview** — total value + change, chart, split by broker, positions list.
2. **Markets** — indexes & instruments, availability across brokers.
3. **Instrument / position detail** — holdings per broker + ways to get exposure.
4. **Brokers** — connected accounts and capabilities matrix.
5. **Trade preview sheet** — Buy/Sell from an instrument: per-broker route, form, estimated fee, spread. No orders placed.

### Mock data (v1)
| Instrument | eToro | IBKR |
|---|---|---|
| S&P 500, Nasdaq 100, DAX 40, FTSE 100, Nikkei 225, Euro Stoxx 50 (indexes) | CFD | Future, Option, ETF (SPY/QQQ/EXS1…) |
| AAPL, MSFT, NVDA, TSLA, ASML, SAP | Share (fractional), CFD for shorts | Share, Option |
| VWCE, SPY, QQQ | ETF | ETF, Option (US) |
| BTC, ETH | Crypto (real) | Crypto (limited), Future |
| EUR/USD, GBP/USD | CFD | Forex (spot) |
| Gold, Brent oil | CFD | Future |
| US 10Y Treasury | — | Bond |

Capabilities: eToro = fractional, copy trading, CFD shorting; IBKR = options, futures, bonds, margin, shorting.
Mock positions: ~10 holdings, with AAPL, NVDA and BTC held at both brokers to exercise merged rows.
Accounts: eToro reports in USD, IBKR in EUR, so the currency conversion is visible from day one.

## Design plan

### Color
| Token | Hex | Use |
|---|---|---|
| `canvas` | `#EDEDF0` | Screen background (reference grey) |
| `surface` | `#FFFFFF` | Panels, rows, sheets |
| `sunken` | `#F5F5F7` | Segmented controls, inputs, expanded sub-rows |
| `line` | `#E4E4E9` | 1px borders instead of shadows |
| `ink` | `#16171B` | Primary text and numbers |
| `inkMuted` | `#80828C` | Secondary text, axis labels |
| `accent` | `#6C7FF2` | Periwinkle: chart line, active states, primary buttons |
| `accentSoft` | `#E7EAFE` | Active pill backgrounds, chart glow |
| `violet` | `#B49CF4` | Gradient end, only on the trade summary card |
| `gain` / `loss` | `#159A86` / `#E04F5F` | Change values |

Pills say what form a holding takes, so each form gets a fixed color:
Share = teal (`#DDF4F4` / `#12838A`), ETF = blue (`accentSoft` / `accent`),
CFD = rose (`#FDE8EA` / `#D9475A`, signals leverage/non-ownership), Future / Option = violet (`#F0EBFE` / `#7A5CE0`), Crypto = amber (`#FDF1DC` / `#B7791F`).
Brokers are identified by a small monogram disc in their brand color (eToro green `#13C636`, IBKR red `#D71920`), never by colored rows.

### Type
One family: **Hanken Grotesk** (`@expo-google-fonts/hanken-grotesk`, works in Expo Go).
Close to the reference's neutral grotesk, with a real Light weight for the big numbers.

| Role | Size / line | Weight |
|---|---|---|
| Hero value | 44 / 48, tracking -1.5 | 300 Light |
| Section value (cards) | 30 / 34, tracking -0.8 | 300 |
| Title | 20 / 26 | 600 |
| Body / row name | 16 / 22 | 500 |
| Secondary | 14 / 20 | 400, `inkMuted` |
| Pill / axis | 12 / 16 | 500 |

All numbers use tabular figures (`fontVariant: ['tabular-nums']`) so columns line up.
Sentence case everywhere. The reference's all-caps table headers are dropped.

### Layout
Bottom tabs: **Overview**, **Markets**, **Brokers**. Settings (currency) from a header icon.
Instrument detail pushes on a stack, and trade preview opens as a bottom sheet.
16px side gutter. Left-aligned text, numbers right-aligned in rows.
Corner radius follows hierarchy: sheet 28, panel 20, row 14, pill fully round.

**Overview**
```
Portfolio                    (⚙)
$48,212.40  +4.6%               ← hero, Light 44
[1D][1W][1M][6M][1Y]            ← sunken segmented control
▕▏▕▎▍▌▋█▋▌▍▎▏▕  ─── line       ← bar-field chart, touch to scrub
      +$952.88 ◉                  tooltip follows finger
eToro 38% ████████░░░░░░ IBKR 62%  ← one split bar, tap for account
Positions                   10
┌─────────────────────────────┐
│(A) Apple         $12,480    │
│    ●● 2 brokers   +2.1%  ▾  │
│  ├ eToro  20 sh [CFD] $4,160│  ← expanded, sunken bg
│  └ IBKR   40 sh [Share]$8,320│
└─────────────────────────────┘
```

**Markets**
```
Markets                     (🔍)
[Indexes][Stocks][ETFs][Crypto][Forex][Commodities]   ← horizontal chips
S&P 500            5,812.40 +0.6%
  ● eToro [CFD]   ● IBKR [Future][Option][ETF]
Nikkei 225        38,210.00 −0.3%
  ● eToro [CFD]   ● IBKR [Future]
```

**Instrument detail**
```
← S&P 500
5,812.40  +0.6%
[range] chart
Your holdings        (merged rows, as Overview)
Ways to trade
  ● eToro  [CFD]              fee est. 0.09%
  ● IBKR   [Future][Option][ETF]
[ Preview buy ]  [ Preview sell ]
```

**Trade preview sheet** (the reference's right column, stacked)
```
[ Buy | Sell ]
┌ S&P 500 · You buy     1.20 ┐
└──────────── ⇅ ─────────────┘
┌ USD · You spend    7,000   ┐
Route
 ○ eToro  [CFD]    fee 6.32   spread 0.8
 ● IBKR   [ETF: SPY] fee 1.00  spread 0.01
╭ gradient card ─────────────╮
│ You will receive 11.9 SPY   │
│ Fee 1.00 USD   Spread 0.01% │
╰─────────────────────────────╯
Preview only. No order is sent.
```

**Brokers**
```
Brokers
(eT) eToro        $18,340  USD
(IB) Interactive   €27,610 EUR → $29,872
What each broker offers
            eToro  IBKR
Shares        ✓     ✓
CFDs          ✓     —
Options       —     ✓
Futures       —     ✓
Bonds         —     ✓
Crypto        ✓     ✓
Fractional    ✓     ✓
Copy trading  ✓     —
```

### Principles
1. **The chart is the signature.** The reference's dense field of thin bars with a glow around the
   touched point is the one bold element. Everything else stays quiet.
2. **Forms are information.** Colored pills only ever mean share / ETF / CFD / derivative / crypto.
   They're never used for mood words like "Trending".
3. **Broker is secondary, instrument is primary.** Lists are organized by what you own. Brokers show
   up as small discs and tags.
4. **Borders, not shadows.** Hairline borders on white over grey, like the reference.
5. **Numbers first.** Light, large, tabular figures. Labels are short and sit beside or below the number.

### Review against the brief (changes made)
- Reference table headers in ALL CAPS → sentence case, and on mobile the table becomes rows with no header.
- Reference "Trending / Limited / Rising" pills are decorative → reused as **form** pills (CFD vs Share),
  which was question 3.
- One radius everywhere (the generic card-kit look) → radius follows hierarchy (28 / 20 / 14 / round).
- Gradient card used only once (trade summary), as in the reference, instead of spread across screens.
- Donut chart for the broker split (the default choice) → one horizontal split bar under the chart.
- "Connect Wallet" button dropped, since both brokers are pre-connected (question 6).

## Implementation notes (differences from the plan)

- **Split bar** uses neutral accent tones, not broker brand colors. eToro green next to IBKR red
  would read as gain/loss. The broker discs carry the brand.
- **Spot forex and bond pills** are neutral grey; the plan didn't assign them a color.
- **Index exposure through ETFs** (S&P 500 via SPY, Nasdaq 100 via QQQ) is worked out by the
  aggregation layer for any broker that lists the ETF, not hard-coded per broker.
- **Markets** gained a search field and an "All brokers / eToro / IBKR" filter.
- **Trade preview**: the swap disc between the two cards switches Buy/Sell. Routes that can't be
  quoted say why ("Needs $340,622" for one ES contract, "Not held here", "Not in preview" for options).
  The cheapest usable route is preselected and marked "Lowest cost".
- **Chart scrubbing** only claims horizontal drags, so vertical scrolling still works over it.
- Mock price history is a seeded random walk; the portfolio's change per range is fixed
  (1D +0.42%, 1W +1.31%, 1M +4.6%, 6M +11.8%, 1Y +21.4%).
