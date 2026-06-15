const hre = require("hardhat");

async function main() {
  const { ethers } = hre;
  const [owner, funder, recipient] = await ethers.getSigners();

  const CampaignBudget = await ethers.getContractFactory("CampaignBudget");
  const contract = await CampaignBudget.deploy();
  await contract.deployed();

  const campaignId = 101;
  const deposit = ethers.utils.parseEther("0.05");

  // 1) fund campaign
  const fundTx = await contract.connect(funder).fundCampaign(campaignId, { value: deposit });
  await fundTx.wait();

  const budgetAfterFund = await contract.getBudget(campaignId);
  if (!budgetAfterFund.eq(deposit)) {
    throw new Error(`Budget mismatch after funding: ${budgetAfterFund.toString()}`);
  }

  // 2) settle campaign by owner
  const settleTx = await contract.connect(owner).settleCampaign(campaignId, 77);
  await settleTx.wait();

  const roi = await contract.roiScores(campaignId);
  if (!roi.eq(77)) {
    throw new Error(`ROI mismatch: ${roi.toString()}`);
  }

  // 3) withdraw unspent to recipient
  const before = await ethers.provider.getBalance(recipient.address);
  const withdrawTx = await contract.connect(owner).withdrawUnspent(campaignId, recipient.address);
  await withdrawTx.wait();
  const after = await ethers.provider.getBalance(recipient.address);

  if (!after.sub(before).eq(deposit)) {
    throw new Error("Recipient did not receive expected withdrawn amount");
  }

  const finalBudget = await contract.getBudget(campaignId);
  if (!finalBudget.eq(0)) {
    throw new Error(`Final budget expected 0, got ${finalBudget.toString()}`);
  }

  console.log("Local transaction smoke test passed");
  console.log("Contract:", contract.address);
  console.log("fundCampaign tx:", fundTx.hash);
  console.log("settleCampaign tx:", settleTx.hash);
  console.log("withdrawUnspent tx:", withdrawTx.hash);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
