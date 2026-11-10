(() => {
  const root = document.documentElement;
  root.classList.add('m-enter');
  setTimeout(() => root.classList.add('m-enter-done'), 700);
  let dark = matchMedia('(prefers-color-scheme: dark)').matches;
  try { const choice = localStorage.getItem('theme'); if(choice) dark = choice === 'dark'; } catch {}
  root.classList.toggle('dark', dark);
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('theme');
    button.setAttribute('aria-pressed', String(dark));
    button.onclick = () => {
      dark = root.classList.toggle('dark'); button.setAttribute('aria-pressed', String(dark));
      try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
    };
  });
})();
