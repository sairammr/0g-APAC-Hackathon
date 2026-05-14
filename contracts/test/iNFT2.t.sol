// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/iNFT2.sol";
import "../src/BrainKeyRegistry.sol";

contract iNFT2Test is Test {
    iNFT2 inft;
    BrainKeyRegistry keys;
    address alice = address(0xA11CE);
    address bob   = address(0xB0B);
    address oracle = address(0x0AC1E);

    function setUp() public {
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        keys = new BrainKeyRegistry(predicted);
        inft = new iNFT2(address(keys), oracle);
        require(address(inft) == predicted, "predict mismatch");
    }

    function test_mint_assignsBrainAndOwner() public {
        bytes32 root = keccak256("brain-v1");
        bytes memory pk = hex"04aabbccdd";
        uint256 id = inft.mint(alice, root, "0g://abc", pk);
        assertEq(inft.ownerOf(id), alice);
        assertEq(inft.latestBrainRoot(id), root);
        assertEq(keys.keyOf(id), pk);
        assertEq(keys.keyOwner(id), alice);
    }

    function test_updateBrain_chainsLineage() public {
        vm.startPrank(alice);
        uint256 id = inft.mint(alice, keccak256("v1"), "0g://1", hex"04aabb");
        inft.updateBrain(id, keccak256("v2"), "0g://2");
        vm.stopPrank();
        assertEq(inft.prevBrainRoot(id), keccak256("v1"));
        assertEq(inft.latestBrainRoot(id), keccak256("v2"));
    }

    function test_transferWithReKey_requiresOracleSig() public {
        vm.prank(alice);
        uint256 id = inft.mint(alice, keccak256("v1"), "0g://1", hex"04aabb");

        bytes32 digest = inft.transferDigest(id, alice, bob, keccak256("v2"), "0g://2");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(keccak256("oracle-key")), digest);

        vm.prank(alice);
        vm.expectRevert("bad oracle sig");
        inft.transferWithReKey(alice, bob, id, keccak256("v2"), "0g://2", hex"04bbcc", abi.encodePacked(r, s, v));
    }

    function test_transferWithReKey_withValidOracleSig_rotates() public {
        uint256 oraclePk = uint256(keccak256("oracle-key"));
        address oracleAddr = vm.addr(oraclePk);
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        BrainKeyRegistry keys2 = new BrainKeyRegistry(predicted);
        iNFT2 inft2 = new iNFT2(address(keys2), oracleAddr);

        vm.prank(alice);
        uint256 id = inft2.mint(alice, keccak256("v1"), "0g://1", hex"04aabb");

        bytes32 digest = inft2.transferDigest(id, alice, bob, keccak256("v2"), "0g://2");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(alice);
        inft2.transferWithReKey(alice, bob, id, keccak256("v2"), "0g://2", hex"04bbcc", sig);

        assertEq(inft2.ownerOf(id), bob);
        assertEq(inft2.latestBrainRoot(id), keccak256("v2"));
        assertEq(inft2.prevBrainRoot(id), keccak256("v1"));
        assertEq(keys2.keyOf(id), hex"04bbcc");
        assertEq(keys2.keyOwner(id), bob);
    }

    function test_vanillaTransferFrom_reverts() public {
        vm.prank(alice);
        uint256 id = inft.mint(alice, keccak256("v1"), "0g://1", hex"04aabb");
        vm.prank(alice);
        vm.expectRevert("use transferWithReKey");
        inft.transferFrom(alice, bob, id);
    }

    function test_safeTransferFrom_reverts() public {
        vm.prank(alice);
        uint256 id = inft.mint(alice, keccak256("v1"), "0g://1", hex"04aabb");
        vm.prank(alice);
        vm.expectRevert("use transferWithReKey");
        inft.safeTransferFrom(alice, bob, id);
    }
}
