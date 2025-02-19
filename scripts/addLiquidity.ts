import { ethers } from "hardhat";
const helpers = require("@nomicfoundation/hardhat-network-helpers");

// Addresses
const UniswapV3Address = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
const usdcAddress = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const wethAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const usdcWhale = "0xf584f8728b874a6a5c7a8d4d387c9aae9172d621";

async function main() {
    console.log("USDC Address:", usdcAddress);
    console.log("WETH Address:", wethAddress);
    console.log("Uniswap V3 Position Manager Address:", UniswapV3Address);
    console.log("USDC Whale Address:", usdcWhale);

    // Impersonate USDC Whale
    await helpers.impersonateAccount(usdcWhale);
    const impersonatedSigner = await ethers.getSigner(usdcWhale);

    // Fund impersonated account with ETH for gas fees
    await helpers.setBalance(usdcWhale, ethers.parseUnits("1", 18)); // Provide 1 ETH
    console.log("ETH balance set for impersonated account!");

    // Get contract instances
    const usdc = await ethers.getContractAt("IERC20", usdcAddress);
    const weth = await ethers.getContractAt("IERC20", wethAddress);
    const uniswapV3 = await ethers.getContractAt("IUniswapV3PositionManager", UniswapV3Address);

    // Approve Uniswap to spend USDC and WETH
    await usdc.connect(impersonatedSigner).approve(UniswapV3Address, ethers.MaxUint256);
    await weth.connect(impersonatedSigner).approve(UniswapV3Address, ethers.MaxUint256);

    console.log("Tokens approved!");

    // Define liquidity parameters
    const params = {
        token0: usdcAddress,
        token1: wethAddress,
        fee: 3000,
        tickLower: -887220,
        tickUpper: 887220,
        amount0Desired: ethers.parseUnits("500", 6), // 500 USDC
        amount1Desired: ethers.parseUnits("0.5", 18), // 0.5 WETH
        amount0Min: 0,
        amount1Min: 0,
        recipient: impersonatedSigner.address,
        deadline: Math.floor(Date.now() / 1000) + 600,
    };

    console.log("Minting liquidity...", params);

    // Add liquidity
    try {
        const tx = await uniswapV3.mint(params);
        await tx.wait();
        console.log("Liquidity added successfully!", tx.hash);
    } catch (error) {
        console.error("Minting liquidity failed:", error);
    }
}

main().catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
});