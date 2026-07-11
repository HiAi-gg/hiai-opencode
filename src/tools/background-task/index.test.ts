/**
 * background-task/index.test.ts — Tests for background task tools.
 */

import { describe, expect, test } from 'bun:test';
import type { BackgroundManager, BackgroundTask } from '../../features/background-manager/index';
import {
  backgroundOutputTool,
  backgroundCancelTool,
  setBackgroundManager,
} from './index';

function makeMockManager(tasks: Record<string, Partial<BackgroundTask>>): BackgroundManager {
  return {
    getTask: (id: string) => {
      const t = tasks[id];
      if (!t) return undefined;
      return {
        id,
        sessionID: t.sessionID ?? '',
        parentSessionID: t.parentSessionID ?? '',
        status: (t.status ?? 'running') as BackgroundTask['status'],
        description: t.description ?? '',
        result: t.result,
        error: t.error,
        createdAt: t.createdAt ?? Date.now(),
      } as BackgroundTask;
    },
    cancel: (id: string) => {
      const t = tasks[id];
      if (t) {
        t.status = 'cancelled' as BackgroundTask['status'];
        return true;
      }
      return false;
    },
  } as any;
}

function resetManager() {
  setBackgroundManager(null as any);
}

describe('backgroundOutputTool', () => {
  test('returns not-initialized error when manager is null', async () => {
    resetManager();
    const result = await backgroundOutputTool.execute({ task_id: 't1' });
    expect(result.output).toContain('not initialized');
  });

  test('returns output for completed task', async () => {
    const mgr = makeMockManager({
      t1: { status: 'completed', result: 'Task finished successfully' },
    });
    setBackgroundManager(mgr);

    const result = await backgroundOutputTool.execute({ task_id: 't1' });
    expect(result.title).toContain('completed');
    expect(result.output).toContain('Task finished successfully');
  });

  test('returns error info for failed task', async () => {
    const mgr = makeMockManager({
      t2: { status: 'error', error: 'Something broke' },
    });
    setBackgroundManager(mgr);

    const result = await backgroundOutputTool.execute({ task_id: 't2' });
    expect(result.title).toContain('failed');
    expect(result.output).toContain('Something broke');
  });

  test('returns cancelled info', async () => {
    const mgr = makeMockManager({
      t3: { status: 'cancelled' },
    });
    setBackgroundManager(mgr);

    const result = await backgroundOutputTool.execute({ task_id: 't3' });
    expect(result.title).toContain('cancelled');
  });

  test('returns running status for active task', async () => {
    const mgr = makeMockManager({
      t4: { status: 'running' },
    });
    setBackgroundManager(mgr);

    const result = await backgroundOutputTool.execute({ task_id: 't4' });
    expect(result.title).toContain('running');
  });

  test('returns not-found for unknown task', async () => {
    const mgr = makeMockManager({});
    setBackgroundManager(mgr);

    const result = await backgroundOutputTool.execute({ task_id: 'nonexistent' });
    expect(result.title).toContain('not found');
  });

  test('handles case when getTask throws', async () => {
    const throwingMgr = {
      getTask: () => {
        throw new Error('internal error');
      },
    };
    setBackgroundManager(throwingMgr as any);

    const result = await backgroundOutputTool.execute({ task_id: 't1' });
    expect(result.title).toBe('Error');
    expect(result.output).toContain('Failed to get task');
  });
});

describe('backgroundCancelTool', () => {
  test('returns not-initialized error when manager is null', async () => {
    resetManager();
    const result = await backgroundCancelTool.execute({ task_id: 't1' });
    expect(result.output).toContain('not initialized');
  });

  test('cancels an existing task', async () => {
    const tasks: Record<string, any> = {
      t1: { status: 'running' },
    };
    const mgr = makeMockManager(tasks);
    setBackgroundManager(mgr);

    const result = await backgroundCancelTool.execute({ task_id: 't1' });
    expect(result.title).toContain('cancelled');
  });

  test('returns not-found for nonexistent task', async () => {
    const mgr = makeMockManager({});
    setBackgroundManager(mgr);

    const result = await backgroundCancelTool.execute({ task_id: 'ghost' });
    expect(result.title).toContain('not found');
  });

  test('handles cancel throwing', async () => {
    const throwingMgr = {
      getTask: () => null,
      cancel: () => {
        throw new Error('db error');
      },
    };
    setBackgroundManager(throwingMgr as any);

    const result = await backgroundCancelTool.execute({ task_id: 't1' });
    expect(result.title).toBe('Error');
  });
});
