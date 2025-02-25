import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying MultiSigWallet with account:", deployer.address);

  const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
  const multisigwallet = await MultiSigWallet.deploy(2, deployer.address);
  await multisigwallet.waitForDeployment();

  console.log("MultiSigWallet deployed at:", await multisigwallet.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});