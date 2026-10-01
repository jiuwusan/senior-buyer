const DEFAULT_LOGIN_INTERVAL_MS = 5000;

class LoginLimiter {
  constructor({
    intervalMs = DEFAULT_LOGIN_INTERVAL_MS,
    now = () => Date.now(),
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
  } = {}) {
    this.intervalMs = intervalMs;
    this.now = now;
    this.sleep = sleep;
    this.lastStartedAt = null;
    this.pending = Promise.resolve();
  }

  run(work) {
    const attempt = this.pending.then(async () => {
      if (this.lastStartedAt !== null) {
        const waitMs = this.lastStartedAt + this.intervalMs - this.now();
        if (waitMs > 0) await this.sleep(waitMs);
      }
      this.lastStartedAt = this.now();
      return await work();
    });
    this.pending = attempt.catch(() => {});
    return attempt;
  }
}

const configuredInterval = Number(process.env.WEIDIAN_LOGIN_INTERVAL_MS);
const loginLimiter = new LoginLimiter({
  intervalMs: process.env.WEIDIAN_LOGIN_INTERVAL_MS !== undefined &&
    Number.isSafeInteger(configuredInterval) && configuredInterval >= 0
    ? configuredInterval
    : DEFAULT_LOGIN_INTERVAL_MS
});

module.exports = { LoginLimiter, loginLimiter };
