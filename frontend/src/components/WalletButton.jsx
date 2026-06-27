import React from 'react'
import '@rainbow-me/rainbowkit/styles.css'
import { getDefaultWallets, RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { configureChains, createConfig, WagmiConfig } from 'wagmi'
import { mainnet, sepolia, localhost } from 'wagmi/chains'
import { publicProvider } from 'wagmi/providers/public'

const { chains, publicClient } = configureChains([localhost, sepolia, mainnet], [publicProvider()])

const { connectors } = getDefaultWallets({ appName: 'MarketMind', chains, projectId: 'd1902403780f2dcf44778beebde34311' })
const wagmiConfig = createConfig({ autoConnect: true, connectors, publicClient })

export default function WalletButton({ children }) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider chains={chains}>{children}</RainbowKitProvider>
    </WagmiConfig>
  )
}
