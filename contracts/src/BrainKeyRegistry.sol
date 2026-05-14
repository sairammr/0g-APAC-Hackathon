// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Maps tokenId → uncompressed secp256k1 pubkey used to ECIES-encrypt the brain blob.
/// Updated by AgentController during transferWithReKey.
contract BrainKeyRegistry {
    mapping(uint256 => bytes) private _keys;
    mapping(uint256 => address) public keyOwner;

    /// Optional operator (e.g. iNFT2 contract) that can bypass the keyOwner check in setKeyFor.
    /// Set to address(0) to disable bypass.
    address public immutable operator;

    event KeySet(uint256 indexed tokenId, address indexed owner, bytes pubkey);

    constructor(address _operator) {
        operator = _operator;
    }

    function setKey(uint256 tokenId, bytes calldata pubkey) external {
        address current = keyOwner[tokenId];
        require(current == address(0) || current == msg.sender, "not key owner");
        _keys[tokenId] = pubkey;
        keyOwner[tokenId] = msg.sender;
        emit KeySet(tokenId, msg.sender, pubkey);
    }

    function setKeyFor(uint256 tokenId, address newOwner, bytes calldata pubkey) external {
        require(msg.sender == operator || keyOwner[tokenId] == msg.sender, "not authorized");
        _keys[tokenId] = pubkey;
        keyOwner[tokenId] = newOwner;
        emit KeySet(tokenId, newOwner, pubkey);
    }

    function keyOf(uint256 tokenId) external view returns (bytes memory) {
        return _keys[tokenId];
    }
}
