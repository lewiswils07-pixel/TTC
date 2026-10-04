// Trust badges for member profile cards. Shared by every page that renders
// a profile, so the labels, icons and order stay identical everywhere.
// A member's `badges` array lists the keys they've earned; only earned
// badges are shown. Verification comes with Sodalis+, so a member without the
// `id` badge (a free member) gets a plain "Not ID verified" label instead,
// so every profile makes its verification status clear.
(function(){
  var ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
  var BADGES = {
    id: {
      label: 'ID verified',
      icon: '<svg ' + ICON_ATTRS + '><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>'
    },
    video: {
      label: 'Video intro’d',
      icon: '<svg ' + ICON_ATTRS + '><rect x="3" y="7" width="12" height="10" rx="2"/><path d="M15 10.5l6-3.5v10l-6-3.5"/></svg>'
    },
    social: {
      label: 'Social linked',
      icon: '<svg ' + ICON_ATTRS + '><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1 1"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1-1"/></svg>'
    }
  };
  var ORDER = ['id', 'video', 'social'];

  var UNVERIFIED = '<li class="tbadge tbadge-none"><svg ' + ICON_ATTRS + '><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z"/></svg><span>Not ID verified</span></li>';

  function html(keys){
    keys = keys || [];
    var items = ORDER.filter(function(k){ return keys.indexOf(k) !== -1; }).map(function(k){
      return '<li class="tbadge tbadge-' + k + '">' + BADGES[k].icon + '<span>' + BADGES[k].label + '</span></li>';
    });
    if (keys.indexOf('id') === -1) items.unshift(UNVERIFIED);
    return '<ul class="tbadges" aria-label="Trust badges">' + items.join('') + '</ul>';
  }

  window.TTCBadges = { html: html, BADGES: BADGES, ORDER: ORDER };
})();
