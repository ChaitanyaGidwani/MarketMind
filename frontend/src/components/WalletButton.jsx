import React from 'react'
import '@rainbow-me/rainbowkit/styles.css'
import { getDefaultWallets, RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { configureChains, createClient, WagmiConfig } from 'wagmi'
import { mainnet, sepolia } from 'viem/chains'
import { publicProvider } from 'wagmi/providers/public'

const { chains, provider } = configureChains([sepolia], [publicProvider()])

const { connectors } = getDefaultWallets({ appName: 'MarketMind', chains })
const wagmiClient = createClient({ autoConnect: true, connectors, provider })

export default function WalletButton({ children }) {
  return (
    <WagmiConfig client={wagmiClient}>
      <RainbowKitProvider chains={chains}>{children}</RainbowKitProvider>
    </WagmiConfig>
  )
}
