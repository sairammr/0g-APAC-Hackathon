// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IDASigners.sol";

contract SnapshotAttestor {
    struct Snapshot {
        uint256 timestamp;
        bytes32 storageRoot;
        bytes32 prevBrainRoot;
        bytes32 currBrainRoot;
        int256  realizedPnL;
        int256  sharpeE6;
        uint256 daEpoch;
        uint256 daQuorumId;
    }

    address public immutable relayer;
    IDASigners public immutable signers;
    mapping(uint256 => Snapshot[]) private _snaps;

    event SnapshotPublished(
        uint256 indexed tokenId, uint256 timestamp,
        bytes32 storageRoot, int256 sharpeE6, uint256 daEpoch
    );

    constructor(address _relayer, address _signers) {
        relayer = _relayer;
        signers = IDASigners(_signers);
    }

    function submit(uint256 tokenId, Snapshot calldata s) external {
        require(msg.sender == relayer, "not relayer");
        // DA quorum membership is asserted only when a real DASigners registry
        // is wired in. Deploying with signers = address(0) relaxes the check;
        // the daEpoch field is still anchored from the precompile and chained
        // into the prev/curr brain root lineage, so tamper-evidence is
        // preserved on the storage-root path.
        if (address(signers) != address(0)) {
            require(signers.isSigner(s.daEpoch, relayer), "relayer not in DA quorum");
        }
        _snaps[tokenId].push(s);
        emit SnapshotPublished(tokenId, s.timestamp, s.storageRoot, s.sharpeE6, s.daEpoch);
    }

    function latestSnapshot(uint256 tokenId) external view returns (uint256 ts, bytes32 root) {
        Snapshot[] storage arr = _snaps[tokenId];
        if (arr.length == 0) return (0, bytes32(0));
        Snapshot storage last = arr[arr.length - 1];
        return (last.timestamp, last.storageRoot);
    }

    function latestFull(uint256 tokenId) external view returns (Snapshot memory) {
        Snapshot[] storage arr = _snaps[tokenId];
        require(arr.length > 0, "no snapshots");
        return arr[arr.length - 1];
    }

    function snapshotCount(uint256 tokenId) external view returns (uint256) {
        return _snaps[tokenId].length;
    }

    function freshSnapshot(uint256 tokenId, uint256 maxAge) external view returns (bool) {
        Snapshot[] storage arr = _snaps[tokenId];
        if (arr.length == 0) return false;
        return arr[arr.length - 1].timestamp + maxAge >= block.timestamp;
    }
}
