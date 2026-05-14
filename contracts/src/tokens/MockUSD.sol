// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-contracts/contracts/access/Ownable.sol";

contract MockUSD is ERC20, Ownable {
    constructor() ERC20("Demo USD", "dUSD") {
        _mint(msg.sender, 10_000_000 * 1e18);
    }
    function mint(address to, uint256 amt) external onlyOwner { _mint(to, amt); }
    function decimals() public pure override returns (uint8) { return 18; }
}
