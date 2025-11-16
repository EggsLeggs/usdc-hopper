import { createConfig, http } from "wagmi";
import { injected, metaMask, walletConnect } from "wagmi/connectors";

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

const walletConnectProjectId =
  env.walletConnectProjectId || "00000000000000000000000000000000";

export const wagmiConfig = createConfig({
  ssr: true,
  chains,
  transports,
  connectors: [
    injected({
      shimDisconnect: true,
    }),
    metaMask(),
    walletConnect({
      projectId: walletConnectProjectId,
      showQrModal: true,
      metadata: {
        name: "USDC Hopper",
        description: "Move testnet USDC with Circle Bridge Kit and Arc.",
        url: env.appUrl,
        icons: ["https://avatars.githubusercontent.com/u/86017329?s=200&v=4"],
      },
    }),
  ],
});
