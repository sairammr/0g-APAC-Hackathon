// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IERC6551Registry.sol";

contract ERC6551Registry is IERC6551Registry {
    error AccountCreationFailed();

    function createAccount(
        address impl, bytes32 salt, uint256 chainId, address tc, uint256 tid
    ) external returns (address) {
        bytes memory code = _creationCode(impl, salt, chainId, tc, tid);
        address acct = _computeAddress(code, salt);
        if (acct.code.length != 0) return acct;
        assembly {
            acct := create2(0, add(code, 0x20), mload(code), salt)
        }
        if (acct == address(0)) revert AccountCreationFailed();
        emit ERC6551AccountCreated(acct, impl, salt, chainId, tc, tid);
        return acct;
    }

    function account(
        address impl, bytes32 salt, uint256 chainId, address tc, uint256 tid
    ) external view returns (address) {
        return _computeAddress(_creationCode(impl, salt, chainId, tc, tid), salt);
    }

    function _creationCode(address impl, bytes32 salt, uint256 chainId, address tc, uint256 tid)
        internal pure returns (bytes memory)
    {
        return abi.encodePacked(
            hex"3d60ad80600a3d3981f3363d3d373d3d3d363d73",
            impl,
            hex"5af43d82803e903d91602b57fd5bf3",
            abi.encode(salt, chainId, tc, tid)
        );
    }

    function _computeAddress(bytes memory code, bytes32 salt) internal view returns (address) {
        bytes32 h = keccak256(abi.encodePacked(
            bytes1(0xff), address(this), salt, keccak256(code)
        ));
        return address(uint160(uint256(h)));
    }
}
