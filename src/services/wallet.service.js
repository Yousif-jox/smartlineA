// src/services/wallet.service.js — business rules (Task 58/68)
// The HTTP idempotency contract (Task 58):
//  - first request with key K  -> executes, 201
//  - retry with same K         -> 200 with the ORIGINAL transaction
//  - insufficient balance      -> 409, ride/attendance unaffected
const repo = require('../repositories/wallet.repo');
const { ApiError } = require('../middleware/error');

async function charge(tenant, walletId, input, idempotencyKey) {
  const amount = Number(input?.amount);
  const tripId = input?.tripId;

  if (!idempotencyKey) throw new ApiError(422, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required');
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(422, 'VALIDATION_ERROR', 'amount must be a positive number');

  const wallet = await repo.findById(tenant, walletId);
  if (!wallet) throw new ApiError(404, 'NOT_FOUND', 'Wallet not found');

  const result = await repo.chargeWithLock(walletId, idempotencyKey, amount, tripId ?? null);

  switch (result.error) {
    case 'NOT_FOUND':
      throw new ApiError(404, 'NOT_FOUND', 'Wallet not found');
    case 'DUPLICATE': {
      // Task 58: same key -> original transaction, no duplicate
      const existing = await repo.findTransactionById(walletId, result.txId);
      return { transaction: existing, duplicate: true };
    }
    case 'INSUFFICIENT_BALANCE':
      throw new ApiError(409, 'INSUFFICIENT_BALANCE', `Balance ${result.balance} is insufficient for ${amount}`, result);
    default:
      return { transaction: result.transaction, duplicate: false };
  }
}

module.exports = { charge };
