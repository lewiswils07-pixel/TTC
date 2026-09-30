(function(){
    var menuBtn = document.getElementById('menuBtn');
    var menuClose = document.getElementById('menuClose');
    var menuOverlay = document.getElementById('menuOverlay');

    function openMenu(){
      menuOverlay.classList.add('open');
      menuBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
    function closeMenu(){
      menuOverlay.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
    menuBtn.addEventListener('click', function(){
      menuOverlay.classList.contains('open') ? closeMenu() : openMenu();
    });
    menuClose.addEventListener('click', closeMenu);
    menuOverlay.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', closeMenu); });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') closeMenu();
    });
})();
