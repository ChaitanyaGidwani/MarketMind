const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const CampaignBudget = await hre.ethers.getContractFactory("CampaignBudget");
  const campaignBudget = await CampaignBudget.deploy();
  await campaignBudget.deployed();

  console.log("CampaignBudget deployed to:", campaignBudget.address);
  console.log("Copy the address into your orchestrator .env as CONTRACT_ADDRESS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
