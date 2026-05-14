// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/iNFT2.sol";
import "../src/AgentController.sol";
import "../src/ERC6551Registry.sol";

contract SeedDemo is Script {
    iNFT2 inft;
    AgentController ctrl;
    ERC6551Registry reg;
    address impl;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);
        inft = iNFT2(vm.envAddress("INFT2"));
        ctrl = AgentController(vm.envAddress("CTRL"));
        reg = ERC6551Registry(vm.envAddress("REGISTRY"));
        impl = vm.envAddress("ACC_IMPL");
        bytes memory pubkey = vm.envBytes("BRAIN_PUBKEY");

        vm.startBroadcast(pk);

        // 1. Mint 4 agents
        uint256 mgr = inft.mint(me, keccak256("manager-v1"),     "0g://mgr", pubkey);
        uint256 c1  = inft.mint(me, keccak256("momentum-v1"),    "0g://mom", pubkey);
        uint256 c2  = inft.mint(me, keccak256("meanRev-v1"),     "0g://mr",  pubkey);
        uint256 c3  = inft.mint(me, keccak256("marketMaker-v1"), "0g://mm",  pubkey);

        // 2. Set operator + permissive policy (no targets yet — DEX comes later)
        _configure(mgr, me);
        _configure(c1, me);
        _configure(c2, me);
        _configure(c3, me);

        // 3. Pre-create 6551 wallets
        _createWallet(mgr);
        _createWallet(c1);
        _createWallet(c2);
        _createWallet(c3);

        // 4. Approve the controller to drive all of the user's NFTs (needed for executeIntent path)
        inft.setApprovalForAll(address(ctrl), true);

        vm.stopBroadcast();

        console.log("manager id:", mgr);
        console.log("child1 id:", c1);
        console.log("child2 id:", c2);
        console.log("child3 id:", c3);
        console.log("manager wallet:", ctrl.walletOf(mgr));
        console.log("child1 wallet:", ctrl.walletOf(c1));
        console.log("child2 wallet:", ctrl.walletOf(c2));
        console.log("child3 wallet:", ctrl.walletOf(c3));
    }

    function _configure(uint256 id, address op) internal {
        address[] memory targets = new address[](0);
        AgentController.Policy memory p = AgentController.Policy({
            allowedTargets: targets,
            maxValuePerTx: 1 ether,
            maxDailyVolume: 10 ether,
            snapshotMaxAge: 0
        });
        ctrl.setOperator(id, op);
        ctrl.setPolicy(id, p);
    }

    function _createWallet(uint256 id) internal {
        reg.createAccount(impl, bytes32(0), block.chainid, address(inft), id);
    }
}
