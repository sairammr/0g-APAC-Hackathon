// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/BrainKeyRegistry.sol";

contract BrainKeyTest is Test {
    BrainKeyRegistry reg;
    address alice = address(0xA11CE);
    address bob   = address(0xB0B);

    function setUp() public { reg = new BrainKeyRegistry(address(0)); }

    function test_setKey_storesAndEmits() public {
        bytes memory pk = hex"04aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899";
        vm.prank(alice);
        reg.setKey(1, pk);
        assertEq(reg.keyOf(1), pk);
        assertEq(reg.keyOwner(1), alice);
    }

    function test_setKey_rejectsRekeyByNonOwner() public {
        vm.prank(alice);
        reg.setKey(1, hex"01");
        vm.expectRevert("not key owner");
        reg.setKey(1, hex"02");
    }

    function test_setKeyFor_byOperator_bypassesOwner() public {
        address operatorAddr = address(0x0FFA);
        BrainKeyRegistry reg2 = new BrainKeyRegistry(operatorAddr);
        vm.prank(alice);
        reg2.setKey(1, hex"01");
        assertEq(reg2.keyOwner(1), alice);

        vm.prank(operatorAddr);
        reg2.setKeyFor(1, bob, hex"02");
        assertEq(reg2.keyOf(1), hex"02");
        assertEq(reg2.keyOwner(1), bob);
    }
}
