import { QueryClient } from '@tanstack/react-query';
import { createConfig, http } from 'wagmi';
import { mainnet, base, bsc, polygon, sepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
  chains: [mainnet, base, bsc, polygon, sepolia],
  connectors: [
    injected({
      target: 'metaMask'
    })
  ],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [bsc.id]: http(),
    [polygon.id]: http(),
    [sepolia.id]: http()
  }
});

export const queryClient = new QueryClient();
