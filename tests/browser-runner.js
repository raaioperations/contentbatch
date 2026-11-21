import { runMilestone3BrowserScenarios } from './browser-milestone3.js';

const frame = document.querySelector('#app-frame');
const output = document.querySelector('#results');
const checks = [];
const browserErrors = [];

function delay(ms = 40) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function waitFor(predicate, message, timeout = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (predicate()) return;
    } catch {}
    await delay(40);
  }
  throw new Error(`Timed out waiting for ${message}.`);
}

async function waitForAsync(predicate, message, timeout = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await predicate()) return;
    } catch {}
    await delay(40);
  }
  throw new Error(`Timed out waiting for ${message}.`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function contrastRatio(foreground, background) {
  const luminance = color => {
    const [red, green, blue] = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const light = luminance(foreground);
  const dark = luminance(background);
  return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
}

function appDocument() {
  return frame.contentDocument;
}

function installConsoleCapture() {
  const child = frame.contentWindow;
  child.addEventListener('error', event => browserErrors.push(event.message || 'Uncaught browser error'));
  child.addEventListener('unhandledrejection', event => browserErrors.push(String(event.reason?.message ?? event.reason ?? 'Unhandled promise rejection')));
  const originalError = child.console.error.bind(child.console);
  child.console.error = (...args) => {
    browserErrors.push(args.map(value => typeof value === 'string' ? value : String(value)).join(' '));
    originalError(...args);
  };
}

async function report(name, task) {
  await task();
  checks.push(`PASS  ${name}`);
  output.textContent = checks.join('\n');
}

async function readItems() {
  return readStore('contentItems');
}

async function readBatches() {
  return readStore('batches');
}

async function readTemplates() {
  return readStore('templates');
}

async function readStore(storeName) {
  const childWindow = frame.contentWindow;
  const openRequest = childWindow.indexedDB.open('contentbatch', 1);
  const database = await new Promise((resolve, reject) => {
    openRequest.onsuccess = () => resolve(openRequest.result);
    openRequest.onerror = () => reject(openRequest.error);
  });
  const transaction = database.transaction(storeName, 'readonly');
  const request = transaction.objectStore(storeName).getAll();
  const items = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return items;
}

async function navigateTo(view) {
  appDocument().querySelector(`.nav-link[data-view="${view}"]`).click();
  const selector = view === 'batches' ? '.batches-layout' : view === 'content' ? '.content-layout' : view === 'plan' ? '.plan-layout' : '#quick-capture-form';
  await waitFor(() => appDocument().querySelector(selector), `${view} view`);
}

async function createLibraryItem(title) {
  await navigateTo('content');
  appDocument().querySelector('[data-action="new-content"]').click();
  await waitFor(() => appDocument().querySelector('#new-content-dialog')?.open, 'New Content dialog');
  const input = appDocument().querySelector('#new-content-title-input');
  input.value = title;
  appDocument().querySelector('#new-content-form').requestSubmit();
  await waitFor(() => appDocument().querySelector('#editor-form') && appDocument().querySelector('#editor-title')?.value === title, `editor for ${title}`);
  const itemId = appDocument().querySelector('.editor-layout').dataset.editorId;
  await waitForAsync(async () => (await readItems()).some(item => item.id === itemId), `stored ${title}`);
  return itemId;
}

async function createContentInsideCurrentBatch(title) {
  const batchId = appDocument().querySelector('.batch-workspace')?.dataset.batchDetailId;
  assert(batchId, 'A Batch workspace is open before creating content.');
  appDocument().querySelector('[data-action="new-content"]').click();
  await waitFor(() => appDocument().querySelector('#new-content-dialog')?.open, 'New Content in Batch dialog');
  appDocument().querySelector('#new-content-title-input').value = title;
  appDocument().querySelector('#new-content-form').requestSubmit();
  await waitFor(() => appDocument().querySelector('#editor-form') && appDocument().querySelector('#editor-title')?.value === title, `editor for ${title}`);
  const itemId = appDocument().querySelector('.editor-layout').dataset.editorId;
  await waitForAsync(async () => (await readItems()).some(item => item.id === itemId && item.batchId === batchId), `stored ${title} in its Batch`);
  assert(appDocument().querySelector('[data-field="status"]').value === 'idea', 'New Batch content starts as an Idea.');
  appDocument().querySelector('[data-action="back-to-return"]').click();
  await waitFor(() => appDocument().querySelector('.batch-workspace'), 'return to Batch workspace');
  return itemId;
}

async function createBatchFromList(name, description = '') {
  await navigateTo('batches');
  appDocument().querySelector('[data-action="new-batch"]').click();
  await waitFor(() => appDocument().querySelector('#batch-dialog')?.open, 'New Batch dialog');
  appDocument().querySelector('#batch-name-input').value = name;
  appDocument().querySelector('#batch-description-input').value = description;
  appDocument().querySelector('#batch-form').requestSubmit();
  await waitFor(() => appDocument().querySelector('.batch-workspace'), `${name} workspace`);
  return appDocument().querySelector('.batch-workspace').dataset.batchDetailId;
}

async function openBatchByName(name) {
  await navigateTo('batches');
  const card = [...appDocument().querySelectorAll('[data-batch-card-id]')].find(node => node.querySelector('h3')?.textContent === name);
  assert(card, `Batch ${name} is present in the list.`);
  card.querySelector('[data-open-batch-id]').click();
  await waitFor(() => appDocument().querySelector('.batch-workspace'), `${name} workspace`);
}

async function setBatchItemStatus(itemId, status) {
  const selector = `[data-batch-status="${itemId}"]`;
  const control = appDocument().querySelector(selector);
  assert(control, `Batch status control exists for ${itemId}.`);
  control.value = status;
  control.dispatchEvent(new frame.contentWindow.Event('change', { bubbles: true }));
  await waitFor(() => appDocument().querySelector(selector)?.value === status, `Batch item ${itemId} status ${status}`);
  await waitForAsync(async () => (await readItems()).find(item => item.id === itemId)?.status === status, `stored Batch status ${status}`);
}

function setField(selector, value, eventName = 'input') {
  const control = appDocument().querySelector(selector);
  assert(control, `Missing control ${selector}`);
  control.value = value;
  control.dispatchEvent(new frame.contentWindow.Event(eventName, { bubbles: true }));
}

async function waitForSaved(itemId, expected) {
  await waitFor(() => {
    const status = appDocument().querySelector('#save-status')?.textContent;
    return status === 'Saved';
  }, 'editor save state');
  const items = await readItems();
  const item = items.find(record => record.id === itemId);
  assert(item, `Saved item ${itemId} exists in IndexedDB.`);
  for (const [key, value] of Object.entries(expected)) assert(JSON.stringify(item[key]) === JSON.stringify(value), `Saved ${key} matches the latest edit (expected ${JSON.stringify(value)}, got ${JSON.stringify(item[key])}).`);
  return item;
}

async function openContentEditor(itemId) {
  await navigateTo('content');
  const row = appDocument().querySelector(`[data-open-id="${itemId}"]`);
  assert(row, `Content row ${itemId} is available.`);
  row.click();
  await waitFor(() => appDocument().querySelector('#editor-form'), `editor for ${itemId}`);
}

async function setItemFields(itemId, fields) {
  await openContentEditor(itemId);
  for (const [field, value] of Object.entries(fields)) {
    const control = appDocument().querySelector(`[data-field="${field}"]`);
    assert(control, `Editor field ${field} exists.`);
    control.value = value;
    control.dispatchEvent(new frame.contentWindow.Event(['status', 'contentType', 'channel', 'batchId'].includes(field) ? 'change' : 'input', { bubbles: true }));
  }
  const expected = Object.fromEntries(Object.entries(fields).map(([field, value]) => [field, field === 'scheduledDate' ? value || null : field === 'tags' ? value.split(',').map(tag => tag.trim()).filter(Boolean).filter((tag, index, list) => list.findIndex(other => other.toLowerCase() === tag.toLowerCase()) === index) : value]));
  await waitForSaved(itemId, expected);
  appDocument().querySelector('[data-action="back-to-return"]').click();
  await waitFor(() => appDocument().querySelector('.content-layout'), 'Content list after field update');
}

async function runWorkflow() {
  await waitFor(() => appDocument()?.querySelector('#quick-capture-form') || appDocument()?.querySelector('.storage-error'), 'application startup', 45000);
  assert(!appDocument().querySelector('.storage-error'), appDocument().querySelector('.storage-error')?.textContent || 'Local storage opened.');

  await report('Home opens with Quick Capture and the four-destination shell', async () => {
    assert(appDocument().querySelector('#quick-capture-title'), 'Quick Capture is visible.');
    assert(appDocument().querySelectorAll('.mobile-nav-link').length === 4, 'Mobile navigation has four destinations.');
    assert(appDocument().querySelector('a.nav-link[data-view="plan"]'), 'Plan is an active semantic navigation link.');
    assert(appDocument().querySelector('a.nav-link[data-view="batches"]'), 'Batches is an active semantic navigation link.');
  });

  await report('Quick Capture creates a title-only Idea', async () => {
    const input = appDocument().querySelector('#quick-capture-title');
    input.value = 'Test Content Idea';
    appDocument().querySelector('#quick-capture-form').requestSubmit();
    await waitFor(() => [...appDocument().querySelectorAll('[data-open-id]')].some(row => row.textContent.includes('Test Content Idea')), 'captured idea in the recent list');
    const row = [...appDocument().querySelectorAll('[data-open-id]')].find(button => button.textContent.includes('Test Content Idea'));
    assert(row.querySelector('.status-badge')?.textContent === 'Idea', 'New content begins in Idea status.');
    window.testItemId = row.dataset.openId;
  });

  await report('Editor opens the captured item with accessible labeled fields', async () => {
    appDocument().querySelector(`[data-open-id="${window.testItemId}"]`).click();
    await waitFor(() => appDocument().querySelector('#editor-form'), 'content editor');
    assert(appDocument().querySelector('#editor-title').value === 'Test Content Idea', 'Captured title is present in the editor.');
    const controls = [...appDocument().querySelectorAll('#editor-form input, #editor-form textarea, .editor-sidebar select, .editor-sidebar input')].filter(control => !control.closest('[hidden]'));
    const unlabeled = controls.filter(control => !control.id || !appDocument().querySelector(`label[for="${control.id}"]`));
    assert(unlabeled.length === 0, `Every visible editor control has a label (${unlabeled.map(control => control.id).join(', ')}).`);
  });

  await report('Rapid edits autosave the latest title, hook, body, CTA and notes', async () => {
    setField('[data-field="title"]', 'Updated Test Content Idea');
    setField('[data-field="hook"]', 'Test Hook');
    setField('[data-field="body"]', 'Draft text');
    setField('[data-field="body"]', 'This is the test body.');
    setField('[data-field="cta"]', 'Test CTA');
    setField('[data-field="notes"]', 'Keep this opening concise.');
    assert(appDocument().querySelector('#save-status').textContent === 'Unsaved', 'Unsaved state appears immediately after edits.');
    await waitForSaved(window.testItemId, {
      title: 'Updated Test Content Idea',
      hook: 'Test Hook',
      body: 'This is the test body.',
      cta: 'Test CTA',
      notes: 'Keep this opening concise.'
    });
  });

  await report('A refresh preserves creative fields and the record remains editable', async () => {
    await new Promise(resolve => {
      frame.addEventListener('load', resolve, { once: true });
      frame.contentWindow.location.reload();
    });
    await waitFor(() => appDocument()?.querySelector('#quick-capture-form'), 'reloaded application startup');
    appDocument().querySelector('.nav-link[data-view="content"]').click();
    await waitFor(() => appDocument().querySelector(`[data-open-id="${window.testItemId}"]`), 'persisted content list item');
    appDocument().querySelector(`[data-open-id="${window.testItemId}"]`).click();
    await waitFor(() => appDocument().querySelector('#editor-form'), 'reopened editor');
    assert(appDocument().querySelector('[data-field="hook"]').value === 'Test Hook', 'Hook survives reload.');
    assert(appDocument().querySelector('[data-field="body"]').value === 'This is the test body.', 'Body survives reload.');
    assert(appDocument().querySelector('[data-field="cta"]').value === 'Test CTA', 'CTA survives reload.');
    assert(appDocument().querySelector('#editor-title').value === 'Updated Test Content Idea', 'Title survives reload.');
    assert(appDocument().querySelector('[data-field="notes"]').value === 'Keep this opening concise.', 'Notes survive reload.');
  });

  await report('Save failures remain visible, keep text in memory, and retry safely', async () => {
    setField('[data-field="title"]', '   ');
    await waitFor(() => appDocument().querySelector('#save-status')?.textContent.startsWith('Save failed:'), 'visible autosave failure');
    assert(appDocument().querySelector('#editor-title').value === '   ', 'Unsaved title text remains in the editor.');
    const retry = appDocument().querySelector('[data-action="retry-save"]');
    assert(retry && !retry.hidden, 'A retry action is available after failure.');
    retry.click();
    await waitFor(() => appDocument().querySelector('#save-status')?.textContent.startsWith('Save failed:'), 'truthful retry failure');
    appDocument().querySelector('.nav-link[data-view="home"]').click();
    await delay(120);
    assert(appDocument().querySelector('#editor-form'), 'Failed changes prevent navigation that could lose text.');
    setField('[data-field="title"]', 'Updated Test Content Idea');
    await waitForSaved(window.testItemId, { title: 'Updated Test Content Idea' });
  });

  await report('Status can move Idea → Draft → Ready → Completed → Draft', async () => {
    const status = appDocument().querySelector('[data-field="status"]');
    for (const value of ['draft', 'ready', 'completed', 'draft']) {
      status.value = value;
      status.dispatchEvent(new frame.contentWindow.Event('change', { bubbles: true }));
      assert(appDocument().querySelector('[data-status-summary]').dataset.statusSummary === value, `Editor reflects ${value}.`);
      const expectedCompletedAt = value === 'completed' ? undefined : null;
      const saved = await waitForSaved(window.testItemId, { status: value, ...(expectedCompletedAt === null ? { completedAt: null } : {}) });
      if (value === 'completed') assert(Number.isFinite(Date.parse(saved.completedAt)), 'Completed status has a timestamp.');
    }
  });

  await report('Duplicate creates an independent Idea and deleting it preserves the original', async () => {
    const originalBody = (await readItems()).find(item => item.id === window.testItemId).body;
    appDocument().querySelector('[data-action="duplicate-item"]').click();
    await waitFor(() => appDocument().querySelector('#editor-form')?.closest('[data-editor-id]')?.dataset.editorId !== window.testItemId, 'independent duplicate editor');
    const duplicateId = appDocument().querySelector('.editor-layout').dataset.editorId;
    assert(duplicateId !== window.testItemId, 'Duplicate has a different ID.');
    assert(appDocument().querySelector('[data-field="status"]').value === 'idea', 'Duplicate starts as an Idea.');
    assert(appDocument().querySelector('[data-field="body"]').value === originalBody, 'Duplicate keeps editable content.');
    setField('[data-field="body"]', 'Duplicate body only');
    await waitForSaved(duplicateId, { body: 'Duplicate body only', status: 'idea', completedAt: null });
    let items = await readItems();
    assert(items.find(item => item.id === window.testItemId).body === originalBody, 'Editing the duplicate does not alter the original.');
    frame.contentWindow.confirm = () => true;
    appDocument().querySelector('[data-action="delete-item"]').click();
    await waitFor(() => appDocument().querySelector('.content-layout'), 'content list after deletion');
    items = await readItems();
    assert(items.some(item => item.id === window.testItemId), 'Original remains stored.');
    assert(!items.some(item => item.id === duplicateId), 'Confirmed duplicate deletion removes only that record.');
  });

  await report('Keyboard focus, live save messaging, and text contrast are accessible', async () => {
    const row = appDocument().querySelector(`[data-open-id="${window.testItemId}"]`);
    assert(row?.tagName === 'BUTTON', 'Content records use native keyboard-operable buttons.');
    row.click();
    await waitFor(() => appDocument().querySelector('#editor-form'), 'editor for accessibility checks');
    const title = appDocument().querySelector('#editor-title');
    title.focus();
    assert(appDocument().activeElement === title, 'Editor fields can receive keyboard focus.');
    assert(title.matches(':focus-visible') && appDocument().defaultView.getComputedStyle(title).boxShadow !== 'none', 'Focused editor field has a visible focus treatment.');
    const saveStatus = appDocument().querySelector('#save-status');
    assert(saveStatus.getAttribute('role') === 'status' && saveStatus.getAttribute('aria-live') === 'polite', 'Save state is announced politely to assistive technology.');
    assert(appDocument().querySelector('nav[aria-label="Primary navigation"] a[data-view="home"]'), 'Primary navigation uses a semantic link.');
    const badge = appDocument().createElement('span');
    badge.className = 'status-badge status-idea';
    appDocument().body.append(badge);
    const badgeStyle = appDocument().defaultView.getComputedStyle(badge);
    const badgeContrast = contrastRatio(badgeStyle.color, badgeStyle.backgroundColor);
    badge.remove();
    const subtitleStyle = appDocument().defaultView.getComputedStyle(appDocument().querySelector('.page-subtitle'));
    const subtitleContrast = contrastRatio(subtitleStyle.color, appDocument().defaultView.getComputedStyle(appDocument().body).backgroundColor);
    assert(badgeContrast >= 4.5, `Idea badge text contrast is at least 4.5:1 (${badgeContrast.toFixed(2)}:1).`);
    assert(subtitleContrast >= 4.5, `Supporting text contrast is at least 4.5:1 (${subtitleContrast.toFixed(2)}:1).`);
  });

  await report('Responsive layouts fit 390, 430, 1280 and 1440 pixel viewports', async () => {
    appDocument().querySelector('.nav-link[data-view="home"]').click();
    await waitFor(() => appDocument().querySelector('#quick-capture-form'), 'Home view for responsive checks');
    for (const width of [390, 430, 1280, 1440]) {
      frame.style.width = `${width}px`;
      await delay(80);
      const child = appDocument();
      assert(child.defaultView.innerWidth === width, `Viewport is ${width}px.`);
      assert(child.documentElement.scrollWidth <= child.defaultView.innerWidth, `No horizontal overflow at ${width}px (${child.documentElement.scrollWidth}px content).`);
      if (width <= 430) {
        assert(child.defaultView.getComputedStyle(child.querySelector('.mobile-nav')).display === 'grid', 'Mobile bottom navigation is visible.');
        assert(child.querySelector('#quick-capture-title').getBoundingClientRect().width > 0, 'Quick Capture remains visible on mobile.');
        assert(child.querySelector('.mobile-nav-link[data-view="home"]').getBoundingClientRect().height >= 44, 'Mobile navigation meets the 44px touch target guidance.');
        assert(child.querySelector('.capture-submit').getBoundingClientRect().height >= 44, 'Quick Capture action meets the 44px touch target guidance.');
      } else {
        assert(child.defaultView.getComputedStyle(child.querySelector('.sidebar')).display !== 'none', 'Desktop navigation is visible.');
      }
    }
  });

  await report('Scenario A — create, validate, edit, and open an empty Batch', async () => {
    await navigateTo('batches');
    appDocument().querySelector('[data-action="new-batch"]').click();
    await waitFor(() => appDocument().querySelector('#batch-dialog')?.open, 'Batch creation dialog');
    appDocument().querySelector('#batch-form').requestSubmit();
    const validation = appDocument().querySelector('#batch-form-error');
    assert(!validation.hidden && validation.textContent.includes('name'), 'Blank Batch name shows understandable validation.');
    assert(appDocument().activeElement === appDocument().querySelector('#batch-name-input'), 'Validation returns focus to the required name field.');
    assert(appDocument().querySelector('label[for="batch-name-input"]') && appDocument().querySelector('label[for="batch-description-input"]'), 'Batch form fields have associated labels.');
    appDocument().querySelector('#batch-name-input').value = 'Batch A';
    appDocument().querySelector('#batch-description-input').value = 'Milestone 2 Test Batch';
    appDocument().querySelector('#batch-form').requestSubmit();
    await waitFor(() => appDocument().querySelector('.batch-workspace'), 'Batch A workspace');
    window.batchAId = appDocument().querySelector('.batch-workspace').dataset.batchDetailId;
    let batch = (await readBatches()).find(record => record.id === window.batchAId);
    assert(batch?.name === 'Batch A' && batch.description === 'Milestone 2 Test Batch', 'Batch name and description persist.');
    assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(batch.id), 'Batch identity is a UUID.');
    assert(Number.isFinite(Date.parse(batch.createdAt)) && Number.isFinite(Date.parse(batch.updatedAt)), 'Batch has ISO timestamps.');
    assert(appDocument().querySelector('.batch-total').textContent === '0 items', 'Empty Batch has zero items.');
    assert(appDocument().querySelector('.batch-progress-percent').textContent === '0% ready', 'Empty Batch progress is zero.');
    assert(appDocument().querySelector('.batch-empty-content').textContent.includes('No content in this Batch yet.'), 'Empty Batch has a clear empty state.');

    const previousUpdatedAt = batch.updatedAt;
    await delay(20);
    appDocument().querySelector('[data-action="edit-batch"]').click();
    appDocument().querySelector('#batch-name-input').value = 'Batch A';
    appDocument().querySelector('#batch-description-input').value = 'Edited description';
    appDocument().querySelector('#batch-form').requestSubmit();
    await waitForAsync(async () => (await readBatches()).find(record => record.id === window.batchAId)?.description === 'Edited description', 'Batch edit persisted');
    batch = (await readBatches()).find(record => record.id === window.batchAId);
    assert(Date.parse(batch.updatedAt) > Date.parse(previousUpdatedAt), 'Editing Batch metadata updates updatedAt.');
    appDocument().querySelector('[data-action="edit-batch"]').click();
    appDocument().querySelector('#batch-description-input').value = 'Milestone 2 Test Batch';
    appDocument().querySelector('#batch-form').requestSubmit();
    await waitForAsync(async () => (await readBatches()).find(record => record.id === window.batchAId)?.description === 'Milestone 2 Test Batch', 'Batch description restored');
  });

  await report('Scenario B — add existing content without creating a duplicate', async () => {
    const existingId = await createLibraryItem('Existing Idea');
    await navigateTo('batches');
    await openBatchByName('Batch A');
    appDocument().querySelector('[data-action="add-existing-content"]').click();
    await waitFor(() => appDocument().querySelector('#add-content-dialog')?.open, 'existing content dialog');
    const choice = appDocument().querySelector(`[data-existing-choice-id="${existingId}"]`);
    assert(choice && choice.textContent.includes('Add to Batch'), 'Unassigned content is eligible to add.');
    choice.querySelector('[data-assign-to-batch]').click();
    await waitFor(() => appDocument().querySelector(`[data-batch-item-id="${existingId}"]`), 'Existing Idea in Batch A');
    let items = await readItems();
    assert(items.find(item => item.id === existingId)?.batchId === window.batchAId, 'Existing content is assigned through batchId.');
    assert(items.filter(item => item.title === 'Existing Idea').length === 1, 'Assignment did not duplicate the ContentItem.');
    window.existingIdeaId = existingId;
    await navigateTo('content');
    assert(appDocument().querySelector(`[data-open-id="${existingId}"]`), 'The same record remains in the normal Content view.');
    assert(appDocument().querySelectorAll('[data-open-id]').length === items.length, 'Content view still contains one row per ContentItem.');
  });

  await report('Scenario C — create content inside Batch A using the existing editor', async () => {
    await openBatchByName('Batch A');
    const createdId = await createContentInsideCurrentBatch('Batch-Created Idea');
    const item = (await readItems()).find(record => record.id === createdId);
    assert(item?.status === 'idea' && item.batchId === window.batchAId, 'New content starts as Idea and belongs to Batch A.');
    await navigateTo('content');
    assert(appDocument().querySelector(`[data-open-id="${createdId}"]`), 'Batch-created content appears in the normal Content view.');
    appDocument().querySelector(`[data-open-id="${createdId}"]`).click();
    await waitFor(() => appDocument().querySelector('#editor-form'), 'Batch-created content editor');
    const batchSelect = appDocument().querySelector('#editor-batch');
    assert(batchSelect && batchSelect.querySelector(`option[value="${window.batchAId}"]`), 'Content editor lists the existing Batch.');
    batchSelect.value = '';
    batchSelect.dispatchEvent(new frame.contentWindow.Event('change', { bubbles: true }));
    await waitForSaved(createdId, { batchId: null });
    batchSelect.value = window.batchAId;
    batchSelect.dispatchEvent(new frame.contentWindow.Event('change', { bubbles: true }));
    await waitForSaved(createdId, { batchId: window.batchAId });
    window.batchCreatedIdeaId = createdId;
  });

  await report('Scenario D — exact seven-item progress is derived from current content', async () => {
    await openBatchByName('Batch A');
    const draftOne = await createContentInsideCurrentBatch('Draft One');
    const draftTwo = await createContentInsideCurrentBatch('Draft Two');
    const readyOne = await createContentInsideCurrentBatch('Ready One');
    const readyTwo = await createContentInsideCurrentBatch('Ready Two');
    const completedOne = await createContentInsideCurrentBatch('Completed One');
    window.progressItemIds = { draftOne, draftTwo, readyOne, readyTwo, completedOne };
    await setBatchItemStatus(draftOne, 'draft');
    await setBatchItemStatus(draftTwo, 'draft');
    await setBatchItemStatus(readyOne, 'ready');
    await setBatchItemStatus(readyTwo, 'ready');
    await setBatchItemStatus(completedOne, 'completed');
    const counts = [...appDocument().querySelectorAll('.batch-counts li')].map(node => node.textContent);
    assert(appDocument().querySelector('.batch-total').textContent === '7 items', 'Batch total is seven.');
    assert(counts.includes('2 Idea') && counts.includes('2 Draft') && counts.includes('2 Ready') && counts.includes('1 Completed'), `Status counts are exact (${counts.join(', ')}).`);
    assert(appDocument().querySelector('.batch-progress-count').textContent === '3 of 7 Ready or Completed', 'Ready plus Completed count is three of seven.');
    assert(appDocument().querySelector('.batch-progress-percent').textContent === '43% ready', 'Progress rounds 3 / 7 to 43 percent.');
    const completed = (await readItems()).find(item => item.id === completedOne);
    assert(Number.isFinite(Date.parse(completed.completedAt)), 'Completed item has completedAt.');
  });

  await report('Scenario E — Batch status changes use the approved reversible workflow', async () => {
    await setBatchItemStatus(window.existingIdeaId, 'draft');
    let counts = [...appDocument().querySelectorAll('.batch-counts li')].map(node => node.textContent);
    assert(counts.includes('1 Idea') && counts.includes('3 Draft'), 'Idea and Draft counts update after status change.');
    await setBatchItemStatus(window.existingIdeaId, 'ready');
    await setBatchItemStatus(window.existingIdeaId, 'completed');
    const completed = (await readItems()).find(item => item.id === window.existingIdeaId);
    assert(Number.isFinite(Date.parse(completed.completedAt)), 'Entering Completed sets completedAt.');
    await setBatchItemStatus(window.existingIdeaId, 'draft');
    const reopened = (await readItems()).find(item => item.id === window.existingIdeaId);
    assert(reopened.completedAt === null && reopened.status === 'draft', 'Leaving Completed clears completedAt and remains editable.');
  });

  await report('Scenario F — remove from Batch preserves the ContentItem', async () => {
    appDocument().querySelector(`[data-remove-batch-item="${window.existingIdeaId}"]`).click();
    await waitFor(() => !appDocument().querySelector(`[data-batch-item-id="${window.existingIdeaId}"]`), 'item removed from Batch');
    let items = await readItems();
    const item = items.find(record => record.id === window.existingIdeaId);
    assert(item && item.batchId === null, 'Remove clears only batchId; the ContentItem remains.');
    await navigateTo('content');
    assert(appDocument().querySelector(`[data-open-id="${window.existingIdeaId}"]`), 'Removed content remains available in Content.');
  });

  await report('Scenario G — explicit reassignment moves one record between Batches', async () => {
    window.batchBId = await createBatchFromList('Batch B', 'Destination Batch');
    assert(appDocument().querySelector('.batch-total').textContent === '0 items', 'Batch B starts empty.');
    appDocument().querySelector('[data-action="add-existing-content"]').click();
    await waitFor(() => appDocument().querySelector('#add-content-dialog')?.open, 'reassignment choices');
    const choice = appDocument().querySelector(`[data-existing-choice-id="${window.batchCreatedIdeaId}"]`);
    assert(choice?.textContent.includes('Currently in Batch A') && choice.textContent.includes('Move here'), 'Assigned content is identified before reassignment.');
    let reassignmentConfirmation = '';
    frame.contentWindow.confirm = message => { reassignmentConfirmation = message; return true; };
    choice.querySelector('[data-assign-to-batch]').click();
    await waitFor(() => appDocument().querySelector('.batch-workspace')?.dataset.batchDetailId === window.batchBId, 'remain in Batch B after reassignment');
    await waitForAsync(async () => (await readItems()).find(item => item.id === window.batchCreatedIdeaId)?.batchId === window.batchBId, 'reassignment persisted');
    assert(reassignmentConfirmation.includes('from Batch A to Batch B'), 'Moving from another Batch required clear confirmation.');
    const items = await readItems();
    assert(items.filter(item => item.id === window.batchCreatedIdeaId).length === 1, 'Reassignment does not create a duplicate ContentItem.');
    assert(appDocument().querySelector(`[data-batch-item-id="${window.batchCreatedIdeaId}"]`), 'Moved item appears in Batch B.');
    await openBatchByName('Batch A');
    assert(!appDocument().querySelector(`[data-batch-item-id="${window.batchCreatedIdeaId}"]`), 'Moved item is no longer in Batch A.');
  });

  await report('Scenario H — deleting Batch A confirms, preserves all content, and keeps Batch B intact', async () => {
    await openBatchByName('Batch A');
    window.batchAContentIds = (await readItems()).filter(item => item.batchId === window.batchAId).map(item => item.id);
    let deleteConfirmation = '';
    frame.contentWindow.confirm = message => { deleteConfirmation = message; return true; };
    appDocument().querySelector('[data-action="delete-batch"]').click();
    await waitFor(() => appDocument().querySelector('.batches-layout'), 'Batches list after deletion');
    assert(deleteConfirmation.includes('content items stay in Content') && deleteConfirmation.includes('become unassigned'), 'Delete confirmation explains content will survive and become unassigned.');
    const batches = await readBatches();
    const items = await readItems();
    assert(!batches.some(batch => batch.id === window.batchAId), 'Batch A is deleted.');
    assert(batches.some(batch => batch.id === window.batchBId), 'Batch B remains.');
    for (const id of window.batchAContentIds) {
      const item = items.find(record => record.id === id);
      assert(item, `ContentItem ${id} survives Batch A deletion.`);
      assert(item.batchId === null, `Former Batch A item ${id} has no dangling reference.`);
    }
    const moved = items.find(item => item.id === window.batchCreatedIdeaId);
    assert(moved?.batchId === window.batchBId, 'The Batch B assignment remains intact.');
    assert(items.length >= window.batchAContentIds.length, 'No ContentItem was deleted with Batch A.');
  });

  await report('Scenario I — Batch records and assignments persist after reload', async () => {
    await new Promise(resolve => {
      frame.addEventListener('load', resolve, { once: true });
      frame.contentWindow.location.reload();
    });
    await waitFor(() => appDocument()?.querySelector('#quick-capture-form'), 'application after Batch reload');
    await openBatchByName('Batch B');
    assert(appDocument().querySelector(`[data-batch-item-id="${window.batchCreatedIdeaId}"]`), 'Batch B content is present after reload.');
    const item = (await readItems()).find(record => record.id === window.batchCreatedIdeaId);
    assert(item?.batchId === window.batchBId, 'batchId relationship persists across reload.');
    assert(appDocument().querySelector('.batch-total').textContent === '1 item', 'Derived progress remains correct after reload.');
  });

  await report('Scenario J — Batch list and workspace fit 390, 430, 1280, and 1440 pixels', async () => {
    for (const width of [390, 430, 1280, 1440]) {
      frame.style.width = `${width}px`;
      await delay(80);
      assert(appDocument().defaultView.innerWidth === width, `Browser content viewport is ${width}px.`);
      assert(appDocument().documentElement.scrollWidth <= width, `Batch detail has no horizontal overflow at ${width}px (${appDocument().documentElement.scrollWidth}px).`);
      assert(appDocument().querySelector('.batch-progress-count')?.getBoundingClientRect().width > 0, `Progress is visible at ${width}px.`);
      const status = appDocument().querySelector(`[data-batch-status="${window.batchCreatedIdeaId}"]`);
      assert(status && status.getBoundingClientRect().width > 0, `Status action is available at ${width}px.`);
      assert(appDocument().querySelector(`label[for="${status.id}"]`), `Status control has an associated label at ${width}px.`);
      assert(!status.closest('.visually-hidden') && appDocument().defaultView.getComputedStyle(status).visibility !== 'hidden', `Status selector is visibly rendered at ${width}px.`);
      if (width <= 430) assert(status.getBoundingClientRect().height >= 44, `Status control has a touch-friendly target at ${width}px.`);
      appDocument().querySelector('[data-action="back-to-batches"]').click();
      await waitFor(() => appDocument().querySelector('.batches-layout'), `Batch list at ${width}px`);
      assert(appDocument().documentElement.scrollWidth <= width, `Batch list has no horizontal overflow at ${width}px.`);
      assert(appDocument().querySelector('[data-open-batch-id]')?.getBoundingClientRect().width > 0, `Batch open action is usable at ${width}px.`);
      appDocument().querySelector(`[data-open-batch-id="${window.batchBId}"]`).click();
      await waitFor(() => appDocument().querySelector('.batch-workspace'), `Batch workspace restored at ${width}px`);
    }
  });

  await report('Milestone 1–2 Regression — existing browser workflow produces no uncaught application console errors', async () => {
    assert(browserErrors.length === 0, browserErrors.join('\n') || 'No console errors, uncaught errors, or unhandled rejections.');
  });

  await runMilestone3BrowserScenarios({
    frame, appDocument, report, waitFor, waitForAsync, assert, readItems, readBatches,
    readTemplates, navigateTo, createLibraryItem, setItemFields, openBatchByName,
    createBatchFromList, createContentInsideCurrentBatch, waitForSaved,
    browserErrors, batchBId: window.batchBId
  });

  document.documentElement.dataset.testResult = 'passed';
  output.textContent = `${checks.join('\n')}\n\n${checks.length} checks passed.`;
}

async function showFailure(error) {
  const childDocument = frame.contentDocument;
  const resources = childDocument?.defaultView?.performance?.getEntriesByType('resource')
    ?.map(entry => entry.name.split('/').slice(-2).join('/')).join(', ') || 'none';
  const screenMarkup = childDocument?.querySelector('#screen')?.innerHTML?.slice(0, 320) || 'empty';
  let databaseDetails = 'IndexedDB probe unavailable.';
  try {
    databaseDetails = await Promise.race([
      new Promise((resolve, reject) => {
        const request = frame.contentWindow.indexedDB.open('contentbatch', 1);
        request.onupgradeneeded = () => {};
        request.onsuccess = () => {
          const database = request.result;
          const names = [...database.objectStoreNames];
          const transaction = database.transaction(['contentItems', 'batches'], 'readonly');
          const itemRequest = transaction.objectStore('contentItems').count();
          const batchRequest = transaction.objectStore('batches').count();
          let itemCount = null;
          let batchCount = null;
          itemRequest.onsuccess = () => { itemCount = itemRequest.result; };
          batchRequest.onsuccess = () => { batchCount = batchRequest.result; };
          transaction.oncomplete = () => { database.close(); resolve(`stores=${names.join(',')} contentItems=${itemCount} batches=${batchCount}`); };
          transaction.onabort = () => { database.close(); reject(transaction.error); };
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('database open blocked'));
      }),
      new Promise(resolve => setTimeout(() => resolve('IndexedDB open or read timed out.'), 2500))
    ]);
  } catch (databaseError) {
    databaseDetails = `IndexedDB error: ${databaseError.message}`;
  }
  const details = `Frame: ${frame.contentWindow.location.href} (${childDocument?.readyState || 'no document'})\nResources: ${resources}\nScreen: ${screenMarkup}\nDatabase: ${databaseDetails}\n${childDocument?.body?.innerText?.slice(0, 420) || 'No frame body.'}`;
  checks.push(`FAIL  ${error.stack || error.message}`);
  output.textContent = `${checks.join('\n')}\n\n${details}\n\n${browserErrors.length ? `Browser errors:\n${browserErrors.join('\n')}` : ''}`;
  document.documentElement.dataset.testResult = 'failed';
}

frame.addEventListener('load', installConsoleCapture);
installConsoleCapture();
frame.src = '../index.html';
runWorkflow().catch(showFailure);
