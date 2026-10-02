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

    // DEMO sign-in (see demo-auth.js; localStorage only, not real auth): once
    // this browser is "signed in", the nav and menu "Sign in" links become
    // "Dashboard" links instead.
    function refreshSignIn(){
      try {
        if (window.localStorage.getItem('ttc_signed_in') !== 'true') return;
        document.querySelectorAll('nav a[href="signin.html"], .menu-overlay a[href="signin.html"]').forEach(function(a){
          a.setAttribute('href', 'dashboard.html');
          var t = a.lastChild;
          if (t && t.nodeType === 3) t.nodeValue = t.nodeValue.replace('Sign in', 'Dashboard');
        });
      } catch (e) {}
    }
    refreshSignIn();
    window.TTCRefreshNavSignIn = refreshSignIn;   // called after the join form "signs in"

    // Floating nav bar gains its shadow once the page has scrolled.
    var nav = document.querySelector('nav');
    function onScroll(){ nav.classList.toggle('scrolled', window.scrollY > 8); }
    if (nav) {
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }
})();
