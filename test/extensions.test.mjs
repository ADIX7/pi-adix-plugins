import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJiti } from 'jiti';
import jjPowerbar from '../packages/jj-powerbar/jj-powerbar.ts';
import contextExtra from '../packages/powerbar-context-extra/powerbar-context-extra.ts';

function createHarness(initialTools = []) {
  const hooks = new Map();
  const commands = new Map();
  const updates = [];
  let tools = initialTools;
  return {
    hooks, commands, updates,
    pi: {
      on: (name, handler) => hooks.set(name, handler),
      registerCommand: (name, { handler }) => commands.set(name, handler),
      registerFlag() {},
      registerShortcut() {},
      getActiveTools: () => tools,
      setActiveTools: (names) => { tools = names; },
      events: { emit: (name, data) => { if (name === 'powerbar:update') updates.push(data); } },
    },
    ctx: {
      hasUI: true,
      ui: { setStatus() {}, notify() {}, theme: { fg: (_color, text) => text } },
    },
  };
}

test('shows jj change and bookmark, then falls back to the Git branch', async () => {
  const { pi, ctx, hooks, updates } = createHarness();
  let inJj = true;
  pi.exec = async (command, args) => {
    if (command === 'jj') {
      if (!inJj) return { code: 1, stdout: '' };
      return { code: 0, stdout: args.includes('closest_bookmark(@)') ? 'main' : 'abcdef' };
    }
    return { code: 0, stdout: args[0] === 'symbolic-ref' ? 'feature' : 'true' };
  };
  jjPowerbar(pi);
  await hooks.get('session_start')({}, ctx);
  assert.equal(updates.at(-1).text, 'ab • main');
  inJj = false;
  await hooks.get('turn_end')({}, ctx);
  assert.match(updates.at(-1).text, /feature$/);
});

test('updates and resets the context usage segment', async () => {
  const { pi, ctx, hooks, updates } = createHarness();
  ctx.getContextUsage = () => ({ tokens: 7200, contextWindow: 8000 });
  contextExtra(pi);
  await hooks.get('turn_end')({}, ctx);
  assert.deepEqual(updates.at(-1), {
    id: 'context-usage-extra', text: '', suffix: '90% 󰛡 7,200 / 8k', bar: 90, color: 'error',
  });
  await hooks.get('session_start')({}, ctx);
  assert.deepEqual(updates.at(-1), { id: 'context-usage-extra', text: undefined });
});

test('both plan commands filter tools and restore the previous list', async () => {
  const jiti = createJiti(import.meta.url);
  const planMode = await jiti.import('../packages/pi-plan-custom/index.ts', { default: true });
  const initialTools = ['read', 'bash', 'edit', 'write', 'custom'];
  const { pi, ctx, commands } = createHarness(initialTools);
  planMode(pi);
  for (const [command, expected] of [
    ['plan', ['read', 'bash', 'custom']],
    ['plan-strict', ['read', 'bash']],
  ]) {
    await commands.get(command)('', ctx);
    assert.deepEqual(pi.getActiveTools(), expected);
    await commands.get(command)('', ctx);
    assert.deepEqual(pi.getActiveTools(), initialTools);
  }
});
