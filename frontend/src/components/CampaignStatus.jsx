import React, { useEffect, useState } from 'react'
import { useContractRead } from 'wagmi'

const CONTRACT_ABI = [
  { "inputs": [{ "internalType": "uint256", "name": "campaignId", "type": "uint256" }], "name": "getBudget", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "campaignId", "type": "uint256" }], "name": "roiScores", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
]

export default function CampaignStatus({ contractAddress, campaignId }) {
  const [budgetWei, setBudgetWei] = useState(null)
  const [roi, setRoi] = useState(null)

  const { data: budget } = useContractRead({ address: contractAddress, abi: CONTRACT_ABI, functionName: 'getBudget', args: [BigInt(campaignId || 0)] })
  const { data: roiData } = useContractRead({ address: contractAddress, abi: CONTRACT_ABI, functionName: 'roiScores', args: [BigInt(campaignId || 0)] })

  useEffect(() => {
    if (budget) setBudgetWei(budget.toString())
    if (roiData) setRoi(Number(roiData.toString()))
  }, [budget, roiData])

  return (
    <div className="space-y-2">
      <div>On-chain budget (wei): {budgetWei ?? '—'}</div>
      <div>ROI Score: {roi ?? '—'}</div>
    </div>
  )
}
