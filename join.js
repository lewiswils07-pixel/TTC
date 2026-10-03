// Founding-member sign-up: saves the join form to the Supabase "waitlist"
// table (see supabase/migrations/*_waitlist.sql). The key below is the
// public "anon" key. It is meant to be in the browser: row-level security
// only lets it add a row, never read the list. Never put the service_role
// key here.
window.TTCWaitlist = (function(){
  var URL = 'https://uibywuqdbkubqqumwzuw.supabase.co';
  var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpYnl3dXFkYmt1YnFxdW13enV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MDc4NDEsImV4cCI6MjEwNTk4Mzg0MX0.RaXfnoFr48-9CD0dvuQBLDlEb4un3a-Fyo5eVDa784k';

  // Resolves when saved (or already on the list); rejects if it couldn't be saved.
  function add(firstName, email, home){
    return fetch(URL + '/rest/v1/waitlist', {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': 'Bearer ' + ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        first_name: firstName.trim(),
        email: email.trim(),
        home: home.trim() || null
      })
    }).then(function(res){
      // 409 = this email is already on the list: treat it as a success, and
      // don't tell the visitor (that would reveal who has signed up).
      if (res.ok || res.status === 409) return;
      throw new Error('waitlist ' + res.status);
    });
  }

  // Wires a join form: honeypot, validation, busy state, success and error.
  function bind(form, success, onSaved){
    var error = form.querySelector('.form-error');
    var button = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', function(e){
      e.preventDefault();
      if (form.website && form.website.value) return; // spam trap
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var name = form.first_name.value, mail = form.email.value;
      error.hidden = true;
      button.disabled = true;
      button.textContent = 'Joining…';
      add(name, mail, form.home.value).then(function(){
        if (onSaved) onSaved(name, mail);
        success.hidden = false;
        form.reset();
      }, function(){
        error.hidden = false;
      }).then(function(){
        button.disabled = false;
        button.textContent = 'Join free';
      });
    });
  }

  return { add: add, bind: bind };
})();
