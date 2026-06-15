const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CampaignBudget", function () {
  let CampaignBudget, campaignBudget, owner, addr1, addr2;

  async function expectRevert(txPromise, expectedMessage) {
    try {
      await txPromise;
      expect.fail("Expected transaction to revert");
    } catch (error) {
      expect(error.message).to.include(expectedMessage);
    }
  }

  beforeEach(async function () {
    CampaignBudget = await ethers.getContractFactory("CampaignBudget");
    [owner, addr1, addr2] = await ethers.getSigners();
    campaignBudget = await CampaignBudget.deploy();
    await campaignBudget.deployTransaction.wait();
  });

  it("accepts funding and updates budget", async function () {
    await campaignBudget.connect(addr1).fundCampaign(1, { value: ethers.utils.parseEther("0.1") });
    const budget = await campaignBudget.getBudget(1);
    expect(budget.toString()).to.equal(ethers.utils.parseEther("0.1").toString());
  });

  it("rejects zero-value funding", async function () {
    await expectRevert(
      campaignBudget.connect(addr1).fundCampaign(1, { value: 0 }),
      "Must send ETH"
    );
  });

  it("accumulates funding across multiple contributions", async function () {
    await campaignBudget.connect(addr1).fundCampaign(1, { value: ethers.utils.parseEther("0.1") });
    await campaignBudget.connect(addr2).fundCampaign(1, { value: ethers.utils.parseEther("0.2") });

    const budget = await campaignBudget.getBudget(1);
    expect(budget.toString()).to.equal(ethers.utils.parseEther("0.3").toString());
  });

  it("only owner can settle and cannot settle twice", async function () {
    await expectRevert(
      campaignBudget.connect(addr1).settleCampaign(1, 42),
      "Ownable: caller is not the owner"
    );

    await campaignBudget.connect(owner).settleCampaign(1, 42);
    const roi = await campaignBudget.roiScores(1);
    expect(roi.toString()).to.equal("42");

    await expectRevert(
      campaignBudget.connect(owner).settleCampaign(1, 99),
      "Already settled"
    );
  });

  it("withdrawUnspent is owner-only and transfers funds", async function () {
    await campaignBudget.connect(addr1).fundCampaign(7, { value: ethers.utils.parseEther("0.25") });

    await expectRevert(
      campaignBudget.connect(addr1).withdrawUnspent(7, addr1.address),
      "Ownable: caller is not the owner"
    );

    const beforeBalance = await ethers.provider.getBalance(addr1.address);
    await campaignBudget.connect(owner).withdrawUnspent(7, addr1.address);
    const afterBalance = await ethers.provider.getBalance(addr1.address);

    expect(afterBalance.sub(beforeBalance).toString()).to.equal(ethers.utils.parseEther("0.25").toString());

    const budgetAfter = await campaignBudget.getBudget(7);
    expect(budgetAfter.toString()).to.equal("0");
  });

  it("withdrawUnspent reverts when no funds exist", async function () {
    await expectRevert(
      campaignBudget.connect(owner).withdrawUnspent(99, addr1.address),
      "No funds"
    );
  });
});
