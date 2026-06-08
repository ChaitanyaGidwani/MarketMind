const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CampaignBudget", function () {
  let CampaignBudget, campaignBudget, owner, addr1;

  beforeEach(async function () {
    CampaignBudget = await ethers.getContractFactory("CampaignBudget");
    [owner, addr1] = await ethers.getSigners();
    campaignBudget = await CampaignBudget.deploy();
    await campaignBudget.deployed();
  });

  it("accepts funding and updates budget", async function () {
    await campaignBudget.connect(addr1).fundCampaign(1, { value: ethers.parseEther("0.1") });
    const budget = await campaignBudget.getBudget(1);
    expect(budget).to.equal(ethers.parseEther("0.1"));
  });

  it("only owner can settle", async function () {
    await expect(campaignBudget.connect(addr1).settleCampaign(1, 42)).to.be.reverted;
    await expect(campaignBudget.connect(owner).settleCampaign(1, 42)).to.not.be.reverted;
    const roi = await campaignBudget.roiScores(1);
    expect(roi).to.equal(42);
  });
});
