// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import "openzeppelin-contracts/contracts/utils/introspection/IERC165.sol";
import "openzeppelin-contracts/contracts/interfaces/IERC1271.sol";
import "openzeppelin-contracts/contracts/token/ERC721/IERC721Receiver.sol";
import "openzeppelin-contracts/contracts/token/ERC1155/IERC1155Receiver.sol";
import "./interfaces/IERC6551Account.sol";

contract ERC6551Account is IERC6551Account, IERC6551Executable, IERC165, IERC1271, IERC721Receiver, IERC1155Receiver {
    uint256 private _nonce;

    receive() external payable override {}

    function state() external view returns (uint256) { return _nonce; }

    function token() public view returns (uint256 chainId, address tokenContract, uint256 tokenId) {
        bytes memory footer = new bytes(0x60);
        assembly { extcodecopy(address(), add(footer, 0x20), 0x4d, 0x60) }
        return abi.decode(footer, (uint256, address, uint256));
    }

    function owner() public view returns (address) {
        (uint256 chainId, address tc, uint256 id) = token();
        if (chainId != block.chainid) return address(0);
        return IERC721(tc).ownerOf(id);
    }

    function isValidSigner(address signer, bytes calldata) external view returns (bytes4) {
        return _isAuthorizedCaller(signer) ? IERC6551Account.isValidSigner.selector : bytes4(0);
    }

    function isValidSignature(bytes32, bytes memory) external pure returns (bytes4) {
        return 0xffffffff;
    }

    function execute(address to, uint256 value, bytes calldata data, uint8 operation)
        external payable returns (bytes memory result)
    {
        require(_isAuthorizedCaller(msg.sender), "not authorized");
        require(operation == 0, "only call");
        ++_nonce;
        bool ok;
        (ok, result) = to.call{value: value}(data);
        require(ok, _bubble(result));
    }

    function _isAuthorizedCaller(address sender) internal view returns (bool) {
        address o = owner();
        if (o == address(0)) return false;
        if (sender == o) return true;
        (, address tc, uint256 tid) = token();
        if (IERC721(tc).isApprovedForAll(o, sender)) return true;
        if (IERC721(tc).getApproved(tid) == sender) return true;
        return false;
    }

    function _bubble(bytes memory result) private pure returns (string memory) {
        if (result.length < 4) return "exec failed";
        assembly { result := add(result, 0x04) }
        return abi.decode(result, (string));
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external pure returns (bytes4)
    {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 i) external pure returns (bool) {
        return i == type(IERC165).interfaceId
            || i == type(IERC6551Account).interfaceId
            || i == type(IERC6551Executable).interfaceId
            || i == type(IERC1271).interfaceId
            || i == type(IERC721Receiver).interfaceId
            || i == type(IERC1155Receiver).interfaceId;
    }
}
