const crypto = require('crypto');
require('dotenv').config();

const db = require('./db');

const LOCK_TTL_MS = Number(process.env.LOCK_TTL_MS || 30000);
const LOCK_RETRY_MS = Number(process.env.LOCK_RETRY_MS || 50);
const LOCK_TIMEOUT_MS = Number(process.env.LOCK_TIMEOUT_MS || 5000);

db.exec(`
CREATE TABLE IF NOT EXISTS distributed_locks (
  lock_key TEXT PRIMARY KEY,
  holder TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class DistributedLockManager {
  constructor() {
    this.cleanupStmt = db.prepare('DELETE FROM distributed_locks WHERE expires_at <= ?');
    this.insertStmt = db.prepare(`
      INSERT INTO distributed_locks(lock_key, holder, expires_at)
      VALUES (?, ?, ?)
    `);
    this.releaseStmt = db.prepare('DELETE FROM distributed_locks WHERE lock_key = ? AND holder = ?');
    this.tryAcquireTxn = db.transaction((lockKey, holder, nowMs, ttlMs) => {
      this.cleanupStmt.run(nowMs);
      this.insertStmt.run(lockKey, holder, nowMs + ttlMs);
    });
  }

  async acquire(lockKey) {
    const holder = crypto.randomUUID();
    const deadline = Date.now() + LOCK_TIMEOUT_MS;

    while (Date.now() < deadline) {
      try {
        this.tryAcquireTxn(lockKey, holder, Date.now(), LOCK_TTL_MS);
        return () => this.release(lockKey, holder);
      } catch (err) {
        if (!String(err.message || '').includes('UNIQUE constraint failed')) throw err;
      }
      await delay(LOCK_RETRY_MS);
    }

    throw new Error(`Timeout al adquirir lock distribuido: ${lockKey}`);
  }

  release(lockKey, holder) {
    this.releaseStmt.run(lockKey, holder);
  }
}

module.exports = new DistributedLockManager();
