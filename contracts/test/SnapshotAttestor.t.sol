// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/SnapshotAttestor.sol";
import "../src/interfaces/IDASigners.sol";

contract MockDASigners is IDASigners {
    mapping(uint256 => mapping(address => bool)) public _isSigner;
    function setSigner(uint256 epoch, address a, bool ok) external { _isSigner[epoch][a] = ok; }
    function getEpochNumber(uint256) external pure returns (uint256) { return 1; }
    function getQuorum(uint256, uint256) external pure returns (Signer[] memory s) { s = new Signer[](0); }
    function isSigner(uint256 epoch, address a) external view returns (bool) { return _isSigner[epoch][a]; }
}

contract SnapshotAttestorTest is Test {
    SnapshotAttestor att;
    MockDASigners das;
    address relayer = address(0xBEEF);

    function setUp() public {
        das = new MockDASigners();
        att = new SnapshotAttestor(relayer, address(das));
    }

    function test_submit_storesAndEmits() public {
        SnapshotAttestor.Snapshot memory s = SnapshotAttestor.Snapshot({
            timestamp: 1700000000,
            storageRoot: keccak256("blob"),
            prevBrainRoot: bytes32(0),
            currBrainRoot: keccak256("v1"),
            realizedPnL: 1e6,
            sharpeE6: 1500000,
            daEpoch: 1,
            daQuorumId: 0
        });
        das.setSigner(1, relayer, true);
        vm.prank(relayer);
        att.submit(42, s);
        (uint256 ts, bytes32 root) = att.latestSnapshot(42);
        assertEq(ts, 1700000000);
        assertEq(root, keccak256("blob"));
    }

    function test_submit_revertsIfRelayerNotInQuorum() public {
        SnapshotAttestor.Snapshot memory s;
        s.daEpoch = 1;
        vm.prank(relayer);
        vm.expectRevert("relayer not in DA quorum");
        att.submit(42, s);
    }
}
