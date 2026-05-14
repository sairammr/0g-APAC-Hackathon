// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Maps tokenId → uncompressed secp256k1 pubkey used to ECIES-encrypt the brain blob.
/// Updated by AgentController during transferWithReKey.
contract BrainKeyRegistry {
    mapping(uint256 => bytes) private _keys;
    mapping(uint256 => address) public keyOwner;

    event KeySet(uint256 indexed tokenId, address indexed owner, bytes pubkey);

    function setKey(uint256 tokenId, bytes calldata pubkey) external {
        address current = keyOwner[tokenId];
        require(current == address(0) || current == msg.sender, "not key owner");
        _keys[tokenId] = pubkey;
        keyOwner[tokenId] = msg.sender;
        emit KeySet(tokenId, msg.sender, pubkey);
    }

    function setKeyFor(uint256 tokenId, address newOwner, bytes calldata pubkey) external {
        require(keyOwner[tokenId] == msg.sender, "not key owner");
        _keys[tokenId] = pubkey;
        keyOwner[tokenId] = newOwner;
        emit KeySet(tokenId, newOwner, pubkey);
    }

    function keyOf(uint256 tokenId) external view returns (bytes memory) {
        return _keys[tokenId];
    }
}
