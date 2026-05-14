// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/iNFT2.sol";
import "../src/BrainKeyRegistry.sol";
import "../src/ERC6551Account.sol";
import "../src/ERC6551Registry.sol";
import "../src/SnapshotAttestor.sol";
import "../src/AgentController.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address operator = vm.addr(pk);
        address registryEnv = vm.envOr("REGISTRY_ADDR", address(0));
        address dasigners = vm.envAddress("DASIGNERS");

        // Predict iNFT2 address: operator deploys BrainKeyRegistry (nonce N), then iNFT2 (nonce N+1)
        uint64 startNonce = vm.getNonce(operator);
        address predictedInft = vm.computeCreateAddress(operator, uint256(startNonce) + 1);

        vm.startBroadcast(pk);
        BrainKeyRegistry keys = new BrainKeyRegistry(predictedInft);
        iNFT2 inft = new iNFT2(address(keys), operator);
        require(address(inft) == predictedInft, "iNFT2 address prediction mismatch");

        ERC6551Account impl = new ERC6551Account();
        ERC6551Registry reg = registryEnv == address(0)
            ? new ERC6551Registry()
            : ERC6551Registry(registryEnv);
        SnapshotAttestor att = new SnapshotAttestor(operator, dasigners);
        AgentController ctrl = new AgentController(
            address(inft), address(reg), address(impl), address(att)
        );
        vm.stopBroadcast();

        console.log("BrainKeyRegistry:", address(keys));
        console.log("iNFT2:", address(inft));
        console.log("ERC6551Account impl:", address(impl));
        console.log("ERC6551Registry:", address(reg));
        console.log("SnapshotAttestor:", address(att));
        console.log("AgentController:", address(ctrl));
        console.log("Operator EOA:", operator);
    }
}
