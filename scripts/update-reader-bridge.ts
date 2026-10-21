import fs from "fs";

const file = "docs-desktop/src-tauri/src/bridge/reader-bridge.html";
let code = fs.readFileSync(file, "utf8");

const startIdx = code.indexOf("function initMsLearnDocsUI() {");
const endIdx = code.indexOf("function initShadcnDocsUI() {");

if (startIdx === -1 || endIdx === -1) {
  throw new Error("Could not find function initMsLearnDocsUI boundaries");
}

const replacement = `function initMsLearnDocsUI() {
    if (SITE_ID !== 'powershell' && SITE_ID !== 'cmd') return;
    try {
      var leftContainer = document.getElementById('left-container');
      if (leftContainer) {
        leftContainer.classList.remove('display-none-until-layout-restored');
        leftContainer.classList.remove('display-none');
      }

      var tocNav = document.getElementById('affixed-left-container') || document.getElementById('ms--toc-content');
      if (tocNav) {
        var existingTree = tocNav.querySelector('.docx-ms-toc-tree');
        if (!existingTree) {
          var links = [];
          var allLinks = document.querySelectorAll('main a[href], .layout-body-main a[href], table a[href]');
          var seenHref = {};
          for (var i = 0; i < allLinks.length; i++) {
            var href = allLinks[i].getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('http')) continue;
            var cleanHref = href.split('?')[0].split('#')[0];
            if ((SITE_ID === 'cmd' && cleanHref.indexOf('/windows-commands/') !== -1) ||
                (SITE_ID === 'powershell' && cleanHref.indexOf('/powershell/') !== -1)) {
              if (!seenHref[cleanHref]) {
                seenHref[cleanHref] = true;
                var label = (allLinks[i].textContent || '').trim();
                if (label && label.length > 1 && label.length < 50 && !label.startsWith('http')) {
                  links.push({ label: label, href: cleanHref });
                }
              }
            }
          }

          if (links.length > 5) {
            links.sort(function(a, b) { return a.label.localeCompare(b.label); });
            var wrapper = document.createElement('div');
            wrapper.className = 'docx-ms-toc-tree';
            wrapper.innerHTML = 
              '<div class="docx-ms-toc-header">' +
                '<input type="search" class="docx-ms-filter-input" placeholder="Filter ' + (SITE_ID === 'cmd' ? 'commands' : 'topics') + '..." />' +
              '</div>' +
              '<ul class="docx-ms-toc-list"></ul>';

            var ul = wrapper.querySelector('ul');
            for (var j = 0; j < links.length; j++) {
              var li = document.createElement('li');
              li.className = 'docx-ms-toc-item';
              var a = document.createElement('a');
              a.href = links[j].href;
              a.textContent = links[j].label;
              li.appendChild(a);
              ul.appendChild(li);
            }

            var filterInput = wrapper.querySelector('.docx-ms-filter-input');
            if (filterInput && ul) {
              filterInput.addEventListener('input', function(e) {
                var q = (e.target.value || '').toLowerCase().trim();
                var items = ul.querySelectorAll('.docx-ms-toc-item');
                for (var k = 0; k < items.length; k++) {
                  var txt = items[k].textContent.toLowerCase();
                  items[k].style.display = (!q || txt.indexOf(q) !== -1) ? '' : 'none';
                }
              });
            }

            tocNav.appendChild(wrapper);
          }
        }
      }

      var curPath = window.location.pathname.replace(/\\/$/, '');
      var links2 = document.querySelectorAll('.docx-ms-toc-item a[href]');
      for (var m = 0; m < links2.length; m++) {
        var al = links2[m];
        var hl = (al.getAttribute('href') || '').replace(/\\/$/, '');
        if (hl === curPath) {
          al.classList.add('active');
          var p = al.parentElement;
          while (p) {
            if (p.tagName === 'DETAILS') p.open = true;
            p = p.parentElement;
          }
        }
      }
    } catch (e) {}
  }

  `;

code = code.slice(0, startIdx) + replacement + code.slice(endIdx);
fs.writeFileSync(file, code);
console.log("Successfully updated initMsLearnDocsUI in reader-bridge.html");
