// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Precompile at 0x0000000000000000000000000000000000001000 on 0G mainnet.
interface IDASigners {
    struct Signer {
        address signer;
        bytes pubKey;
    }
    function getEpochNumber(uint256 blockNumber) external view returns (uint256);
    function getQuorum(uint256 epoch, uint256 quorumId) external view returns (Signer[] memory);
    function isSigner(uint256 epoch, address account) external view returns (bool);
}
