## USDC Hopper

USDC Hopper is a minimalist bridge experience that helps developers move testnet USDC between Circle CCTP chains and Arc Testnet with one click. The interface mirrors the “card + tabs” layout popularised by Across, but hides the protocol complexity behind a single primary action.

### Tech stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS v4 for styling
- wagmi + RainbowKit for MetaMask-only connectivity
- Circle Bridge Kit + `@circle-fin/adapter-viem-v2`
- viem-powered ERC-20 balance reads with lightweight polling

### Features

- Detects the connected chain and pre-fills the “From” network
- Supports Ethereum Sepolia, Base Sepolia, and Arc Testnet
- MetaMask-only flow with inline USDC balance display
- Demo-style progress tracker (approval → burn → attestation → mint)
- Bridge Kit is wired for the full CCTP v2 flow (approval → burn → attestation → mint)
- Status tracker highlights each phase and stores completed transfers locally
- Transactions tab persists history in `localStorage` and polls receipts to confirm success

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env.local` file based on the template below:

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | (Optional) legacy field – MetaMask is the only supported connector |
| `NEXT_PUBLIC_APP_URL` | URL used in wallet metadata (use `http://localhost:3000` for local dev) |
| `NEXT_PUBLIC_RPC_ETHEREUM_SEPOLIA` | (Optional) custom RPC for Ethereum Sepolia |
| `NEXT_PUBLIC_RPC_BASE_SEPOLIA` | (Optional) custom RPC for Base Sepolia |
| `NEXT_PUBLIC_RPC_ARC_TESTNET` | (Optional) custom RPC for Arc Testnet |

If RPC URLs are omitted the defaults from Circle’s docs are used.

### 3. Run the dev server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) and open the “Bridge” tab.

---

## Supported test networks

| Network | Chain ID | CCTP Domain | USDC (testnet) | Docs |
| --- | --- | --- | --- | --- |
| Ethereum Sepolia | `11155111` | `0` | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | [Circle – CCTP domains](https://developers.circle.com/stablecoins/docs/cctp-supported-domains) |
| Base Sepolia | `84532` | `6` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | [Base Sepolia](https://docs.base.org/docs/sepolia-testnet) |
| Arc Testnet | `5042002` | `26` | `0x3600000000000000000000000000000000000000` | [Arc Docs](https://docs.arc.network/arc/references/connect-to-arc) |

All mapping data is sourced from the Circle Bridge Kit chain definitions at runtime.

---

## Getting testnet USDC

1. **Circle Faucet:** use [https://faucet.circle.com](https://faucet.circle.com) to request 10 testnet USDC per hour on Ethereum Sepolia or directly on Arc.
2. **Arc wallet funding:** Arc uses USDC as the native gas token. After claiming tokens on Sepolia you can bridge to Arc or request directly via the faucet (select “Arc Testnet” in the dropdown).
3. **Balances inside Hopper:** balances are pulled via viem’s ERC-20 reads for every supported chain and refreshed automatically every 20 seconds.

---

## Available scripts

```bash
npm run dev        # start local dev server
npm run build      # create a production build
npm run start      # serve the production build
npm run lint       # run ESLint
```

---

## Notes

- Transfers are stored client-side in `localStorage` and never leave the browser.
- Explorer links use the canonical URLs shipped with Bridge Kit (e.g. Etherscan, BaseScan, ArcScan).
- Hopper intentionally omits quote/fee APIs—amount in equals amount out minus on-chain fees, mirroring the Bridge Kit demo.
