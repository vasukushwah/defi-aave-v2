const { getNamedAccounts, ethers } = require("hardhat")
const { networkConfig } = require("../helper-hardhat-config")
const { getWeth, AMOUNT } = require("./getWeth")
async function main() {
    await getWeth()
    const { deployer } = await getNamedAccounts()
    const lendingPool = await getLandingPool(deployer)
    console.log(`LendingPool Address ${lendingPool.address}`)
    const wethToken = networkConfig[31337].wethToken
    await approveErc20(networkConfig[31337].wethToken, lendingPool.address, AMOUNT, deployer)
    console.log("Depositing...")
    await lendingPool.deposit(wethToken, AMOUNT, deployer, 0)
    console.log("Deposited")

    let { totalDebtETH, availableBorrowsETH } = await getBorrowUserData(lendingPool, deployer)
    const daiEthPriceFeedAddress = networkConfig[31337].daiEthPriceFeed
    const daiPrice = await getDAIPrice(daiEthPriceFeedAddress)
    const amountDaiToBorrow = availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumber())
    console.log(`you can borrow ${amountDaiToBorrow} DAI`)
    const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString())
    const daiTokenAddress = networkConfig[31337].daiToken
    await borrowDai(daiTokenAddress, lendingPool, amountDaiToBorrowWei, deployer)
    await getBorrowUserData(lendingPool, deployer)
    await repay(daiTokenAddress, lendingPool, amountDaiToBorrowWei, deployer)

    await getBorrowUserData(lendingPool, deployer)
}

async function repay(daiAddress, lendingPool, amount, account) {
    await approveErc20(daiAddress, lendingPool.address, amount, account)
    const repayTx = await lendingPool.repay(daiAddress, amount, 1, account)
    await repayTx.wait(1)
    console.log("Repaid!")
}

async function borrowDai(daiAddress, lendingPool, amountDaiToBorrowWei, account) {
    const borrowTx = await lendingPool.borrow(daiAddress, amountDaiToBorrowWei, 1, 0, account)
    await borrowTx.wait(1)
    console.log(`you have borrowed!`)
}

async function getDAIPrice(daiEthPriceFeedAddress) {
    const daiEthPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        daiEthPriceFeedAddress
    )
    const price = (await daiEthPriceFeed.latestRoundData())[1]
    console.log(`DAI/ETH price ${price}`)
    return price
}

async function getBorrowUserData(landingPool, userAddress) {
    const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
        await landingPool.getUserAccountData(userAddress)

    console.log(`You have ${totalCollateralETH} worth of ETH deposited`)
    console.log(`You have ${totalDebtETH} worth of ETH borrowed`)
    console.log(`You have ${availableBorrowsETH} worth of ETH`)
    return { totalDebtETH, availableBorrowsETH }
}
async function getLandingPool(account) {
    const lendingPoolAddressesProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        networkConfig[31337].lendingPoolAddressesProvider,
        account
    )
    // console.log(lendingPoolAddressesProvider)
    const lendingPooolAddress = await lendingPoolAddressesProvider.getLendingPool()
    const lendingPool = await ethers.getContractAt("ILendingPool", lendingPooolAddress, account)
    return lendingPool
}
async function approveErc20(erc20Address, spenderAddress, amountToSpend, account) {
    const Erc20 = await ethers.getContractAt("IERC20", erc20Address, account)
    const tx = await Erc20.approve(spenderAddress, amountToSpend)
    await tx.wait(1)
    console.log("Approved!")
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
