/**
 * CommandQueue - Serializes concurrent API calls to prevent conflicts
 *
 * Ensures that only one browser operation executes at a time by maintaining
 * a FIFO queue of commands. Each command is a promise-returning function that
 * will execute sequentially.
 *
 * Features:
 * - FIFO queue processing
 * - Automatic error handling and retry logic
 * - Queue status monitoring
 * - Configurable timeout per command
 */

class CommandQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.currentCommand = null;
    this.stats = {
      totalProcessed: 0,
      totalErrors: 0,
      currentQueueSize: 0
    };
  }

  /**
   * Enqueue a command for execution
   * @param {Function} commandFn - Async function that performs the browser operation
   * @param {Object} options - Command options
   * @param {number} options.timeout - Timeout in ms (default: 120000 / 2 minutes)
   * @param {string} options.name - Human-readable command name for logging
   * @returns {Promise} Resolves with command result or rejects with error
   */
  async enqueue(commandFn, options = {}) {
    const {
      timeout = 120000, // 2 minutes default
      name = 'unknown-command'
    } = options;

    return new Promise((resolve, reject) => {
      const command = {
        id: this._generateCommandId(),
        name,
        fn: commandFn,
        timeout,
        resolve,
        reject,
        enqueuedAt: Date.now()
      };

      this.queue.push(command);
      this.stats.currentQueueSize = this.queue.length;

      console.log(`[CommandQueue] Enqueued: ${name} (ID: ${command.id}), Queue size: ${this.queue.length}`);

      // Start processing if not already running
      if (!this.isProcessing) {
        this._processNext();
      }
    });
  }

  /**
   * Process the next command in the queue
   * @private
   */
  async _processNext() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      this.currentCommand = null;
      console.log('[CommandQueue] Queue empty, processing stopped');
      return;
    }

    this.isProcessing = true;
    const command = this.queue.shift();
    this.stats.currentQueueSize = this.queue.length;
    this.currentCommand = command;

    const startTime = Date.now();
    const waitTime = startTime - command.enqueuedAt;

    console.log(`[CommandQueue] Processing: ${command.name} (ID: ${command.id}), Wait time: ${waitTime}ms, Remaining in queue: ${this.queue.length}`);

    try {
      // Execute command with timeout
      const result = await this._executeWithTimeout(command.fn, command.timeout);

      const executionTime = Date.now() - startTime;
      console.log(`[CommandQueue] Completed: ${command.name} (ID: ${command.id}), Execution time: ${executionTime}ms`);

      this.stats.totalProcessed++;
      command.resolve(result);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`[CommandQueue] Failed: ${command.name} (ID: ${command.id}), Error: ${error.message}, Execution time: ${executionTime}ms`);

      this.stats.totalErrors++;
      command.reject(error);
    } finally {
      this.currentCommand = null;

      // Process next command
      setImmediate(() => this._processNext());
    }
  }

  /**
   * Execute a function with timeout
   * @private
   */
  async _executeWithTimeout(fn, timeoutMs) {
    let timeoutId;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Command timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      clearTimeout(timeoutId); // Clean up timeout if command completes first
      return result;
    } catch (error) {
      clearTimeout(timeoutId); // Clean up timeout on error
      throw error;
    }
  }

  /**
   * Generate unique command ID
   * @private
   */
  _generateCommandId() {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current queue status
   * @returns {Object} Queue status information
   */
  getStatus() {
    const now = Date.now();
    const queueSize = this.queue.length;

    return {
      isProcessing: this.isProcessing,
      queueSize,
      currentCommand: this.currentCommand ? {
        id: this.currentCommand.id,
        name: this.currentCommand.name,
        enqueuedAt: this.currentCommand.enqueuedAt,
        processingFor: now - this.currentCommand.enqueuedAt
      } : null,
      stats: {
        totalProcessed: this.stats.totalProcessed,
        totalErrors: this.stats.totalErrors,
        currentQueueSize: queueSize
      },
      pendingCommands: this.queue.map(cmd => ({
        id: cmd.id,
        name: cmd.name,
        enqueuedAt: cmd.enqueuedAt,
        waitingFor: now - cmd.enqueuedAt
      }))
    };
  }

  /**
   * Clear all pending commands in the queue
   * Note: Does NOT cancel the currently executing command
   * @returns {number} Number of commands cleared
   */
  clear() {
    const clearedCount = this.queue.length;

    // Reject all pending commands
    this.queue.forEach(command => {
      command.reject(new Error('Queue cleared'));
    });

    this.queue = [];
    this.stats.currentQueueSize = 0;

    console.log(`[CommandQueue] Cleared ${clearedCount} pending commands`);
    return clearedCount;
  }
}

module.exports = CommandQueue;
