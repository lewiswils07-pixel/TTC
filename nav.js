// Phone menu: the "Menu" button shows or hides the list of links under the
// header. Closes again on Escape, or when a link is chosen.
(function(){
  var btn = document.getElementById('menuBtn');
  var menu = document.getElementById('mobileNav');
  if (!btn || !menu) return;

  function setOpen(open){
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? 'Close' : 'Menu';
  }
  btn.addEventListener('click', function(){ setOpen(menu.hidden); });
  menu.addEventListener('click', function(e){ if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && !menu.hidden) { setOpen(false); btn.focus(); }
  });
})();
