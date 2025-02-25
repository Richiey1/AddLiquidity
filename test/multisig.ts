import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";

describe("MultiSigWallet", function () {
  async function deployMultiSigWalletFixture() {
    const [owner, otherOwner, recipient] = await ethers.getSigners();

    const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
    const multisigwallet = await MultiSigWallet.deploy(2, owner.address);
    await multisigwallet.waitForDeployment();

    await multisigwallet.connect(owner).addOwner(otherOwner.address);

    await owner.sendTransaction({
      to: await multisigwallet.getAddress(),
      value: ethers.parseEther("5.0"),
    });

    return { owner, otherOwner, recipient, multisigwallet };
  }

  describe("Deployment", function () {
    it("should deploy and set the initial owner", async function () {
      const { multisigwallet, owner } = await loadFixture(deployMultiSigWalletFixture);
      expect(await multisigwallet.isContractOwner(owner.address)).to.be.true;
    });
  });

  describe("Owner Management", function () {
    it("should allow adding a new owner", async function () {
      const { multisigwallet, owner } = await loadFixture(deployMultiSigWalletFixture);
      const newOwner = ethers.Wallet.createRandom().address;

      await multisigwallet.connect(owner).addOwner(newOwner);
      expect(await multisigwallet.isContractOwner(newOwner)).to.be.true;
    });

    it("should allow removing an owner", async function () {
      const { multisigwallet, owner, otherOwner } = await loadFixture(deployMultiSigWalletFixture);
      await multisigwallet.connect(owner).removeOwner(otherOwner.address);
      expect(await multisigwallet.isContractOwner(otherOwner.address)).to.be.false;
    });
  });

  describe("Transaction Management", function () {
    it("should allow an owner to propose a transaction", async function () {
      const { multisigwallet, owner, recipient } = await loadFixture(deployMultiSigWalletFixture);
      const amount = ethers.parseEther("1.0");

      await expect(multisigwallet.connect(owner).proposeTransaction(recipient.address, amount))
        .to.emit(multisigwallet, "TransactionProposed")
        .withArgs(0, owner.address, amount, recipient.address);
    });

    it("should allow an owner to approve a transaction", async function () {
      const { multisigwallet, owner, otherOwner, recipient } = await loadFixture(deployMultiSigWalletFixture);
      const amount = ethers.parseEther("1.0");

      await multisigwallet.connect(owner).proposeTransaction(recipient.address, amount);
      await expect(multisigwallet.connect(otherOwner).approveTransaction(0))
        .to.emit(multisigwallet, "TransactionApproved")
        .withArgs(0, otherOwner.address);
    });

    it("should execute after timelock and enough approvals", async function () {
      const { multisigwallet, owner, otherOwner, recipient } = await loadFixture(deployMultiSigWalletFixture);
      const amount = ethers.parseEther("1.0");

      await multisigwallet.connect(owner).proposeTransaction(recipient.address, amount);
      await multisigwallet.connect(otherOwner).approveTransaction(0);

      await network.provider.send("evm_increaseTime", [86400 + 1]);
      await network.provider.send("evm_mine");

      await expect(multisigwallet.connect(owner).executeTransaction(0))
        .to.emit(multisigwallet, "TransactionExecuted")
        .withArgs(0);
    });

    it("should allow cancelling a transaction", async function () {
      const { multisigwallet, owner, recipient } = await loadFixture(deployMultiSigWalletFixture);
      const amount = ethers.parseEther("1.0");

      await multisigwallet.connect(owner).proposeTransaction(recipient.address, amount);
      await expect(multisigwallet.connect(owner).cancelTransaction(0))
        .to.emit(multisigwallet, "TransactionCancelled")
        .withArgs(0);
    });
  });
});
