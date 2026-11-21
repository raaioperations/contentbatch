const TITLES = {
  home: ['Your content, organized.', 'A little structure for everything you want to share.'],
  content: ['Content library', 'Find the thought you want to keep shaping.'],
  editor: ['Content editor', 'Shape the idea at your own pace.'],
  batches: ['Batches', 'Focused groups of content you’re preparing together.'],
  'batch-detail': ['Batch workspace', 'Work through the content in this focused session.'],
  plan: ['Plan your content', 'See when content is intended to be used.'],
  templates: ['Templates', 'Save useful structures and reuse them for independent ideas.']
};

export function updateNavigation(view, activeView = view === 'editor' ? 'content' : view === 'batch-detail' ? 'batches' : view) {
  for (const button of document.querySelectorAll('a.nav-link[data-view], a.mobile-nav-link[data-view]')) {
    if (button.dataset.view === activeView) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
    button.classList.toggle('is-active', button.dataset.view === activeView);
  }

  const [title, subtitle] = TITLES[view] ?? TITLES.home;
  document.querySelector('#page-title').textContent = title;
  document.querySelector('#page-subtitle').textContent = subtitle;
}

export function bindNavigation(onNavigate) {
  for (const link of document.querySelectorAll('a.nav-link[data-view], a.mobile-nav-link[data-view]')) {
    link.addEventListener('click', event => {
      event.preventDefault();
      onNavigate(link.dataset.view);
    });
  }
}
