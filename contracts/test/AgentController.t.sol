// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/iNFT2.sol";
import "../src/BrainKeyRegistry.sol";
import "../src/AgentController.sol";
import "../src/SnapshotAttestor.sol";
import "../src/ERC6551Account.sol";
import "../src/ERC6551Registry.sol";

contract MockSig {
    function isSigner(uint256, address) external pure returns (bool) { return true; }
    function getEpochNumber(uint256) external pure returns (uint256) { return 1; }
}

contract Target {
    uint256 public count;
    function ping() external payable { count++; }
}

contract AgentControllerTest is Test {
    iNFT2 inft;
    BrainKeyRegistry keys;
    AgentController ctrl;
    SnapshotAttestor att;
    ERC6551Registry reg;
    ERC6551Account impl;
    MockSig das;
    Target tgt;

    uint256 opPk = uint256(keccak256("operator"));
    address operator;
    address owner_ = address(0xA11CE);
    address relayer;

    function setUp() public {
        operator = vm.addr(opPk);
        relayer = address(this);
        das = new MockSig();
        // Predict iNFT2 address: nonces increment by 1 per deploy. keys is next (nonce N), inft is N+1.
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        keys = new BrainKeyRegistry(predicted);
        inft = new iNFT2(address(keys), address(0));
        require(address(inft) == predicted, "predict mismatch");
        impl = new ERC6551Account();
        reg  = new ERC6551Registry();
        att  = new SnapshotAttestor(relayer, address(das));
        ctrl = new AgentController(address(inft), address(reg), address(impl), address(att));
        tgt = new Target();

        vm.prank(owner_);
        uint256 id = inft.mint(owner_, keccak256("v1"), "0g://1", hex"04aa");

        vm.startPrank(owner_);
        ctrl.setOperator(id, operator);
        address[] memory targets = new address[](1);
        targets[0] = address(tgt);
        ctrl.setPolicy(id, AgentController.Policy({
            allowedTargets: targets, maxValuePerTx: 1 ether,
            maxDailyVolume: 10 ether, snapshotMaxAge: 0
        }));
        // Approve AgentController to act on this owner's NFTs so wallet.execute accepts it.
        inft.setApprovalForAll(address(ctrl), true);
        vm.stopPrank();

        // Pre-create the 6551 wallet so we can deposit
        reg.createAccount(address(impl), bytes32(0), block.chainid, address(inft), id);
        vm.deal(ctrl.walletOf(id), 100 ether);
    }

    function _signIntent(AgentController.Intent memory i) internal view returns (bytes memory) {
        bytes32 d = ctrl.intentDigest(i);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(opPk, d);
        return abi.encodePacked(r, s, v);
    }

    function test_executeIntent_callsTarget() public {
        AgentController.Intent memory i = AgentController.Intent({
            tokenId: 1, nonce: 0, target: address(tgt),
            value: 0.5 ether, callData: abi.encodeWithSignature("ping()"),
            expiry: uint64(block.timestamp + 60)
        });
        ctrl.executeIntent(i, _signIntent(i));
        assertEq(tgt.count(), 1);
    }

    function test_executeIntent_rejectsBadNonce() public {
        AgentController.Intent memory i;
        i.tokenId = 1; i.nonce = 99; i.target = address(tgt);
        i.expiry = uint64(block.timestamp + 60);
        bytes memory sig = _signIntent(i);
        vm.expectRevert("bad nonce");
        ctrl.executeIntent(i, sig);
    }

    function test_executeIntent_rejectsExpiry() public {
        AgentController.Intent memory i;
        i.tokenId = 1; i.nonce = 0; i.target = address(tgt);
        i.expiry = uint64(block.timestamp - 1);
        bytes memory sig = _signIntent(i);
        vm.expectRevert("expired");
        ctrl.executeIntent(i, sig);
    }

    function test_executeIntent_rejectsDeniedTarget() public {
        AgentController.Intent memory i;
        i.tokenId = 1; i.nonce = 0; i.target = address(0xCAFE);
        i.expiry = uint64(block.timestamp + 60);
        bytes memory sig = _signIntent(i);
        vm.expectRevert("target denied");
        ctrl.executeIntent(i, sig);
    }

    function test_executeIntent_enforcesDailyCap() public {
        AgentController.Intent memory i = AgentController.Intent({
            tokenId: 1, nonce: 0, target: address(tgt),
            value: 1 ether, callData: abi.encodeWithSignature("ping()"),
            expiry: uint64(block.timestamp + 60)
        });
        for (uint256 k = 0; k < 10; k++) {
            i.nonce = k;
            ctrl.executeIntent(i, _signIntent(i));
        }
        i.nonce = 10;
        bytes memory sig = _signIntent(i);
        vm.expectRevert("daily cap");
        ctrl.executeIntent(i, sig);
    }
}
