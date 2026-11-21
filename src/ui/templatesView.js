import { button, element } from './dom.js';

const TYPE_LABELS = { 'social-post': 'Social post', 'short-video': 'Short video', 'long-video': 'Long video', article: 'Article/Blog', email: 'Email', other: 'Other' };
const CHANNEL_LABELS = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn', x: 'X', email: 'Email', blog: 'Blog/Web', other: 'Other' };

export function renderTemplatesView(templates, { batchName = null } = {}) {
  const page = element('div', { className: 'templates-layout' });
  const heading = element('div', { className: 'templates-heading' });
  const copy = element('div');
  copy.append(element('p', { className: 'eyebrow', text: 'REUSABLE STRUCTURES' }));
  copy.append(element('h2', { text: 'Templates' }));
  copy.append(element('p', { text: 'Save a useful shape, then start each new piece as its own idea.' }));
  heading.append(copy, button('New Template', { className: 'button button-primary', action: 'new-template' }));
  page.append(heading);
  if (!templates.length) {
    const empty = element('section', { className: 'template-empty' });
    empty.append(element('h3', { text: 'Start with a structure you reuse.' }));
    empty.append(element('p', { text: 'Templates can hold a hook, body outline, CTA, notes, and tags.' }));
    empty.append(button('Create a Template', { className: 'button button-primary', action: 'new-template' }));
    page.append(empty);
  } else {
    const list = element('div', { className: 'template-list' });
    for (const template of templates) {
      const card = element('article', { className: 'template-card', attrs: { 'data-template-id': template.id } });
      const cardHeader = element('div', { className: 'template-card-header' });
      const summary = element('div');
      summary.append(element('h3', { text: template.name }));
      const labels = [template.contentType && (template.contentType === 'other' ? template.customContentType : TYPE_LABELS[template.contentType]), template.channel && (template.channel === 'other' ? template.customChannel : CHANNEL_LABELS[template.channel])].filter(Boolean);
      if (labels.length) summary.append(element('p', { className: 'template-labels', text: labels.join(' · ') }));
      cardHeader.append(summary);
      card.append(cardHeader);
      const preview = template.hook || template.body || template.cta;
      if (preview) card.append(element('p', { className: 'template-preview', text: preview }));
      if (template.tags.length) card.append(element('p', { className: 'template-tags', text: `Tags: ${template.tags.join(', ')}` }));
      const actions = element('div', { className: 'template-actions' });
      actions.append(button('Use Template', { className: 'button button-primary', attrs: { 'data-apply-template': template.id } }));
      actions.append(button('Edit', { className: 'button button-secondary', attrs: { 'data-edit-template': template.id } }));
      actions.append(button('Delete', { className: 'button button-secondary', attrs: { 'data-delete-template': template.id } }));
      card.append(actions);
      list.append(card);
    }
    page.append(list);
  }
  page.append(button(batchName ? 'Back to Batch' : 'Back to Content', { className: 'back-button', action: 'back-from-templates' }));
  return page;
}
