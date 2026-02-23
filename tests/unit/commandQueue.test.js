const CommandQueue = require('../../src/commandQueue');

describe('CommandQueue', () => {
  let queue;

  beforeEach(() => {
    queue = new CommandQueue();
  });

  afterEach(() => {
    // Clean up any pending operations
    queue.clear();
  });

  describe('Basic Operations', () => {
    test('should execute a single command', async () => {
      const mockFn = jest.fn(async () => 'result');
      const result = await queue.enqueue(mockFn, { name: 'test-command' });

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(result).toBe('result');
    });

    test('should execute multiple commands sequentially', async () => {
      const executionOrder = [];

      const cmd1 = jest.fn(async () => {
        executionOrder.push(1);
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'cmd1';
      });

      const cmd2 = jest.fn(async () => {
        executionOrder.push(2);
        await new Promise(resolve => setTimeout(resolve, 30));
        return 'cmd2';
      });

      const cmd3 = jest.fn(async () => {
        executionOrder.push(3);
        return 'cmd3';
      });

      // Enqueue all commands
      const promise1 = queue.enqueue(cmd1, { name: 'cmd1' });
      const promise2 = queue.enqueue(cmd2, { name: 'cmd2' });
      const promise3 = queue.enqueue(cmd3, { name: 'cmd3' });

      // Wait for all to complete
      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

      // Verify results
      expect(result1).toBe('cmd1');
      expect(result2).toBe('cmd2');
      expect(result3).toBe('cmd3');

      // Verify execution order (commands should execute in FIFO order)
      expect(executionOrder).toEqual([1, 2, 3]);
      expect(cmd1).toHaveBeenCalledTimes(1);
      expect(cmd2).toHaveBeenCalledTimes(1);
      expect(cmd3).toHaveBeenCalledTimes(1);
    });

    test('should handle command errors gracefully', async () => {
      const errorMsg = 'Command failed';
      const failingCmd = jest.fn(async () => {
        throw new Error(errorMsg);
      });

      const successCmd = jest.fn(async () => 'success');

      // First command fails
      const failPromise = queue.enqueue(failingCmd, { name: 'failing-cmd' });

      // Second command should still execute
      const successPromise = queue.enqueue(successCmd, { name: 'success-cmd' });

      // Verify first command failed
      await expect(failPromise).rejects.toThrow(errorMsg);

      // Verify second command succeeded
      const result = await successPromise;
      expect(result).toBe('success');

      expect(failingCmd).toHaveBeenCalledTimes(1);
      expect(successCmd).toHaveBeenCalledTimes(1);
    });
  });

  describe('Timeout Handling', () => {
    test('should timeout commands that exceed timeout limit', async () => {
      let resolveSlowCmd;
      const slowCmd = jest.fn(async () => {
        await new Promise(resolve => { resolveSlowCmd = resolve; });
        return 'too-slow';
      });

      const promise = queue.enqueue(slowCmd, {
        name: 'slow-cmd',
        timeout: 100 // 100ms timeout
      });

      await expect(promise).rejects.toThrow('Command timeout after 100ms');
      expect(slowCmd).toHaveBeenCalledTimes(1);

      // Clean up the dangling promise to avoid open handles
      resolveSlowCmd();
    });

    test('should use default timeout when not specified', async () => {
      const fastCmd = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'fast';
      });

      const result = await queue.enqueue(fastCmd, { name: 'fast-cmd' });
      expect(result).toBe('fast');
    });
  });

  describe('Queue Status', () => {
    test('should report accurate queue status', async () => {
      // Initially empty
      let status = queue.getStatus();
      expect(status.isProcessing).toBe(false);
      expect(status.queueSize).toBe(0);
      expect(status.currentCommand).toBeNull();

      // Add a long-running command
      const longRunning = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'done';
      });

      const promise = queue.enqueue(longRunning, { name: 'long-running' });

      // Give it a moment to start processing
      await new Promise(resolve => setTimeout(resolve, 50));

      status = queue.getStatus();
      expect(status.isProcessing).toBe(true);
      expect(status.currentCommand).not.toBeNull();
      expect(status.currentCommand.name).toBe('long-running');

      // Wait for completion
      await promise;

      // Give queue time to update state after completion
      await new Promise(resolve => setTimeout(resolve, 10));

      status = queue.getStatus();
      expect(status.isProcessing).toBe(false);
      expect(status.queueSize).toBe(0);
    });

    test('should show pending commands in status', async () => {
      const blockingCmd = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'blocking';
      });

      const pendingCmd1 = jest.fn(async () => 'pending1');
      const pendingCmd2 = jest.fn(async () => 'pending2');

      // Enqueue blocking command first
      const promise1 = queue.enqueue(blockingCmd, { name: 'blocker' });
      const promise2 = queue.enqueue(pendingCmd1, { name: 'pending-1' });
      const promise3 = queue.enqueue(pendingCmd2, { name: 'pending-2' });

      // Give first command time to start
      await new Promise(resolve => setTimeout(resolve, 20));

      const status = queue.getStatus();
      expect(status.queueSize).toBe(2);
      expect(status.pendingCommands).toHaveLength(2);
      expect(status.pendingCommands[0].name).toBe('pending-1');
      expect(status.pendingCommands[1].name).toBe('pending-2');

      // Wait for all to complete
      await Promise.all([promise1, promise2, promise3]);
    });

    test('should track statistics correctly', async () => {
      const cmd1 = jest.fn(async () => 'success1');
      const cmd2 = jest.fn(async () => { throw new Error('fail'); });
      const cmd3 = jest.fn(async () => 'success2');

      // Enqueue all commands and wait for them to complete
      const p1 = queue.enqueue(cmd1, { name: 'cmd1' });

      let p2Failed = false;
      const p2 = queue.enqueue(cmd2, { name: 'cmd2' }).catch(() => {
        p2Failed = true;
      });

      const p3 = queue.enqueue(cmd3, { name: 'cmd3' });

      // Wait for all commands to complete
      await Promise.all([p1, p2, p3]);

      // Give event loop time to finish processing queue shutdown
      // (the queue uses setImmediate to process next command after completion)
      await new Promise(resolve => setTimeout(resolve, 20));

      // Verify all executed
      expect(p2Failed).toBe(true);

      const status = queue.getStatus();
      expect(status.stats.totalProcessed).toBe(2); // only successful commands
      expect(status.stats.totalErrors).toBe(1);
    });
  });

  describe('Queue Clearing', () => {
    test('should clear pending commands', async () => {
      const blockingCmd = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'blocking';
      });

      const pendingCmd1 = jest.fn(async () => 'pending1');
      const pendingCmd2 = jest.fn(async () => 'pending2');

      // Enqueue commands
      const promise1 = queue.enqueue(blockingCmd, { name: 'blocker' });
      const promise2 = queue.enqueue(pendingCmd1, { name: 'pending-1' });
      const promise3 = queue.enqueue(pendingCmd2, { name: 'pending-2' });

      // Attach rejection handlers before clear() to avoid unhandled rejection
      const rejection2 = promise2.catch(e => e);
      const rejection3 = promise3.catch(e => e);

      // Give first command time to start
      await new Promise(resolve => setTimeout(resolve, 20));

      // Clear the queue (should reject pending commands)
      const clearedCount = queue.clear();
      expect(clearedCount).toBe(2);

      // Blocking command should still complete
      await expect(promise1).resolves.toBe('blocking');

      // Pending commands should be rejected
      const err2 = await rejection2;
      const err3 = await rejection3;
      expect(err2).toBeInstanceOf(Error);
      expect(err2.message).toBe('Queue cleared');
      expect(err3).toBeInstanceOf(Error);
      expect(err3.message).toBe('Queue cleared');

      // Verify only the blocking command executed
      expect(blockingCmd).toHaveBeenCalledTimes(1);
      expect(pendingCmd1).not.toHaveBeenCalled();
      expect(pendingCmd2).not.toHaveBeenCalled();
    });
  });

  describe('Concurrent Enqueuing', () => {
    test('should handle rapid concurrent enqueuing', async () => {
      const executionOrder = [];

      // Create 10 commands that will be enqueued simultaneously
      const promises = Array.from({ length: 10 }, (_, i) => {
        const cmd = jest.fn(async () => {
          executionOrder.push(i);
          await new Promise(resolve => setTimeout(resolve, 10));
          return `result-${i}`;
        });

        return queue.enqueue(cmd, { name: `cmd-${i}` });
      });

      // Wait for all to complete
      const results = await Promise.all(promises);

      // Verify all commands executed in FIFO order
      expect(executionOrder).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(results).toEqual([
        'result-0', 'result-1', 'result-2', 'result-3', 'result-4',
        'result-5', 'result-6', 'result-7', 'result-8', 'result-9'
      ]);
    });
  });
});
