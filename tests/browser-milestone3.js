export async function runMilestone3BrowserScenarios(api) {
  const {
    frame, appDocument, report, waitFor, waitForAsync, assert, readItems, readBatches,
    readTemplates, navigateTo, createLibraryItem, setItemFields, openBatchByName,
    createBatchFromList, createContentInsideCurrentBatch, waitForSaved
  } = api;
  const reloadApp = async message => {
    await new Promise(resolve => {
      frame.addEventListener('load', resolve, { once: true });
      frame.contentWindow.location.reload();
    });
    await waitFor(() => appDocument()?.querySelector('#quick-capture-form'), message);
  };

  await report('Milestone 3 Scenario A — date-only scheduling persists exactly and can return to Unscheduled', async () => {
    const itemId = await createLibraryItem('M3 Scheduled Idea');
    const date = appDocument().querySelector('[data-field="scheduledDate"]');
    date.value = '2026-11-24';
    date.dispatchEvent(new frame.contentWindow.Event('input', { bubbles: true }));
    await waitForSaved(itemId, { scheduledDate: '2026-11-24', status: 'idea' });
    await navigateTo('plan');
    appDocument().querySelector('[data-select-date="2026-11-24"]')?.click();
    await waitFor(() => appDocument().querySelector(`[data-plan-item-id="${itemId}"]`), 'scheduled item on November 24');
    let record = (await readItems()).find(item => item.id === itemId);
    assert(record.scheduledDate === '2026-11-24' && record.status === 'idea', 'Idea status remains independent from its intended date.');
    await reloadApp('application after exact-date reload');
    await navigateTo('plan');
    appDocument().querySelector('[data-select-date="2026-11-24"]')?.click();
    await waitFor(() => appDocument().querySelector(`[data-plan-item-id="${itemId}"]`), 'scheduled item after reload');
    record = (await readItems()).find(item => item.id === itemId);
    assert(record.scheduledDate === '2026-11-24', 'Stored date remains exactly 2026-11-24 after reload.');
    appDocument().querySelector(`[data-clear-plan-date="${itemId}"]`).click();
    await waitFor(() => appDocument().querySelector(`.unscheduled-panel [data-plan-item-id="${itemId}"]`), 'item in Unscheduled after date removal');
    assert((await readItems()).find(item => item.id === itemId)?.scheduledDate === null, 'Removing the date stores null.');
    const unscheduledDate = appDocument().querySelector(`.unscheduled-panel [data-plan-date="${itemId}"]`);
    unscheduledDate.value = '2026-11-30';
    unscheduledDate.dispatchEvent(new frame.contentWindow.Event('change', { bubbles: true }));
    await waitFor(() => appDocument().querySelector(`[data-plan-item-id="${itemId}"]`) && !appDocument().querySelector(`.unscheduled-panel [data-plan-item-id="${itemId}"]`), 'date assignment from Unscheduled');
    assert((await readItems()).find(item => item.id === itemId)?.scheduledDate === '2026-11-30', 'Plan assigns dates directly from Unscheduled.');
    api.m3ScheduledIdeaId = itemId;
  });

  await report('Milestone 3 Scenario B — status and date remain independent in both directions', async () => {
    const scheduledIdea = await createLibraryItem('M3 Idea Scheduled');
    await setItemFields(scheduledIdea, { scheduledDate: '2026-11-25' });
    const readyUnscheduled = await createLibraryItem('M3 Ready Unscheduled');
    await setItemFields(readyUnscheduled, { status: 'ready' });
    const items = await readItems();
    const idea = items.find(item => item.id === scheduledIdea);
    const ready = items.find(item => item.id === readyUnscheduled);
    assert(idea.status === 'idea' && idea.scheduledDate === '2026-11-25', 'Idea can have an intended date without changing status.');
    assert(ready.status === 'ready' && ready.scheduledDate === null, 'Ready content can remain unscheduled.');
    await navigateTo('plan');
    appDocument().querySelector('[data-select-date="2026-11-25"]')?.click();
    await waitFor(() => appDocument().querySelector(`[data-plan-item-id="${scheduledIdea}"]`), 'Idea Scheduled in Plan');
    assert(appDocument().querySelector(`.unscheduled-panel [data-plan-item-id="${readyUnscheduled}"] .status-ready`), 'Ready Unscheduled remains visible with its Ready text label.');
    assert(![...appDocument().querySelectorAll('.status-badge')].some(badge => badge.textContent === 'Planned'), 'No Planned status is introduced.');
    api.m3ReadyUnscheduledId = readyUnscheduled;
  });

  await report('Milestone 3 Scenario C — mobile agenda groups dates chronologically and stays usable', async () => {
    const agendaIds = [];
    for (const [index, dateValue] of ['2026-11-26', '2026-11-27', '2026-11-29'].entries()) {
      const id = await createLibraryItem(`M3 Mobile Agenda ${index + 1}`);
      await setItemFields(id, { scheduledDate: dateValue });
      agendaIds.push(id);
    }
    frame.style.width = '390px';
    await navigateTo('plan');
    const groups = [...appDocument().querySelectorAll('.mobile-agenda-panel .agenda-day')];
    const groupDates = groups.map(node => node.querySelector('h3').id.replace('agenda-', ''));
    assert(groupDates.length >= 3 && groupDates.join(',') === [...groupDates].sort().join(','), 'Mobile date groups appear in chronological order.');
    assert(appDocument().documentElement.scrollWidth <= 390, 'Mobile Plan has no horizontal overflow at 390px.');
    assert(appDocument().querySelector('.mobile-month-nav [data-month-delta]')?.getBoundingClientRect().height >= 44, 'Mobile month navigation meets the 44px touch target guidance.');
    assert(appDocument().querySelector('.mobile-agenda-panel [data-plan-date]')?.getBoundingClientRect().height >= 44, 'Agenda date controls meet the 44px touch target guidance.');
    const row = appDocument().querySelector(`[data-plan-open-id="${agendaIds[0]}"]`);
    assert(row?.tagName === 'BUTTON', 'Agenda items use native open buttons.');
    row.click();
    await waitFor(() => appDocument().querySelector('#editor-form'), 'mobile agenda item editor');
    appDocument().querySelector('[data-action="back-to-return"]').click();
    await waitFor(() => appDocument().querySelector('.plan-layout'), 'mobile Plan after returning from editor');
    assert(appDocument().querySelector('.unscheduled-panel'), 'Unscheduled remains reachable on mobile.');
  });

  await report('Milestone 3 Scenario D — desktop month grid opens the selected-day agenda', async () => {
    frame.style.width = '1280px';
    await navigateTo('plan');
    assert(appDocument().querySelector('.plan-calendar-panel .calendar-grid'), 'Desktop Plan displays a month grid.');
    const cell = appDocument().querySelector('[data-select-date="2026-11-26"]');
    assert(cell?.textContent.includes('1 item'), 'Month cell shows a compact item count.');
    cell.click();
    await waitFor(() => appDocument().querySelector('.selected-day-panel h2')?.textContent.includes('November 26'), 'selected-day agenda heading');
    const agendaItem = appDocument().querySelector('.selected-day-panel [data-plan-item-id]');
    assert(agendaItem?.querySelector('[data-plan-open-id]'), 'Selected-day agenda provides a ContentItem open action.');
  });

  await report('Milestone 3 Scenario E — local search covers all approved fields case-insensitively', async () => {
    const id = await createLibraryItem('Holiday Launch M3');
    await setItemFields(id, { hook: 'HOOKSEARCHM3', body: 'BODYSEARCHM3', cta: 'CTASEARCHM3', notes: 'NOTESEARCHM3', tags: 'TAGSEARCHM3' });
    await navigateTo('content');
    const search = appDocument().querySelector('#content-search');
    for (const term of ['holiday launch', 'hooksearchm3', 'bodysearchm3', 'ctasearchm3', 'notesearchm3', 'tagsearchm3']) {
      search.value = term.toUpperCase();
      search.dispatchEvent(new frame.contentWindow.Event('input', { bubbles: true }));
      assert(appDocument().querySelector(`#content-results [data-open-id="${id}"]`), `Search finds ${term}.`);
      assert(appDocument().querySelectorAll('#content-results [data-open-id]').length === 1, `Search ${term} returns the exact matching result.`);
    }
    search.value = 'not-a-real-m3-result';
    search.dispatchEvent(new frame.contentWindow.Event('input', { bubbles: true }));
    assert(appDocument().querySelector('.filter-empty')?.textContent.includes('No content matches'), 'No-match state explains the empty results.');
    appDocument().querySelector('[data-action="clear-content-filters"]').click();
    assert(appDocument().querySelectorAll('#content-results [data-open-id]').length > 1, 'Clear Filters restores the full library.');
  });

  await report('Milestone 3 Scenario F — filters combine by AND and Clear Filters restores results', async () => {
    const match = await createLibraryItem('M3 Filter Match');
    await setItemFields(match, { status: 'ready', contentType: 'social-post', channel: 'linkedin', batchId: api.batchBId, tags: 'product' });
    const wrongStatus = await createLibraryItem('M3 Filter Wrong Status');
    await setItemFields(wrongStatus, { status: 'draft', contentType: 'social-post', channel: 'linkedin', batchId: api.batchBId, tags: 'product' });
    const wrongChannel = await createLibraryItem('M3 Filter Wrong Channel');
    await setItemFields(wrongChannel, { status: 'ready', contentType: 'social-post', channel: 'instagram', batchId: api.batchBId, tags: 'product' });
    await navigateTo('content');
    for (const [id, value] of [['filter-status', 'ready'], ['filter-type', 'social-post'], ['filter-channel', 'linkedin'], ['filter-batch', api.batchBId], ['filter-tag', 'product']]) {
      const control = appDocument().querySelector(`#${id}`);
      assert(control, `Filter ${id} is available.`);
      control.value = value;
      control.dispatchEvent(new frame.contentWindow.Event('change', { bubbles: true }));
    }
    assert(appDocument().querySelectorAll('#content-results [data-open-id]').length === 1, 'Combined status/type/channel/batch/tag filters leave one record.');
    assert(appDocument().querySelector(`#content-results [data-open-id="${match}"]`), 'Only the record matching every category remains.');
    assert(appDocument().querySelector('#active-filter-status').textContent.includes('5 filters active'), 'Active filter count is visible.');
    appDocument().querySelector('[data-action="clear-content-filters"]').click();
    assert(appDocument().querySelectorAll('#content-results [data-open-id]').length >= 3, 'Clear Filters restores unfiltered content.');
  });

  await report('Milestone 3 Scenario G — tags trim, deduplicate, persist, and remain filterable', async () => {
    const id = await createLibraryItem('M3 Tag Normalization');
    await setItemFields(id, { tags: ' Product , Education, product, PRODUCT,   ' });
    let item = (await readItems()).find(record => record.id === id);
    assert(JSON.stringify(item.tags) === JSON.stringify(['Product', 'Education']), 'Whitespace and case variants normalize to one readable tag.');
    await reloadApp('application after tag reload');
    item = (await readItems()).find(record => record.id === id);
    assert(JSON.stringify(item.tags) === JSON.stringify(['Product', 'Education']), 'Normalized tags persist after reload.');
    await navigateTo('content');
    const tagFilter = appDocument().querySelector('#filter-tag');
    tagFilter.value = 'Education';
    tagFilter.dispatchEvent(new frame.contentWindow.Event('change', { bubbles: true }));
    assert(appDocument().querySelector(`#content-results [data-open-id="${id}"]`), 'Available tags are derived from ContentItems and filter correctly.');
  });

  await report('Milestone 3 Scenario H — Template CRUD validation and persistence work', async () => {
    await navigateTo('content');
    appDocument().querySelector('[data-action="open-templates"]').click();
    await waitFor(() => appDocument().querySelector('.templates-layout'), 'Templates secondary view');
    appDocument().querySelector('[data-action="new-template"]').click();
    await waitFor(() => appDocument().querySelector('#template-dialog')?.open, 'Template editor dialog');
    const templateControls = [...appDocument().querySelectorAll('#template-form input, #template-form textarea, #template-form select')].filter(control => !control.closest('[hidden]'));
    assert(templateControls.every(control => control.labels?.length), 'Visible Template form controls have associated labels.');
    assert(appDocument().querySelector('#template-name')?.matches(':focus-visible'), 'Template form receives visible keyboard focus.');
    appDocument().querySelector('#template-form').requestSubmit();
    assert(!appDocument().querySelector('#template-form-error').hidden, 'Blank Template name shows validation.');
    appDocument().querySelector('#template-name').value = 'Educational Post';
    appDocument().querySelector('#template-hook').value = '3 mistakes people make with...';
    appDocument().querySelector('#template-body').value = '1.\n2.\n3.';
    appDocument().querySelector('#template-cta').value = 'What would you add?';
    appDocument().querySelector('#template-tags').value = 'Education';
    appDocument().querySelector('#template-form').requestSubmit();
    await waitFor(() => appDocument().querySelector('[data-template-id]'), 'Educational Post Template');
    const template = (await readTemplates()).find(record => record.name === 'Educational Post');
    api.educationalTemplateId = template?.id;
    assert(template && template.id, 'Template persists with an identity.');
    assert(!['status', 'scheduledDate', 'completedAt', 'batchId'].some(key => Object.hasOwn(template, key)), 'Template contains no workflow/date/completion/Batch fields.');
    await reloadApp('application after Template reload');
    await navigateTo('content');
    appDocument().querySelector('[data-action="open-templates"]').click();
    await waitFor(() => appDocument().querySelector(`[data-template-id="${template.id}"]`), 'Template after reload');
    appDocument().querySelector('[data-action="new-template"]').click();
    appDocument().querySelector('#template-name').value = 'M3 Temporary Template';
    appDocument().querySelector('#template-form').requestSubmit();
    await waitFor(() => [...appDocument().querySelectorAll('[data-template-id]')].some(node => node.textContent.includes('M3 Temporary Template')), 'temporary Template');
    const temporary = (await readTemplates()).find(record => record.name === 'M3 Temporary Template');
    frame.contentWindow.confirm = () => true;
    appDocument().querySelector(`[data-delete-template="${temporary.id}"]`).click();
    await waitForAsync(async () => !(await readTemplates()).some(record => record.id === temporary.id), 'Template deletion');
    assert((await readTemplates()).some(record => record.id === template.id), 'Deleting one Template leaves other Templates intact.');
  });

  await report('Milestone 3 Scenario I — Template application creates independent content and stays detached', async () => {
    appDocument().querySelector(`[data-apply-template="${api.educationalTemplateId}"]`).click();
    appDocument().querySelector('#apply-template-name').value = 'M3 Template Applied Content';
    appDocument().querySelector('#apply-template-form').requestSubmit();
    await waitFor(() => appDocument().querySelector('#editor-form') && appDocument().querySelector('#editor-title')?.value === 'M3 Template Applied Content', 'applied Template editor');
    const itemId = appDocument().querySelector('.editor-layout').dataset.editorId;
    let item = (await readItems()).find(record => record.id === itemId);
    assert(itemId !== api.educationalTemplateId && item.status === 'idea' && item.scheduledDate === null && item.completedAt === null && item.batchId === null, 'Applied ContentItem has a new ID and approved defaults.');
    assert(item.hook === '3 mistakes people make with...' && item.body === '1.\n2.\n3.' && item.cta === 'What would you add?' && JSON.stringify(item.tags) === JSON.stringify(['Education']), 'Template reusable fields are copied.');
    const body = appDocument().querySelector('[data-field="body"]');
    body.value = 'Edited content only';
    body.dispatchEvent(new frame.contentWindow.Event('input', { bubbles: true }));
    await waitForSaved(itemId, { body: 'Edited content only' });
    assert((await readTemplates()).find(record => record.id === api.educationalTemplateId).body === '1.\n2.\n3.', 'Editing applied content does not mutate its Template.');
    appDocument().querySelector('[data-action="back-to-return"]').click();
    await waitFor(() => appDocument().querySelector('.content-layout'), 'Content after Template application');
    appDocument().querySelector('[data-action="open-templates"]').click();
    await waitFor(() => appDocument().querySelector(`[data-template-id="${api.educationalTemplateId}"]`), 'Template list after editing Content');
    appDocument().querySelector(`[data-edit-template="${api.educationalTemplateId}"]`).click();
    appDocument().querySelector('#template-body').value = 'Changed Template structure';
    appDocument().querySelector('#template-form').requestSubmit();
    await waitForAsync(async () => (await readTemplates()).find(record => record.id === api.educationalTemplateId)?.body === 'Changed Template structure', 'Template update');
    item = (await readItems()).find(record => record.id === itemId);
    assert(item.body === 'Edited content only', 'Editing Template does not mutate an already-created item.');
    api.m3AppliedContentId = itemId;
  });

  await report('Milestone 3 Scenario J — applying a Template in Batch context updates Batch membership', async () => {
    await openBatchByName('Batch B');
    const before = Number(appDocument().querySelector('.batch-total').textContent.match(/\d+/)?.[0] ?? 0);
    appDocument().querySelector('[data-action="open-templates"]').click();
    await waitFor(() => appDocument().querySelector('.templates-layout'), 'Templates opened from Batch context');
    appDocument().querySelector(`[data-apply-template="${api.educationalTemplateId}"]`).click();
    appDocument().querySelector('#apply-template-name').value = 'M3 Batch Template Idea';
    appDocument().querySelector('#apply-template-form').requestSubmit();
    await waitFor(() => appDocument().querySelector('#editor-form') && appDocument().querySelector('#editor-title')?.value === 'M3 Batch Template Idea', 'Batch Template editor');
    const id = appDocument().querySelector('.editor-layout').dataset.editorId;
    const item = (await readItems()).find(record => record.id === id);
    assert(item.batchId === api.batchBId && item.status === 'idea', 'Template creates an Idea assigned to the current Batch.');
    appDocument().querySelector('[data-action="back-to-return"]').click();
    await waitFor(() => appDocument().querySelector('.batch-workspace'), 'Batch workspace after Template application');
    const total = Number(appDocument().querySelector('.batch-total').textContent.match(/\d+/)?.[0] ?? 0);
    assert(total === before + 1 && appDocument().querySelector(`[data-batch-item-id="${id}"]`), 'Batch count and item list refresh.');
  });

  await report('Milestone 3 Scenario K — existing Quick Capture, autosave, Batch assignment, and safe deletion remain intact', async () => {
    await navigateTo('home');
    appDocument().querySelector('#quick-capture-title').value = 'M3 Regression Quick Capture';
    appDocument().querySelector('#quick-capture-form').requestSubmit();
    await waitFor(() => appDocument().querySelector('.home-layout'), 'Home after Quick Capture');
    const id = (await readItems()).find(item => item.title === 'M3 Regression Quick Capture')?.id;
    assert(id, 'Quick Capture still creates an Idea.');
    await setItemFields(id, { status: 'draft', batchId: api.batchBId });
    const updated = (await readItems()).find(item => item.id === id);
    assert(updated.status === 'draft' && updated.batchId === api.batchBId, 'Autosave, status, and Batch assignment still persist.');
    const batchId = await createBatchFromList('M3 Delete Safety Batch');
    const contentId = await createContentInsideCurrentBatch('M3 Must Survive Batch Deletion');
    frame.contentWindow.confirm = () => true;
    appDocument().querySelector('[data-action="delete-batch"]').click();
    await waitFor(() => appDocument().querySelector('.batches-layout'), 'Batch list after deletion');
    const survivor = (await readItems()).find(item => item.id === contentId);
    assert(survivor && survivor.batchId === null, 'Batch deletion preserves content and clears its relationship.');
    assert(!(await readBatches()).some(batch => batch.id === batchId), 'Disposable Batch is deleted.');
  });

  await report('Milestone 3 Scenario L — planning, retrieval, Templates, editor, and Batch fit 390/430/1280/1440px', async () => {
    for (const width of [390, 430, 1280, 1440]) {
      frame.style.width = `${width}px`;
      await navigateTo('plan');
      assert(appDocument().documentElement.scrollWidth <= width, `Plan fits ${width}px without horizontal overflow.`);
      assert(appDocument().querySelector('.unscheduled-panel')?.getBoundingClientRect().width > 0, `Unscheduled is reachable at ${width}px.`);
      if (width <= 430) assert(appDocument().defaultView.getComputedStyle(appDocument().querySelector('.mobile-agenda-panel')).display !== 'none', 'Mobile uses agenda planning.');
      else assert(appDocument().defaultView.getComputedStyle(appDocument().querySelector('.plan-calendar-panel')).display !== 'none', 'Desktop uses the month grid.');
      await navigateTo('content');
      assert(appDocument().documentElement.scrollWidth <= width, `Content search/filter view fits ${width}px.`);
      assert(appDocument().querySelector('#content-search')?.getBoundingClientRect().width > 0, `Search is visible at ${width}px.`);
      appDocument().querySelector('[data-action="open-templates"]').click();
      await waitFor(() => appDocument().querySelector('.templates-layout'), 'Templates responsive view');
      assert(appDocument().documentElement.scrollWidth <= width, `Templates fit ${width}px.`);
      await openBatchByName('Batch B');
      assert(appDocument().documentElement.scrollWidth <= width, `Batch workspace fits ${width}px.`);
      const itemButton = appDocument().querySelector('.batch-workspace [data-open-id]');
      itemButton?.click();
      if (itemButton) {
        await waitFor(() => appDocument().querySelector('#editor-form'), 'editor responsive view');
        assert(appDocument().documentElement.scrollWidth <= width, `Content editor fits ${width}px.`);
      }
    }
  });

  await report('Milestone 3 Scenario M — final workflow produces zero uncaught application console errors', async () => {
    assert(api.browserErrors.length === 0, api.browserErrors.join('\n') || 'No uncaught errors or unhandled promise rejections across Milestones 1–3.');
  });
}
