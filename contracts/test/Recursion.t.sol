// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "openzeppelin-contracts/contracts/token/ERC721/IERC721Receiver.sol";
import "../src/iNFT2.sol";
import "../src/BrainKeyRegistry.sol";
import "../src/AgentController.sol";
import "../src/SnapshotAttestor.sol";
import "../src/ERC6551Account.sol";
import "../src/ERC6551Registry.sol";

contract MockSig2 {
    function isSigner(uint256, address) external pure returns (bool) { return true; }
    function getEpochNumber(uint256) external pure returns (uint256) { return 1; }
}

contract RecursionTest is Test, IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    iNFT2 inft;
    BrainKeyRegistry keys;
    AgentController ctrl;
    SnapshotAttestor att;
    ERC6551Registry reg;
    ERC6551Account impl;
    address me = address(this);

    function setUp() public {
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        keys = new BrainKeyRegistry(predicted);
        inft = new iNFT2(address(keys), address(0));
        require(address(inft) == predicted, "predict mismatch");
        impl = new ERC6551Account();
        reg  = new ERC6551Registry();
        att  = new SnapshotAttestor(me, address(new MockSig2()));
        ctrl = new AgentController(address(inft), address(reg), address(impl), address(att));
    }

    function _mintTo(address to) internal returns (uint256 id, address wallet) {
        id = inft.mint(to, keccak256(abi.encode(to, block.number, gasleft())), "0g://x", hex"04aa");
        wallet = reg.createAccount(address(impl), bytes32(0), block.chainid, address(inft), id);
    }

    function test_depth1_parentHoldsChildDirectly() public {
        (uint256 p, address pw) = _mintTo(me);
        // mint child directly into parent's wallet — no transferFrom needed
        (uint256 c, ) = _mintTo(pw);
        assertEq(inft.ownerOf(c), pw);
        assertTrue(ctrl.isInSubtree(p, c));
    }

    function test_depth2_grandchildViaWalletChain() public {
        (uint256 p, address pw) = _mintTo(me);
        (uint256 c, address cw) = _mintTo(pw);
        (uint256 g, ) = _mintTo(cw);
        assertEq(inft.ownerOf(c), pw);
        assertEq(inft.ownerOf(g), cw);
        assertTrue(ctrl.isInSubtree(p, g));
    }

    function test_unrelatedToken_returnsFalse() public {
        (uint256 p, ) = _mintTo(me);
        (uint256 other, ) = _mintTo(me); // separate root, not nested
        assertFalse(ctrl.isInSubtree(p, other));
    }

    function test_selfReference_returnsFalse() public {
        (uint256 p, ) = _mintTo(me);
        assertFalse(ctrl.isInSubtree(p, p));
    }

    function test_depth4_exceedsMaxDepth_returnsFalse() public {
        // Chain of length 4 — should fail because MAX_DEPTH = 3
        (uint256 p, address pw) = _mintTo(me);
        (, address w1) = _mintTo(pw);
        (, address w2) = _mintTo(w1);
        (, address w3) = _mintTo(w2);
        (uint256 deep, ) = _mintTo(w3);
        assertFalse(ctrl.isInSubtree(p, deep));
    }
}
