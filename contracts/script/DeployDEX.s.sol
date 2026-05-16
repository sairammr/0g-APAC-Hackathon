// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/tokens/MockUSD.sol";
import "../src/tokens/MockRisk.sol";

interface IFactory {
    function createPair(address, address) external returns (address);
    function getPair(address, address) external view returns (address);
}
interface IRouter {
    function factory() external view returns (address);
    function WETH() external view returns (address);
    function addLiquidity(
        address,address,uint,uint,uint,uint,address,uint
    ) external returns (uint,uint,uint);
}

contract DeployDEX is Script {
    function run() external returns (address factory, address router, address usd, address risk, address pair) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);
        factory = vm.envAddress("UNI_FACTORY");
        router  = vm.envAddress("UNI_ROUTER");

        vm.startBroadcast(pk);
        MockUSD u = new MockUSD();
        MockRisk r = new MockRisk();
        usd = address(u); risk = address(r);

        pair = IFactory(factory).createPair(usd, risk);

        u.approve(router, type(uint256).max);
        r.approve(router, type(uint256).max);
        IRouter(router).addLiquidity(
            usd, risk,
            1_000_000 * 1e18, 100_000 * 1e18,
            0, 0, me, block.timestamp + 3600
        );
        vm.stopBroadcast();
    }
}
