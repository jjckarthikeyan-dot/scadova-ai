async (page) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  page.on('dialog', dialog => dialog.accept());
  const failures = [];
  page.on('pageerror', e => failures.push(e.message));
  const writes = [];
  let rejectSave = true;
  const tools = [], sources = [];
  await page.route('**/admin/fish/**', async route => {
    const req = route.request(), path = req.url().replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    if (req.method() === 'GET') {
      if (path.endsWith('/tools')) return route.fulfill({ json: tools });
      if (path.endsWith('/knowledge')) return route.fulfill({ json: sources });
      return route.continue();
    }
    const body = req.postDataJSON();
    writes.push({ path, method: req.method(), body });
    if (path.endsWith('/config') && rejectSave) {
      rejectSave = false;
      return route.fulfill({ status: 502, json: { detail: 'Verification: provider unavailable' } });
    }
    if (path.endsWith('/tools')) {
      const tool = { ...body, tool_id: 'qa-tool' }; tools.push(tool);
      return route.fulfill({ json: tool });
    }
    if (path.endsWith('/knowledge')) {
      const source = { ...body, knowledge_source_id: 'qa-source', file_name: 'faq.md', size_bytes: 32 }; sources.push(source);
      return route.fulfill({ json: source });
    }
    return route.fulfill({ json: { config_hash: 'qa-draft' } });
  });
  try {
    await page.goto('http://127.0.0.1:5173/agent-workspace');
    await page.getByRole('textbox', { name: 'System prompt', exact: true }).waitFor();
    await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('te');
    if (!(await page.getByRole('button', { name: 'Publish', exact: true }).isDisabled())) throw Error('Publish enabled before save');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await page.getByRole('alert').filter({ hasText: 'Verification: provider unavailable' }).waitFor();
    if (await page.getByRole('button', { name: 'Save draft' }).isDisabled()) throw Error('Failed save lost pending changes');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await page.getByRole('status').filter({ hasText: 'Draft saved' }).waitFor();
    if (JSON.stringify(writes[1].body) !== JSON.stringify({ voice: { speaking_language: 'te' } })) throw Error('Save included unrelated fields');
    await page.getByRole('button', { name: 'Tools', exact: true }).click();
    await page.getByRole('button', { name: 'Add tool', exact: true }).click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('lookup_order');
    await page.getByRole('textbox', { name: 'Endpoint URL', exact: true }).fill('https://example.com/orders');
    await page.getByRole('button', { name: 'Create tool', exact: true }).click();
    await page.getByText('Attached', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Save draft' }).click();
    await page.getByRole('status').filter({ hasText: 'Draft saved' }).waitFor();
    if (!writes.at(-1).body.tools.tool_ids.includes('qa-tool')) throw Error('Tool not attached');
    await page.getByRole('button', { name: 'Knowledge base', exact: true }).click();
    await page.getByRole('button', { name: 'Add source', exact: true }).click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('FAQ');
    await page.getByRole('textbox', { name: 'Content', exact: true }).fill('Our hours are Monday through Friday.');
    await page.getByRole('button', { name: 'Create source', exact: true }).click();
    await page.getByText('Attached', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Save draft' }).click();
    await page.getByRole('status').filter({ hasText: 'Draft saved' }).waitFor();
    if (!writes.at(-1).body.knowledge_base.knowledge_source_ids.includes('qa-source')) throw Error('Source not attached');
    await page.getByRole('button', { name: 'Analytics', exact: true }).click();
    await page.getByRole('textbox', { name: 'Summary instructions', exact: true }).fill('Summarize the booking outcome.');
    await page.getByRole('button', { name: 'Add field', exact: true }).click();
    await page.getByRole('textbox', { name: 'Data fields name 1', exact: true }).fill('booking_outcome');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await page.getByRole('status').filter({ hasText: 'Draft saved' }).waitFor();
    if (writes.at(-1).body.analysis.data_fields[0].name !== 'booking_outcome') throw Error('Analysis field not saved');
    for (const tab of ['Conversations', 'Analytics', 'Settings', 'Configuration']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
    }
    await page.getByRole('button', { name: 'Choose voice', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Default voice', exact: true }).click();
    await page.getByRole('dialog').getByText('Marlowe', { exact: true }).waitFor();
    await page.getByRole('dialog').locator('img').first().evaluate(img => img.decode());
    await page.getByRole('dialog').locator('audio').first().evaluate(async audio => { await audio.play(); audio.pause(); });
    for (const [width, height, name] of [[1440, 1000, 'voices-desktop'], [390, 844, 'voices-mobile']]) {
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: `output/playwright/${name}.png` });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (overflow) throw Error(`Page overflows at ${width}px`);
    }
    await page.getByRole('button', { name: 'Close voice picker' }).click();
    await page.screenshot({ path: 'output/playwright/workspace-mobile.png' });
    if (failures.length) throw Error(failures.join('; '));
    return { result: 'PASS', checks: 'failed-save recovery, draft patches, tools, knowledge attachment, analysis fields, navigation, default voice image/audio, desktop/mobile layout', writes: 'All mocked; no live changes' };
  } finally {
    await page.unroute('**/admin/fish/**');
    await page.goto('http://127.0.0.1:5173/agent-workspace');
  }
}
