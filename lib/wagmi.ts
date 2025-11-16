import { createConfig, http } from "wagmi";
import { metaMask } from "wagmi/connectors";

import { env } from "./env";
import { supportedNetworks } from "./chains";

const chains = supportedNetworks.map((network) => network.wagmiChain) as [
  (typeof supportedNetworks)[0]["wagmiChain"],
  ...(typeof supportedNetworks)[number]["wagmiChain"][]
];
const transports = chains.reduce((acc, chain) => {
  acc[chain.id] = http(chain.rpcUrls.default.http[0]!);
  return acc;
}, {} as Record<number, ReturnType<typeof http>>);

export const wagmiConfig = createConfig({
  ssr: true,
  chains,
  transports,
  connectors: [
    metaMask({
      dappMetadata: {
        name: "USDC Hopper",
        url: env.appUrl,
      },
    }),
  ],
});
