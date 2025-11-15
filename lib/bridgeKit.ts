import { BridgeKit } from "@circle-fin/bridge-kit";
import type { ChainDefinition } from "@circle-fin/bridge-kit";

const kit = new BridgeKit({
  environment: "testnet",
});

const supportedChains = kit.getSupportedChains();

const chainByKey = new Map<string | number, ChainDefinition>();
supportedChains.forEach((chain) => {
  chainByKey.set(chain.chain, chain);
  if ("chainId" in chain) {
    chainByKey.set(chain.chainId, chain);
  }
});

export function getCircleChain(
  key: string | number,
): ChainDefinition | undefined {
  return chainByKey.get(key);
}

export function requireCircleChain(key: string | number): ChainDefinition {
  const chain = getCircleChain(key);
  if (!chain) {
    throw new Error(
      `Unable to locate Circle chain definition for key "${key}". Ensure CCTP supports this testnet.`,
    );
  }
  return chain;
}

export { kit as bridgeKit };

