import { env } from "./env";
import type { HopperNetwork } from "./chains";

export type ArcRouteQuoteParams = {
  fromNetwork: HopperNetwork;
  toNetwork: HopperNetwork;
  amount: string;
  walletAddress: string;
};

export type ArcRouteQuote = {
  routeId: string;
  provider: string;
  amountIn: string;
  amountOut: string;
  feeAmount: string;
  etaSeconds: number;
  breakdown: Array<{
    label: string;
    amount: string;
  }>;
};

export class ArcClient {
  constructor(
    private readonly baseUrl = env.arcApiBase,
    private readonly apiKey = env.arcApiKey,
  ) {}

  async quote(params: ArcRouteQuoteParams): Promise<ArcRouteQuote> {
    const payload = {
      fromChainId: params.fromNetwork.chainId,
      toChainId: params.toNetwork.chainId,
      amount: params.amount,
      wallet: params.walletAddress,
    };

    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Arc quote failed: ${response.statusText}`);
      }

      const data = await response.json();

      const feeEntries =
        Array.isArray(data.fees) && data.fees.length > 0
          ? (data.fees as Array<{
              label?: string;
              type?: string;
              amount?: string;
            }>)
          : undefined;

      return {
        routeId: data.routeId ?? data.id ?? crypto.randomUUID(),
        provider: data.provider ?? "Arc Router",
        amountIn: data.amountIn ?? params.amount,
        amountOut: data.amountOut ?? params.amount,
        feeAmount: data.fee ?? data.feeAmount ?? "0",
        etaSeconds: data.etaSeconds ?? data.estimatedSeconds ?? 120,
        breakdown:
          data.breakdown ??
          feeEntries?.map((entry) => ({
            label: entry.label ?? entry.type ?? "Fee",
            amount: entry.amount ?? "0",
          })) ??
          [],
      };
    } catch (error) {
      console.warn("[Arc] Falling back to heuristic quote", error);
      return this.buildFallbackQuote(params);
    }
  }

  private buildFallbackQuote(params: ArcRouteQuoteParams): ArcRouteQuote {
    const amount = Number(params.amount) || 0;
    const feeBps = params.fromNetwork.id === "ethereum-sepolia" ? 12 : 8;
    const feeAmount = ((amount * feeBps) / 10_000).toFixed(4);
    const amountOut = Math.max(amount - Number(feeAmount), 0).toFixed(4);

    const latencySeconds =
      params.toNetwork.id === "arc-testnet" ? 75 : params.fromNetwork.id === "arc-testnet" ? 65 : 150;

    return {
      routeId: `fallback-${Date.now()}`,
      provider: "Arc SDK (simulated)",
      amountIn: params.amount,
      amountOut,
      feeAmount,
      etaSeconds: latencySeconds,
      breakdown: [
        {
          label: "Estimated relayer fee",
          amount: feeAmount,
        },
      ],
    };
  }
}

export const arcClient = new ArcClient();

