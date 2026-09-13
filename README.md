# Broker Hub

One place to see your positions across several brokers, and which markets each broker
lets you trade and in what form (real share, ETF, CFD, future, option…).
v1 is read-only with a trade *preview*; no orders are sent. Data is mocked.

Plan, decisions and status: [PLANNING.md](PLANNING.md). UI reference: `reference/cryven.png`.

## Run

```bash
npm install
npx expo start        # scan the QR code with Expo Go, or press i / a / w
npx expo start --ios  # needs Xcode + an iOS simulator
```

Checks: `npx tsc --noEmit` and `npx expo lint`.

## Structure

```
src/
  app/                    Expo Router routes
    (tabs)/               Overview (index), Markets, Brokers
    instrument/[id].tsx   Instrument detail
    trade.tsx             Buy/Sell preview sheet
    settings.tsx          Display currency sheet
  api/
    types.ts              Contract between app and backend
    client.ts             The only thing screens call; swap for fetch() later
    queries.ts            TanStack Query hooks
  mock-server/            Stand-in aggregation backend
    brokers/etoro.ts      Raw eToro-shaped payloads + adapter
    brokers/ibkr.ts       Raw IBKR-shaped payloads + adapter
    adapter.ts            BrokerAdapter interface every broker implements
    server.ts             Merges brokers: portfolio, markets, routes, trade quotes
    market.ts             Reference prices and FX rates
    history.ts            Seeded price history
  components/             UI, including BarFieldChart (the signature chart)
  theme/tokens.ts         Colors, type scale, radii
  state/settings.tsx      Display currency
```

## Adding a broker

1. Create `src/mock-server/brokers/<name>.ts` implementing `BrokerAdapter`: map the broker's raw
   instruments and positions to canonical instrument ids and a `Form`, and implement its fee schedule in `quote`.
2. Add it to `adapters` in `src/mock-server/server.ts` and its id to `BrokerId` in `src/api/types.ts`.
