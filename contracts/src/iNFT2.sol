// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import "openzeppelin-contracts/contracts/utils/cryptography/EIP712.sol";
import "./interfaces/IERC7857.sol";
import "./BrainKeyRegistry.sol";

contract iNFT2 is ERC721, EIP712, IERC7857 {
    using ECDSA for bytes32;

    uint256 public nextId = 1;
    mapping(uint256 => bytes32) private _latestRoot;
    mapping(uint256 => bytes32) private _prevRoot;
    mapping(uint256 => string)  private _uri;

    BrainKeyRegistry public immutable keyRegistry;
    address public immutable oracle;

    bool private _reKeying;

    bytes32 private constant TRANSFER_TYPEHASH = keccak256(
        "Transfer(uint256 tokenId,address from,address to,bytes32 newBrainRoot,string newURI)"
    );

    constructor(address _keyRegistry, address _oracle)
        ERC721("Intelligent NFT Squared", "iNFT2")
        EIP712("iNFT2", "1")
    {
        keyRegistry = BrainKeyRegistry(_keyRegistry);
        oracle = _oracle;
    }

    function latestBrainRoot(uint256 id) external view returns (bytes32) { return _latestRoot[id]; }
    function prevBrainRoot(uint256 id) external view returns (bytes32)   { return _prevRoot[id]; }
    function brainURI(uint256 id) external view returns (string memory)  { return _uri[id]; }

    function mint(address to, bytes32 root, string calldata uri_, bytes calldata pubkey)
        external returns (uint256 id)
    {
        id = nextId++;
        _safeMint(to, id);
        _latestRoot[id] = root;
        _uri[id] = uri_;
        keyRegistry.setKey(id, pubkey);
        _transferKeyOwner(id, to, pubkey);
        emit BrainUpdated(id, bytes32(0), root, uri_);
    }

    function updateBrain(uint256 id, bytes32 newRoot, string calldata uri_) external {
        require(_isAuthorized(_ownerOf(id), msg.sender, id), "not authorized");
        bytes32 prev = _latestRoot[id];
        _prevRoot[id] = prev;
        _latestRoot[id] = newRoot;
        _uri[id] = uri_;
        emit BrainUpdated(id, prev, newRoot, uri_);
    }

    function transferDigest(
        uint256 tokenId, address from, address to, bytes32 newRoot, string calldata newURI
    ) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            TRANSFER_TYPEHASH, tokenId, from, to, newRoot, keccak256(bytes(newURI))
        )));
    }

    function transferWithReKey(
        address from, address to, uint256 tokenId,
        bytes32 newBrainRoot, string calldata newURI,
        bytes calldata sealedKey, bytes calldata oracleProof
    ) external override {
        require(to != address(0), "zero to");
        require(ownerOf(tokenId) == from, "wrong from");
        require(_isAuthorized(from, msg.sender, tokenId), "not authorized");

        bytes32 digest = transferDigest(tokenId, from, to, newBrainRoot, newURI);
        address recovered = digest.recover(oracleProof);
        require(recovered == oracle, "bad oracle sig");

        bytes32 prev = _latestRoot[tokenId];
        _prevRoot[tokenId] = prev;
        _latestRoot[tokenId] = newBrainRoot;
        _uri[tokenId] = newURI;

        _transferKeyOwner(tokenId, to, sealedKey);
        _reKeying = true;
        _transfer(from, to, tokenId);
        _reKeying = false;

        emit BrainUpdated(tokenId, prev, newBrainRoot, newURI);
        emit BrainReKeyed(tokenId, from, to, newBrainRoot);
    }

    function _beforeTokenTransfer(address from, address to, uint256 firstTokenId, uint256 batchSize) internal override {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
        if (from != address(0) && to != address(0)) {
            require(_reKeying, "use transferWithReKey");
        }
    }

    function _transferKeyOwner(uint256 id, address newOwner, bytes memory pubkey) internal {
        keyRegistry.setKeyFor(id, newOwner, pubkey);
    }

    function _isAuthorized(address owner, address spender, uint256 tokenId) internal view returns (bool) {
        return (spender == owner || isApprovedForAll(owner, spender) || getApproved(tokenId) == spender);
    }
}
