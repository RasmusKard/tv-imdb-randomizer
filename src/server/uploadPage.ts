/**
 * The page the phone loads. Served as one string by the in-app upload server —
 * no build step, no bundler, and the only script is the ~30 lines at the
 * bottom: read the picked file as text, POST it to the very URL the page came
 * from, show the JSON answer.
 *
 * Instructions point at the two exports IMDb actually offers. Both carry the
 * `Const` column, so both import cleanly.
 */
export const UPLOAD_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>what.watch — import your IMDb list</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; background: #0F1329; color: #EDEAE0;
    font: 16px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif;
    display: flex; justify-content: center; padding: 32px 16px 64px;
  }
  main { width: 100%; max-width: 560px; }
  h1 { font-size: 28px; letter-spacing: -0.02em; margin: 0 0 4px; }
  h1 span { color: #FFB02E; }
  .sub { color: #838BB4; margin: 0 0 28px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.12em;
       color: #838BB4; margin: 28px 0 10px; }
  ol { margin: 0; padding-left: 22px; }
  li { margin: 8px 0; }
  a { color: #55CFE6; }
  code { background: #1A1F3D; border: 1px solid #2A3159; border-radius: 4px;
         padding: 1px 6px; font-size: 14px; }
  #drop {
    border: 2px dashed #2A3159; border-radius: 12px; padding: 36px 20px;
    text-align: center; margin-top: 8px; transition: border-color .15s, background .15s;
  }
  #drop.over { border-color: #FFB02E; background: #1A1F3D; }
  #drop p { margin: 0 0 14px; color: #838BB4; }
  button {
    background: #C98622; color: #171200; border: 0; border-radius: 8px;
    padding: 12px 22px; font-size: 16px; font-weight: 700; cursor: pointer;
  }
  button:disabled { opacity: .5; cursor: default; }
  #status { margin-top: 18px; min-height: 24px; }
  #status.ok { color: #7ddf8f; }
  #status.err { color: #FF7A6B; }
  #status.busy { color: #838BB4; }
  details { margin-top: 26px; color: #838BB4; font-size: 14px; }
  summary { cursor: pointer; }
</style>
</head>
<body>
<main>
  <h1>what<span>.</span>watch</h1>
  <p class="sub">Import your IMDb list into the account signed in on the TV.</p>

  <h2>Get the file from IMDb</h2>
  <ol>
    <li>On this device, go to <a href="https://www.imdb.com/" target="_blank" rel="noopener">imdb.com</a> and sign in.</li>
    <li>Open your ratings page: account menu (top right) &rarr; <strong>Your ratings</strong>.<br>
        <span style="color:#838BB4">Direct link: <a href="https://www.imdb.com/user/me/ratings" target="_blank" rel="noopener">imdb.com/user/me/ratings</a></span></li>
    <li>Press <strong>Export</strong> (top right of the list). <code>ratings.csv</code> downloads.</li>
  </ol>
  <details>
    <summary>Watchlist or a custom list instead?</summary>
    <p style="margin:8px 0 0">Open the list on imdb.com, choose the three-dot menu &rarr; <strong>Export</strong>.
    Any IMDb export works &mdash; the import reads its <code>Const</code> column.</p>
  </details>

  <h2>Send it to the TV</h2>
  <div id="drop">
    <p>Drop the CSV here, or pick it from your downloads</p>
    <input type="file" id="file" accept=".csv,text/csv" hidden>
    <button id="pick">Choose file&hellip;</button>
  </div>
  <div id="status"></div>
</main>
<script>
  var drop = document.getElementById('drop');
  var input = document.getElementById('file');
  var pick = document.getElementById('pick');
  // not "status": window.status is a reserved string global and a top-level
  // var would bind to it, swallowing every update silently
  var statusLine = document.getElementById('status');

  function say(kind, text) { statusLine.className = kind; statusLine.textContent = text; }

  function send(file) {
    if (!file) return;
    say('busy', 'Uploading ' + file.name + ' (' + Math.round(file.size / 1024) + ' KB)\u2026');
    pick.disabled = true;
    file.text().then(function (text) {
      return fetch(location.pathname, { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: text })
        .then(function (res) { return res.json(); })
        .then(function (out) {
          if (out.ok) {
            say('ok', 'Done \u2014 ' + out.added + ' new, ' + out.total + ' watched in total. Look at the TV.');
          } else {
            say('err', out.error || 'The TV rejected the file.');
          }
        });
    }).catch(function (e) {
      say('err', 'Upload failed: ' + e);
    }).finally(function () { pick.disabled = false; input.value = ''; });
  }

  pick.addEventListener('click', function () { input.click(); });
  input.addEventListener('change', function () { send(input.files[0]); });
  ['dragover', 'dragenter'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
  });
  drop.addEventListener('drop', function (e) { send(e.dataTransfer.files[0]); });
</script>
</body>
</html>`;
