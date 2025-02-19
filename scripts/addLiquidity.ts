import { ethers } from "hardhat";
const helpers = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const main = async () => {
    console.log("Starting Mainnet Fork...");

    // Token addresses
    const threshholdAddress = "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5";
    const kucoinAddress = "0xf34960d9d60be18cC1D5Afc1A6F012A723a28811"; 
    
    const IUniswapV3Address = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
    const liquidityProvider = "0xf584F8728B874a6a5c7A8d4d387C9aae9172D621";

    await helpers.impersonateAccount(liquidityProvider);
    const lmpersonatedSigner = await ethers.getSigner(liquidityProvider);

    const IUniswapV3Contract = await ethers.getContractAt("INonfungiblePositionManager", IUniswapV3Address, lmpersonatedSigner);

    console.log("Adding liquidity...");
    
    // Define liquidity parameters
    const params = {
        token0: threshholdAddress,
        token1: kucoinAddress,
        fee: 3000, 
        amount0Desired: ethers.parseUnits("1000000" 18), 
        amount1Desired: ethers.parseUnits("2000", 6), 
        amount0Min: 0,
        amount1Min: 0,
        recipient: liquidityProvider,
        deadline: await helpers.time.latest() + 600,
    };
    
    // function mint(MintParams calldata params) external returns (
    //     uint256 tokenId,
    //     uint128 liquidity,
    //     uint256 amount0,
    //     uint256 amount1

    console.log("Approving tokens...");

    // Approve token spending
    const token0 = await ethers.getContractAt("IERC20", threshholdAddress, lmpersonatedSigner);
    const token1 = await ethers.getContractAt("IERC20", kucoinAddress, lmpersonatedSigner);

    await (await token0.connect(lmpersonatedSigner).approve(IUniswapV3Address, params.amount0Desired)).wait();
    await (await token1.connect(lmpersonatedSigner).approve(IUniswapV3Address, params.amount1Desired)).wait();

    console.log("Tokens approved, adding liquidity...");

    // Add liquidity
    const tx = await IUniswapV3Contract.mint(params);
    await tx.wait();
    console.log("Liquidity added successfully!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
