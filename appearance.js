(() => {
  'use strict';
  const themes = ['azul', 'petroleo', 'branco'];
  const labels = ['Azul', 'Verde petróleo', 'Branco'];
  let activeAccount = null;
  function account() {
    return typeof S !== 'undefined' && S ? String(S._id || S.u || '') : '';
  }
  function key(id) { return 'nexofield.appearance.v1:' + id; }
  function apply(theme) {
    document.documentElement.dataset.appearance = themes.includes(theme) ? theme : 'azul';
    document.querySelectorAll('.nf-appearance select').forEach(select => { select.value = document.documentElement.dataset.appearance; });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = {azul:'#0b172a',petroleo:'#063b40',branco:'#ffffff'}[document.documentElement.dataset.appearance];
  }
  function sync() {
    const id = account();
    if (id === activeAccount) return;
    activeAccount = id;
    let theme = 'azul';
    try { if (id) theme = localStorage.getItem(key(id)) || 'azul'; } catch (_) { /* Storage can be disabled. */ }
    apply(theme);
  }
  function init() {
    document.querySelectorAll('.user-bar').forEach((bar, index) => {
      const box = document.createElement('div'); box.className = 'nf-appearance';
      const label = document.createElement('label'); label.htmlFor = 'nf-appearance-' + index; label.textContent = 'Aparência';
      const select = document.createElement('select'); select.id = label.htmlFor;
      themes.forEach((value, i) => { const option = document.createElement('option'); option.value = value; option.textContent = labels[i]; select.append(option); });
      const note = document.createElement('span'); note.className = 'nf-appearance-note'; note.setAttribute('role','status');
      select.addEventListener('change', () => {
        const id = account();
        if (!id) { sync(); return; }
        apply(select.value);
        try { localStorage.setItem(key(id),select.value); note.textContent = 'Salvo para sua conta neste navegador'; }
        catch (_) { note.textContent = 'Aplicado nesta sessão; navegador não permitiu salvar'; }
      });
      box.append(label,select,note);bar.append(box);
    });
    sync();
    // Detecta entrada, restauração e saída sem interferir nas funções de autenticação.
    const observer = new MutationObserver(sync);
    ['t0','pa','pt','plog'].forEach(id => { const node = document.getElementById(id); if (node) observer.observe(node,{attributes:true,attributeFilter:['class','style']}); });
    window.addEventListener('storage', event => { if (event.key === key(account())) { activeAccount = null; sync(); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
