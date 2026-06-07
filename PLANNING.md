# Broker Hub — Planning

Multi-broker aggregation app (React Native, Expo Go, mocked API).
Brokers differ in what they offer (e.g. eToro vs Interactive Brokers), so the app
normalizes them into one model and shows where each asset/tool is available.

## Status

- [x] Reference UI received (Cryven dashboard mockup, `reference/cryven.png`)
- [x] Questions answered (7 / 7)
- [x] Design plan approved
- [ ] Scaffold Expo project (SDK 57, React Native 0.86, Expo Router, TypeScript)
- [ ] Mock API + broker adapters (eToro, IBKR), aggregation backend
- [ ] Overview screen
- [ ] Markets screen
- [ ] Instrument detail screen
- [ ] Brokers screen
- [ ] Trade preview sheet
- [ ] Settings sheet (display currency)
- [ ] Test on a physical phone with Expo Go

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
