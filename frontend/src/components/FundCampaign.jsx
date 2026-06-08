import React, { useState } from 'react'
import { useAccount, usePrepareContractWrite, useContractWrite, useWaitForTransaction } from 'wagmi'
import { parseEther } from 'viem'

// TODO: Replace with actual ABI or load from backend
const CONTRACT_ABI = [
  {
    "inputs": [{ "internalType": "uint256", "name": "campaignId", "type": "uint256" }],
    "name": "fundCampaign",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function",
  },
]

export default function FundCampaign({ contractAddress, campaignId, onFunded }) {
  const { isConnected } = useAccount()
  const [ethValue, setEthValue] = useState('0.01')

  const { config } = usePrepareContractWrite({
    address: contractAddress,
    abi: CONTRACT_ABI,
    functionName: 'fundCampaign',
    args: [BigInt(campaignId || 0)],
    overrides: { value: ethValue ? parseEther(ethValue) : undefined },
  })

  const { write, data } = useContractWrite(config)
  const { isLoading, isSuccess } = useWaitForTransaction({ hash: data?.hash })

  React.useEffect(() => {
    if (isSuccess && typeof onFunded === 'function') onFunded()
  }, [isSuccess, onFunded])

  return (
    <div className="space-y-2">
      <label className="block text-sm text-text-secondary">Fund (ETH)</label>
      <input className="w-40 rounded-md" value={ethValue} onChange={(e) => setEthValue(e.target.value)} />
      <div className="flex gap-2">
        <button
          disabled={!isConnected || !write}
          onClick={() => write?.()}
          className="rounded bg-accent px-3 py-2 text-white"
        >
          Fund
        </button>
        <div className="text-sm">
          {isLoading ? 'Pending...' : isSuccess ? 'Confirmed' : ''}
        </div>
      </div>
    </div>
  )
}
