(() => {
  try {
    const saved = JSON.parse(localStorage.getItem('tagalog-academy.settings') || '{}').theme || 'system';
    const dark = saved === 'dark' || (saved === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.themePreference = saved;
  } catch {
    document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.themePreference = 'system';
  }
})();
