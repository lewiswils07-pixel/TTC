// ─────────────────────────────────────────────────────────────────────────
// DEMO "SIGN-IN" — NOT REAL AUTHENTICATION.
//
// Together Travel Club has no backend, database or account system yet. This
// file only *simulates* being signed in so the member dashboard can be
// previewed, by putting a flag in this browser's localStorage:
//
//   ttc_signed_in = "true"
//   ttc_member    = {"name": "...", "email": "...", "since": "<ISO date>"}
//
// - Nothing is sent anywhere; it never leaves this browser.
// - Passwords are NEVER read, checked or stored. The sign-in form's password
//   field is purely decorative and its value is discarded.
// - Anyone can "sign in" with any email, and anyone with access to this
//   browser can read or change these values. It provides no security at all.
//
// Replace all of this with a real authentication service before the site
// handles real members.
// ─────────────────────────────────────────────────────────────────────────
(function(){
  var FLAG = 'ttc_signed_in', MEMBER = 'ttc_member';

  // localStorage can be unavailable (private windows, blocked storage), so
  // every access is guarded and the demo simply behaves as "signed out".
  function read(key){ try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function write(key, value){ try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; } }
  function remove(key){ try { window.localStorage.removeItem(key); } catch (e) {} }

  function member(){
    try { return JSON.parse(read(MEMBER) || 'null') || {}; } catch (e) { return {}; }
  }

  window.TTCDemoAuth = {
    // Mark this browser as "signed in". Only a name and email are kept; if no
    // name is given (the sign-in form only asks for an email), keep the name
    // from an earlier sign-up with the same email, if there was one.
    signIn: function(name, email){
      var prev = member();
      var clean = { email: String(email || '').trim(), since: prev.since || new Date().toISOString() };
      var n = String(name || '').trim();
      if (!n && prev.email && clean.email && prev.email.toLowerCase() === clean.email.toLowerCase()) n = prev.name || '';
      clean.name = n;
      var ok = write(MEMBER, JSON.stringify(clean));
      return write(FLAG, 'true') && ok;
    },
    signOut: function(){ remove(FLAG); remove(MEMBER); },
    isSignedIn: function(){ return read(FLAG) === 'true'; },
    member: member
  };
})();
