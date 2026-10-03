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

// Scroll reveals: groups of content fade and slide up as they come into
// view, each item ~60ms after the one before (the hero, How it works
// illustrations and connection cards have their own motion and are left
// alone). Content is fully visible without JS, and for reduced-motion
// users nothing is hidden at all.
(function(){
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // [container, items inside it (default: its direct children)]
  var GROUPS = [
    ['.head'], ['.filmstrip'], ['.plist'],
    ['.about-copy-col'], ['.about-collage'],
    ['.faq-intro'], ['.faq-list'],
    ['.mem-page .wrap'], ['.mem-plans'], ['.mem-notes'],
    ['.legal-page .wrap'],
    ['.match-page .wrap', ':scope > .swatch, :scope > h1, :scope > .match-intro'],
    ['.nf-page .wrap'],
    ['.hw-hero-copy'], ['.hw-steps-nav'], ['.hw-text'], ['.hw-table'], ['.hw-safe-grid']
  ];
  // Revealed on their own as each one scrolls into view
  var SINGLES = '.mem-offer, .mem-more, .hiw-cta, .hw-plans-foot, .joinbox, .legal-part > h2, .legal-item';

  document.documentElement.classList.add('rv');
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      // also reveal anything already scrolled past (e.g. a restored scroll position)
      if (!e.isIntersecting && e.boundingClientRect.top > 0) return;
      (e.target._rvItems || [e.target]).forEach(function(el){ el.classList.add('rv-in'); });
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });

  GROUPS.forEach(function(g){
    document.querySelectorAll(g[0]).forEach(function(box){
      var items = Array.prototype.slice.call(g[1] ? box.querySelectorAll(g[1]) : box.children)
        .filter(function(el){ return !el.classList.contains('rv-i'); });
      if (!items.length) return;
      items.forEach(function(el, i){ el.classList.add('rv-i'); el.style.setProperty('--rv-i', Math.min(i, 8)); });
      box._rvItems = items;
      io.observe(box);
    });
  });
  document.querySelectorAll(SINGLES).forEach(function(el){
    if (el.classList.contains('rv-i')) return;
    el.classList.add('rv-i');
    io.observe(el);
  });
})();
