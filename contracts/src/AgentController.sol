// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import "openzeppelin-contracts/contracts/utils/cryptography/EIP712.sol";
import "./interfaces/IERC6551Registry.sol";
import "./interfaces/IERC6551Account.sol";

interface ISnap {
    function freshSnapshot(uint256, uint256) external view returns (bool);
}

contract AgentController is EIP712 {
    using ECDSA for bytes32;

    uint256 public constant MAX_DEPTH = 3;
    bytes32 public constant SALT = bytes32(0);

    struct Policy {
        address[] allowedTargets;
        uint256 maxValuePerTx;
        uint256 maxDailyVolume;
        uint256 snapshotMaxAge;
    }
    struct Intent {
        uint256 tokenId;
        uint256 nonce;
        address target;
        uint256 value;
        bytes   callData;
        uint64  expiry;
    }

    bytes32 private constant INTENT_TYPEHASH = keccak256(
        "Intent(uint256 tokenId,uint256 nonce,address target,uint256 value,bytes callData,uint64 expiry)"
    );

    IERC721 public immutable inft;
    IERC6551Registry public immutable registry;
    address public immutable accountImpl;
    ISnap   public immutable attestor;

    mapping(uint256 => address) public operatorOf;
    mapping(uint256 => Policy)  private _policy;
    mapping(uint256 => uint256) public nextNonce;
    mapping(uint256 => mapping(uint256 => uint256)) public dailyVolume;

    event OperatorSet(uint256 indexed tokenId, address operator);
    event PolicySet(uint256 indexed tokenId);
    event IntentExecuted(
        uint256 indexed parentId, uint256 indexed childId,
        address indexed target, uint256 value, bytes32 callHash
    );

    constructor(address _inft, address _registry, address _impl, address _attestor)
        EIP712("iNFT2-AgentController", "1")
    {
        inft = IERC721(_inft);
        registry = IERC6551Registry(_registry);
        accountImpl = _impl;
        attestor = ISnap(_attestor);
    }

    function setOperator(uint256 id, address op) external {
        require(inft.ownerOf(id) == msg.sender, "not NFT owner");
        operatorOf[id] = op;
        emit OperatorSet(id, op);
    }

    function setPolicy(uint256 id, Policy calldata p) external {
        require(inft.ownerOf(id) == msg.sender, "not NFT owner");
        _policy[id] = p;
        emit PolicySet(id);
    }

    function policyOf(uint256 id) external view returns (Policy memory) { return _policy[id]; }

    function walletOf(uint256 id) public view returns (address) {
        return registry.account(accountImpl, SALT, block.chainid, address(inft), id);
    }

    function intentDigest(Intent calldata i) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            INTENT_TYPEHASH, i.tokenId, i.nonce, i.target, i.value,
            keccak256(i.callData), i.expiry
        )));
    }

    function executeIntent(Intent calldata i, bytes calldata sig) external {
        require(intentDigest(i).recover(sig) == operatorOf[i.tokenId], "bad operator sig");
        _check(i.tokenId, i);
        _exec(i.tokenId, i);
        emit IntentExecuted(i.tokenId, i.tokenId, i.target, i.value, keccak256(i.callData));
    }

    function executeChildIntent(uint256 parentId, Intent calldata i, bytes calldata sig) external {
        require(intentDigest(i).recover(sig) == operatorOf[parentId], "bad parent operator sig");
        require(_isInSubtree(parentId, i.tokenId, 0), "child not in subtree");
        _check(i.tokenId, i);
        _exec(i.tokenId, i);
        emit IntentExecuted(parentId, i.tokenId, i.target, i.value, keccak256(i.callData));
    }

    function isInSubtree(uint256 parentId, uint256 childId) external view returns (bool) {
        return _isInSubtree(parentId, childId, 0);
    }

    function _isInSubtree(uint256 parentId, uint256 childId, uint256 depth) internal view returns (bool) {
        if (parentId == childId) return false;
        if (depth >= MAX_DEPTH) return false;
        address parentWallet = walletOf(parentId);
        address childOwner = inft.ownerOf(childId);
        if (childOwner == parentWallet) return true;
        try IERC6551Account(payable(childOwner)).token() returns (uint256 cid, address tc, uint256 tid) {
            if (cid != block.chainid || tc != address(inft)) return false;
            return _isInSubtree(parentId, tid, depth + 1);
        } catch {
            return false;
        }
    }

    function _check(uint256 id, Intent calldata i) internal {
        Policy storage p = _policy[id];
        require(i.nonce == nextNonce[id], "bad nonce");
        nextNonce[id] = i.nonce + 1;
        require(block.timestamp <= i.expiry, "expired");
        require(_inAllowed(p.allowedTargets, i.target), "target denied");
        require(i.value <= p.maxValuePerTx, "value too high");
        uint256 day = block.timestamp / 1 days;
        dailyVolume[id][day] += i.value;
        require(dailyVolume[id][day] <= p.maxDailyVolume, "daily cap");
        if (p.snapshotMaxAge != 0) {
            require(attestor.freshSnapshot(id, p.snapshotMaxAge), "stale snapshot");
        }
    }

    function _exec(uint256 id, Intent calldata i) internal {
        IERC6551Executable(walletOf(id)).execute(i.target, i.value, i.callData, 0);
    }

    function _inAllowed(address[] storage a, address t) internal view returns (bool) {
        for (uint256 k = 0; k < a.length; k++) if (a[k] == t) return true;
        return false;
    }
}
