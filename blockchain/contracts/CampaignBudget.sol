// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract CampaignBudget is Ownable {
    mapping(uint256 => uint256) public budgets;
    mapping(uint256 => bool) public settled;
    mapping(uint256 => uint256) public roiScores;

    event CampaignFunded(uint256 indexed campaignId, address indexed funder, uint256 amount);
    event CampaignSettled(uint256 indexed campaignId, uint256 roiScore, address indexed settler);

    // fund a campaign by sending ETH
    function fundCampaign(uint256 campaignId) external payable {
        require(msg.value > 0, "Must send ETH");
        budgets[campaignId] += msg.value;
        emit CampaignFunded(campaignId, msg.sender, msg.value);
    }

    // settle campaign - only owner (orchestrator) can call
    function settleCampaign(uint256 campaignId, uint256 roiScore) external onlyOwner {
        require(!settled[campaignId], "Already settled");
        settled[campaignId] = true;
        roiScores[campaignId] = roiScore;
        emit CampaignSettled(campaignId, roiScore, msg.sender);
    }

    // withdraw unspent funds (refund) - callable by owner for a failed campaign
    function withdrawUnspent(uint256 campaignId, address payable to) external onlyOwner {
        uint256 amount = budgets[campaignId];
        require(amount > 0, "No funds");
        budgets[campaignId] = 0;
        (bool ok, ) = to.call{value: amount}('');
        require(ok, "Transfer failed");
    }

    // helper to view budget in wei
    function getBudget(uint256 campaignId) external view returns (uint256) {
        return budgets[campaignId];
    }
}
