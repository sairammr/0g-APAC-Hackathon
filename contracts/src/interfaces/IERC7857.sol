// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";

/// ERC-7857 draft: encrypted-metadata NFT for AI agents.
interface IERC7857 is IERC721 {
    event BrainUpdated(uint256 indexed tokenId, bytes32 prevRoot, bytes32 newRoot, string uri);
    event BrainReKeyed(uint256 indexed tokenId, address indexed from, address indexed to, bytes32 newRoot);

    function latestBrainRoot(uint256 tokenId) external view returns (bytes32);
    function prevBrainRoot(uint256 tokenId) external view returns (bytes32);
    function brainURI(uint256 tokenId) external view returns (string memory);

    function transferWithReKey(
        address from,
        address to,
        uint256 tokenId,
        bytes32 newBrainRoot,
        string calldata newURI,
        bytes calldata sealedKey,
        bytes calldata oracleProof
    ) external;
}
