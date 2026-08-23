/**
 * The page's client-side logic. Served as a separate same-origin file
 * (/reset-password.js) rather than inline so it satisfies helmet's CSP
 * (`script-src 'self'` blocks inline scripts). Reads `?token=` from the URL
 * and POSTs to /api/auth/reset-password.
 */
export const resetPasswordScript = (): string => `(function () {
  var params = new URLSearchParams(window.location.search);
  var token = params.get('token') || '';
  var form = document.getElementById('form');
  var msg = document.getElementById('msg');
  var btn = document.getElementById('submit');

  function show(kind, text) { msg.className = 'msg ' + kind; msg.textContent = text; }

  if (!token) { show('err', 'This link is missing its token. Please use the link from your email.'); btn.disabled = true; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var pw = document.getElementById('pw').value;
    var pw2 = document.getElementById('pw2').value;
    if (pw.length < 6) { show('err', 'Password must be at least 6 characters.'); return; }
    if (pw !== pw2) { show('err', 'Passwords do not match.'); return; }
    btn.disabled = true; show('ok', 'Saving…');
    fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token, password: pw })
    })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (res) {
      if (res.ok && res.j.success) {
        show('ok', '✅ Password set! You can now open the MedPet app and sign in.');
        form.style.display = 'none';
      } else {
        show('err', (res.j && res.j.message) || 'Something went wrong. Please try again.');
        btn.disabled = false;
      }
    })
    .catch(function () { show('err', 'Network error. Please try again.'); btn.disabled = false; });
  });
})();`;

/**
 * Self-contained HTML page the emailed reset/invite link opens. It reads the
 * `?token=` from the URL and POSTs to /api/auth/reset-password. Served by the
 * backend so it works from any device without a separate web deploy. The script
 * lives at /reset-password.js (external, same-origin) to comply with the CSP.
 */
export const resetPasswordPage = (): string => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Set your password · MedPet</title>
  <style>
    * { box-sizing: border-box; }
    body { margin:0; font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
      background:#F1F5F4; color:#0F2A22; display:flex; min-height:100vh; align-items:center; justify-content:center; padding:20px; }
    .card { width:100%; max-width:420px; background:#fff; border:1px solid #E2EBE7; border-radius:18px; overflow:hidden;
      box-shadow:0 10px 30px rgba(15,42,34,0.08); }
    .head { background:linear-gradient(135deg,#10B981,#059669); padding:26px; text-align:center; color:#fff; }
    .head .logo { font-size:24px; font-weight:800; }
    .head .sub { font-size:13px; opacity:0.85; margin-top:4px; }
    .body { padding:26px; }
    h1 { font-size:19px; margin:0 0 6px; }
    p.lead { color:#6B8079; font-size:14px; margin:0 0 18px; line-height:1.5; }
    label { display:block; font-size:13px; font-weight:600; margin:14px 0 6px; }
    input { width:100%; padding:12px 14px; font-size:15px; border:1.5px solid #E2EBE7; border-radius:12px; background:#F7FAF9; }
    input:focus { outline:none; border-color:#10B981; background:#fff; }
    button { width:100%; margin-top:20px; padding:13px; font-size:15px; font-weight:700; color:#fff; border:none; border-radius:12px;
      background:#10B981; cursor:pointer; }
    button:disabled { opacity:0.6; cursor:not-allowed; }
    .msg { margin-top:16px; padding:12px 14px; border-radius:12px; font-size:14px; display:none; }
    .msg.err { display:block; background:#FEF2F2; color:#B91C1C; }
    .msg.ok  { display:block; background:#ECFDF5; color:#047857; }
    .hint { font-size:12px; color:#94A3A0; margin-top:14px; text-align:center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="head">
      <div class="logo">🐾 MedPet</div>
      <div class="sub">Delivery Partner Portal</div>
    </div>
    <div class="body">
      <h1>Set your password</h1>
      <p class="lead">Choose a password to activate your account. You'll use your email and this password to log in to the MedPet app.</p>
      <form id="form">
        <label for="pw">New password</label>
        <input id="pw" type="password" autocomplete="new-password" placeholder="At least 6 characters" />
        <label for="pw2">Confirm password</label>
        <input id="pw2" type="password" autocomplete="new-password" placeholder="Re-enter password" />
        <button id="submit" type="submit">Set password</button>
      </form>
      <div id="msg" class="msg"></div>
      <div class="hint">After setting your password, open the MedPet app and sign in.</div>
    </div>
  </div>

  <script src="/reset-password.js" defer></script>
</body>
</html>`;
