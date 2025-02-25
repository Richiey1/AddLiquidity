// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

error NotAuthorized();
error TransactionNotFound();
error TransactionAlreadyExecuted();
error TimeLockNotExpired();
error AlreadyApproved();
error QuorumNotMet();
error TransferFailed();
error InvalidOwner();
error InvalidRecipient();
error InvalidAmount();
error InvalidQuorum();
contract MultiSigWallet is ReentrancyGuard {
    struct Transaction {
        uint256 id;
        uint256 amount;
        address creator;
        address recipient;
        uint256 approvalCount;
        uint256 timestamp;
        bool executed;
        bool isCompleted;
    }
    mapping(uint256 => Transaction) private transactions;
    mapping(address => bool) public isOwner;
    mapping(uint256 => mapping(address => bool)) private hasApproved;
    mapping(address => uint256) private ownerIndex;
    
    uint256 private txCount;
    uint8 private quorum;
    uint256 public timeLock = 1 days;
    address[] private owners;

    event OwnerAdded(address indexed owner);
    event OwnerRemoved(address indexed owner);
    event TransactionProposed(uint256 indexed txId, address indexed creator, uint256 amount, address recipient);
    event TransactionApproved(uint256 indexed txId, address indexed approver);
    event TransactionExecuted(uint256 indexed txId);
    event TransactionCancelled(uint256 indexed txId);
    event FundsDeposited(address indexed sender, uint256 amount);
    event QuorumChanged(uint8 newQuorum);
    event TimeLockChanged(uint256 newTimeLock);

    modifier onlyOwner() {
        if (!isOwner[msg.sender]) revert NotAuthorized();
        _;
    }
    modifier transactionExists(uint256 _txId) {
        if (transactions[_txId].id != _txId) revert TransactionNotFound();
        _;
    }
    modifier notExecuted(uint256 _txId) {
        if (transactions[_txId].executed) revert TransactionAlreadyExecuted();
        _;
    }
    modifier timeLockPassed(uint256 _txId) {
        if (block.timestamp < transactions[_txId].timestamp + timeLock) revert TimeLockNotExpired();
        _;
    }
    constructor(uint8 _quorum, address _owner) {
        if (_owner == address(0)) revert InvalidOwner();
        if (_quorum == 0) revert InvalidQuorum();
        
        quorum = _quorum;
        isOwner[_owner] = true;
        owners.push(_owner);
        ownerIndex[_owner] = 0;
    }
    receive() external payable {
        emit FundsDeposited(msg.sender, msg.value);
    }
    function isContractOwner(address _addr) external view returns (bool) {
        return isOwner[_addr];
    }
    function getQuorum() external view returns (uint8) {
        return quorum;
    }
    function getOwners() external view returns (address[] memory) {
        return owners;
    }
    function getTimeLock() external view returns (uint256) {
        return timeLock;
    }
    function getTransactionCount() external view returns (uint256) {
        return txCount;
    }
    function getTransaction(uint256 _txId) external view 
        returns (
            uint256 id,
            uint256 amount,
            address creator,
            address recipient,
            bool isCompleted,
            uint256 approvalCount,
            uint256 timestamp,
            bool executed
        ) 
    {
        Transaction storage txData = transactions[_txId];
        return (
            txData.id,
            txData.amount,
            txData.creator,
            txData.recipient,
            txData.isCompleted,
            txData.approvalCount,
            txData.timestamp,
            txData.executed
        );
    }
    function hasOwnerApproved(uint256 _txId, address _owner) external view returns (bool) {
        return hasApproved[_txId][_owner];
    }
    function addOwner(address _owner) external onlyOwner {
        if (_owner == address(0)) revert InvalidOwner();
        if (isOwner[_owner]) revert NotAuthorized();
        
        isOwner[_owner] = true;
        ownerIndex[_owner] = owners.length;
        owners.push(_owner);
        
        emit OwnerAdded(_owner);
    }
    function removeOwner(address _owner) external onlyOwner {
        if (!isOwner[_owner]) revert NotAuthorized();
        uint256 index = ownerIndex[_owner];
        uint256 lastIndex = owners.length - 1;
        
        if (index != lastIndex) {
            address lastOwner = owners[lastIndex];
            owners[index] = lastOwner;
            ownerIndex[lastOwner] = index;
        }
        owners.pop();
        isOwner[_owner] = false;
        delete ownerIndex[_owner];
        
        if (quorum > owners.length) {
            quorum = uint8(owners.length);
            emit QuorumChanged(quorum);
        }
        
        emit OwnerRemoved(_owner);
    }
    function changeQuorum(uint8 _newQuorum) external onlyOwner {
        if (_newQuorum == 0) revert InvalidQuorum();
        if (_newQuorum > owners.length) revert InvalidQuorum();
        
        quorum = _newQuorum;
        emit QuorumChanged(_newQuorum);
    }
    function changeTimeLock(uint256 _newTimeLock) external onlyOwner {
        timeLock = _newTimeLock;
        emit TimeLockChanged(_newTimeLock);
    }
    function depositFunds() external payable {
        if (msg.value == 0) revert InvalidAmount();
        emit FundsDeposited(msg.sender, msg.value);
    }
    function proposeTransaction(address _recipient, uint256 _amount) external onlyOwner {
        if (_recipient == address(0)) revert InvalidRecipient();
        if (_amount == 0) revert InvalidAmount();
        
        uint256 _txId = txCount++;
        transactions[_txId] = Transaction({
            id: _txId,
            amount: _amount,
            creator: msg.sender,
            recipient: _recipient,
            isCompleted: false,
            approvalCount: 1,
            timestamp: block.timestamp,
            executed: false
        });
        
        hasApproved[_txId][msg.sender] = true;
        emit TransactionProposed(_txId, msg.sender, _amount, _recipient);
    }
    function approveTransaction(uint256 _txId) external onlyOwner transactionExists(_txId) notExecuted(_txId) {
        if (hasApproved[_txId][msg.sender]) revert AlreadyApproved();
        
        transactions[_txId].approvalCount++;
        hasApproved[_txId][msg.sender] = true;
        
        emit TransactionApproved(_txId, msg.sender);
    }
    function executeTransaction(uint256 _txId) external nonReentrant onlyOwner transactionExists(_txId) notExecuted(_txId) timeLockPassed(_txId) {
        Transaction storage txData = transactions[_txId];
        
        if (txData.approvalCount < quorum) revert QuorumNotMet();
        if (address(this).balance < txData.amount) revert InvalidAmount();
        
        txData.executed = true;
        
        (bool success, ) = txData.recipient.call{value: txData.amount}("");
        if (!success) revert TransferFailed();
        
        emit TransactionExecuted(_txId);
    }
    function cancelTransaction(uint256 _txId) external onlyOwner transactionExists(_txId) notExecuted(_txId) {
        if (msg.sender != transactions[_txId].creator && 
            block.timestamp < transactions[_txId].timestamp + 30 days) {
            revert NotAuthorized();
        }
        
        delete transactions[_txId];
        emit TransactionCancelled(_txId);
    }
}