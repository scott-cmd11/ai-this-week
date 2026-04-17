// Runs before React hydrates — prevents flash of wrong theme colour
(function () {
  try {
    var t = localStorage.getItem('theme')
    if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
    }
  } catch (e) {}
})()
