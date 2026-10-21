/*
 * Admin2 Site ReadMe – the Site ReadMe page in Admin 2 - hibbittsdesign.org
 *
 * Admin 2 loads this file when the plugin's page is opened, and shows the element it defines: a "web
 * component", made with plain JavaScript, so there's no build step. Admin 2 sets these on window first:
 *   __GRAV_PAGE_TAG        – the element name Admin 2 will show (grav-admin2-site-readme--page)
 *   __GRAV_API_SERVER_URL  – the site's address
 *   __GRAV_API_PREFIX      – where the API is on the site (usually /api/v1)
 *   __GRAV_API_TOKEN       – the signed-in person's access token, sent with each API request
 */

// the element name Admin 2 expects (with the same name as a fallback)
const TAG = window.__GRAV_PAGE_TAG || 'grav-admin2-site-readme--page';

// added to links that open in a new tab, for screen readers (see .visually-hidden in the styles)
const NEW_TAB_NOTE = '<span class="visually-hidden"> (opens in a new tab)</span>';

/**
 * Gets the guide from this plugin's API address: { html, source, fetched_at } or { error }.
 * With refresh, the server fetches the file again, skipping its cached copy.
 */
async function fetchGuide(refresh) {
    const address = (window.__GRAV_API_SERVER_URL || '') + (window.__GRAV_API_PREFIX || '/api/v1')
        + '/admin2-site-readme/content' + (refresh ? '?refresh=1' : '');

    const headers = {};
    if (window.__GRAV_API_TOKEN) {
        headers['X-API-Token'] = window.__GRAV_API_TOKEN;
    }

    const response = await fetch(address, { headers });
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
        // the API's own error message, when it sends one
        const message = (json.errors && json.errors[0] && json.errors[0].detail) || ('The guide couldn\'t be loaded (HTTP ' + response.status + ').');
        return { error: message };
    }
    // the API wraps its answers in { data: ... }
    return json.data || {};
}

/*
 * The page's styles use Admin 2's colours (var(--foreground) and so on), so they follow its accent colour and
 * Light or Dark mode. The second value in each var() is a fallback.
 */
const STYLES = `
    /* the line below the guide, with its source and Refresh button */
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;
        margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border, #e5e7eb);
        font-size: 0.875rem; color: var(--muted-foreground, #6b7280); }
    .toolbar a { color: var(--primary, #2563eb); }
    button { font: inherit; padding: 0.35rem 0.8rem; border-radius: 0.375rem; cursor: pointer;
        border: 1px solid var(--border, #d1d5db); background: var(--background, #fff); color: var(--foreground, #111827); }
    button:hover { border-color: var(--primary, #2563eb); }
    .message { padding: 1rem; border-radius: 0.5rem; border: 1px solid var(--border, #d1d5db);
        color: var(--muted-foreground, #6b7280); }
    /* the note above an older copy, slimmer than a full message */
    .notice { max-width: 50rem; margin: 0 0 1.25rem; padding: 0.6rem 0.9rem; font-size: 0.875rem; }

    /* "On this page" sits beside the guide when there's room. A container query (container-type) checks the
       page's own width, not the window's, which includes Admin's sidebar. position: relative keeps the
       screen-reader-only notes (see .visually-hidden) inside this page; without it, they're placed against the
       whole Admin window, which then scrolls past the end of the page */
    :host { display: block; position: relative; container-type: inline-size; }
    .layout { display: block; }
    .main { min-width: 0; }
    .contents-side { display: none; }
    @container (min-width: 60rem) {
        .layout { display: grid; grid-template-columns: minmax(0, 50rem) 14rem; gap: 2.5rem; align-items: start; }
        .contents-side { display: block; position: sticky; top: 1rem; max-height: calc(100vh - 2rem); overflow-y: auto; }
        .contents-box { display: none; }
    }
    .contents-title { margin: 0 0 0.5rem; font-size: 0.8125rem; font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.06em; color: var(--muted-foreground, #6b7280); }
    .contents-side ul, .contents-box ul { list-style: none; margin: 0; padding: 0; }
    .contents-side li { margin: 0; }
    .contents-side a { display: block; padding: 0.3rem 0.6rem; border-inline-start: 2px solid var(--border, #e5e7eb);
        font-size: 0.95rem; line-height: 1.4; color: var(--muted-foreground, #6b7280); text-decoration: none; }
    .contents-side a:hover, .contents-side a:focus-visible { color: var(--foreground, #111827); border-inline-start-color: var(--primary, #2563eb); }
    /* the section being read (see highlightCurrentSection()) */
    .contents-side a[aria-current="location"] { color: var(--primary, #2563eb); border-inline-start-color: var(--primary, #2563eb); font-weight: 600; }
    /* deeper headings (### and ####), indented a step per level and a little smaller */
    .contents-side .level-3 a { padding-inline-start: 1.4rem; font-size: 0.875rem; }
    .contents-side .level-4 a { padding-inline-start: 2.2rem; font-size: 0.875rem; }
    .contents-box .level-3 { margin-inline-start: 1rem; }
    .contents-box .level-4 { margin-inline-start: 2rem; }

    /* narrower screens: a box above the guide that opens when tapped; its "›" turns when open */
    .contents-box { margin: 0 0 1.5rem; padding: 0.5rem 0.875rem; border: 1px solid var(--border, #e5e7eb); border-radius: 0.5rem;
        max-width: 50rem; color: var(--foreground, #111827); }
    .contents-box summary { display: flex; justify-content: space-between; align-items: center; list-style: none;
        font-weight: 600; cursor: pointer; }
    .contents-box summary::-webkit-details-marker { display: none; }
    /* the / "" part marks the arrow as decoration, so screen readers don't read it out; browsers that don't
       understand it use the plain content line before it */
    .contents-box summary::after { content: "\\203A"; content: "\\203A" / ""; font-size: 1.4em; line-height: 1; opacity: 0.6; transition: transform 0.15s ease; }
    .contents-box[open] summary::after { transform: rotate(90deg); }
    .contents-box ul { margin: 0.5rem 0 0.25rem; }
    .contents-box li { margin: 0.3rem 0; }
    .contents-box a { color: var(--primary, #2563eb); }
    @media (prefers-reduced-motion: reduce) { .contents-box summary::after { transition: none; } }

    /* text for screen readers only, such as "(opens in a new tab)": kept on the page, but not shown */
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

    /* a little space above a heading when it's jumped to */
    .guide [id] { scroll-margin-top: 1rem; }
    .guide [id]:focus { outline: none; }

    /* the guide itself: a readable line length and spacing */
    .guide { max-width: 50rem; line-height: 1.65; color: var(--foreground, #111827); }
    .guide h1, .guide h2, .guide h3, .guide h4 { line-height: 1.25; margin: 1.75em 0 0.6em; }
    .guide h1 { font-size: 1.9rem; margin-top: 0; }
    .guide h2 { font-size: 1.45rem; padding-bottom: 0.3em; border-bottom: 1px solid var(--border, #e5e7eb); }
    .guide h3 { font-size: 1.15rem; }
    .guide p, .guide ul, .guide ol, .guide table, .guide pre, .guide blockquote { margin: 0 0 1em; }
    .guide ul, .guide ol { padding-inline-start: 1.5rem; }
    .guide li { margin: 0.25em 0; }
    .guide a { color: var(--primary, #2563eb); }
    .guide img { max-width: 100%; height: auto; }
    .guide code { font-size: 0.9em; padding: 0.15em 0.35em; border-radius: 0.25rem; background: var(--muted, #f3f4f6); }
    .guide pre { padding: 0.9rem 1rem; border-radius: 0.5rem; overflow-x: auto; background: var(--muted, #f3f4f6); }
    .guide pre code { padding: 0; background: none; }
    .guide blockquote { margin-inline: 0; padding-inline-start: 1rem; border-inline-start: 3px solid var(--border, #d1d5db);
        color: var(--muted-foreground, #6b7280); }
    .guide table { border-collapse: collapse; display: block; overflow-x: auto; }
    .guide th, .guide td { padding: 0.4rem 0.75rem; border: 1px solid var(--border, #e5e7eb); text-align: start; }
    .guide hr { border: 0; border-top: 1px solid var(--border, #e5e7eb); margin: 2em 0; }

    /* task list items (- [ ] in Markdown), with the checkbox in place of the bullet */
    .guide li.task { list-style: none; }
    .guide .task-box { margin: 0 0.5em 0 -1.35em; vertical-align: -0.1em; accent-color: var(--primary, #2563eb); }

    /* GitHub-style notes (> [!NOTE] and so on): a coloured bar and label for each kind. light-dark() picks the
       first colour in Light mode and the second in Dark mode (Admin 2 tells the browser which), as on GitHub */
    .guide .alert { color: var(--foreground, #111827); border-inline-start-color: var(--alert-colour); }
    .guide .alert-title { margin-bottom: 0.25em; font-weight: 600; color: var(--alert-colour); }
    .guide .alert > :last-child { margin-bottom: 0; }
    .guide .alert-note { --alert-colour: light-dark(#0969da, #4493f8); }
    .guide .alert-tip { --alert-colour: light-dark(#1a7f37, #3fb950); }
    .guide .alert-important { --alert-colour: light-dark(#8250df, #ab7df8); }
    .guide .alert-warning { --alert-colour: light-dark(#9a6700, #d29922); }
    .guide .alert-caution { --alert-colour: light-dark(#cf222e, #f85149); }
`;

class Admin2SiteReadMePage extends HTMLElement {
    /*
     * Runs when Admin 2 adds the element. It draws itself in a "shadow root", so its styles and Admin's
     * don't affect each other.
     */
    connectedCallback() {
        if (!this.shadowRoot) {
            this.attachShadow({ mode: 'open' });
        }
        this.load(false);
    }

    // Shows "Loading…", asks for the guide, then shows it (or the reason it can't be shown)
    async load(refresh) {
        // role="status" has screen readers announce the message when it appears
        this.show('<p class="message" role="status">Loading…</p>');

        let guide;
        try {
            guide = await fetchGuide(refresh);
        } catch (error) {
            guide = { error: 'The guide couldn\'t be loaded (' + error.message + ').' };
        }

        if (guide.error) {
            this.show('<p class="message" role="status">' + escapeText(guide.error) + '</p>');
            return;
        }

        // where the guide is from (a link, or a user:// file name, which can't be a link) and when it was
        // fetched or changed
        const from = guide.local
            ? 'From ' + escapeText(guide.source) + (guide.fetched_at ? ', updated ' + escapeText(new Date(guide.fetched_at).toLocaleString()) : '')
            : 'From <a href="' + escapeText(guide.source) + '" target="_blank" rel="noopener">' + escapeText(shortAddress(guide.source)) + NEW_TAB_NOTE + '</a>' +
              (guide.fetched_at ? ', fetched ' + escapeText(new Date(guide.fetched_at).toLocaleString()) : '');

        // the guide (made safe on the server, in classes/ReadMeController.php), with a note above it for an older
        // copy, and where it's from and a Refresh button below it. A file in this site is read fresh each time,
        // so it has no Refresh button
        this.show(
            '<div class="layout">' +
                '<div class="main">' +
                    (guide.notice ? '<p class="message notice" role="status">' + escapeText(guide.notice) + '</p>' : '') +
                    '<article class="guide">' + guide.html + '</article>' +
                    '<div class="toolbar">' +
                        '<span>' + from + '</span>' +
                        (guide.local ? '' : '<button type="button" class="refresh">Refresh</button>') +
                    '</div>' +
                '</div>' +
            '</div>'
        );
        if (!guide.local) {
            const refreshButton = this.shadowRoot.querySelector('.refresh');
            refreshButton.addEventListener('click', () => this.load(true));
            // after a Refresh, the page is drawn again, button and all; putting focus back on the new button keeps
            // keyboard and screen reader users where they were
            if (refresh) {
                refreshButton.focus({ preventScroll: true });
            }
        }

        this.addAdminLinks();
        this.rememberTicks(guide.source);

        // Hide File Title setting: the file's title (its first heading) repeats what the Admin page's own title
        // already says, so it's left out, and so isn't in the "On this page" list either. 1 hides a # title, 2 a
        // # or ## title, and 0 neither
        let titleLevels = [];
        if (guide.hide_title === 1) {
            titleLevels = ['H1'];
        } else if (guide.hide_title === 2) {
            titleLevels = ['H1', 'H2'];
        }
        const firstHeading = this.shadowRoot.querySelector('.guide h1, .guide h2, .guide h3, .guide h4, .guide h5, .guide h6');
        if (firstHeading && titleLevels.includes(firstHeading.tagName)) {
            // a ### (or smaller) heading straight after the title is its subtitle, such as a README's tagline, so
            // it's left out too; a ## straight after the title starts a real section, so it stays
            const nextElement = firstHeading.nextElementSibling;
            if (nextElement && ['H3', 'H4', 'H5', 'H6'].includes(nextElement.tagName)) {
                nextElement.remove();
            }
            firstHeading.remove();
        }

        this.addHeadingIds();
        this.addContentsList(guide.contents_levels);

        // links to other sites open in a new tab, so Admin stays open; a hidden note tells screen reader users.
        // This comes after the headings' ids and the "On this page" list, so the note isn't part of their text
        this.shadowRoot.querySelectorAll('.guide a[href^="http"]').forEach((link) => {
            link.target = '_blank';
            link.rel = 'noopener';
            link.insertAdjacentHTML('beforeend', NEW_TAB_NOTE);
        });

        // links to the guide's own sections (such as #quick-start) scroll there, and never change Admin's address
        this.shadowRoot.querySelectorAll('.guide a[href^="#"]').forEach((link) => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const id = decodeURIComponent(link.getAttribute('href').slice(1));
                if (this.shadowRoot.getElementById(id)) {
                    this.scrollToSection(id);
                }
            });
        });
    }

    /*
     * Links with an admin: address open a screen in Admin, such as admin:/pages for Pages or admin:/config/site
     * for the site's settings, so the same file works on any site, whatever its address. Each link gets the
     * screen's real address (so it can still be opened in a new tab), and a plain click moves Admin there
     * without reloading the page, using the navigate function Admin 2 provides.
     */
    addAdminLinks() {
        // where Admin is, such as /admin (Admin 2 provides it; the page's own address is the fallback)
        const adminBase = window.__GRAV_ADMIN_BASE || location.pathname.split('/plugin/')[0];

        this.shadowRoot.querySelectorAll('.guide a[href^="admin:"]').forEach((link) => {
            // admin:/pages and admin:pages both become /pages
            const screen = '/' + link.getAttribute('href').slice('admin:'.length).replace(/^\/+/, '');
            link.href = adminBase + screen;

            link.addEventListener('click', (event) => {
                // Ctrl, Cmd or Shift with a click still opens a new tab or window, as usual
                if (window.__GRAV_NAVIGATE && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                    event.preventDefault();
                    window.__GRAV_NAVIGATE(adminBase + screen);
                }
            });
        });
    }

    /*
     * Task list checkboxes (- [ ] in Markdown) can be ticked off, so people can follow a list of steps. What's
     * ticked is remembered in this browser only, for this file; until then, the file's own [x] ticks are shown.
     */
    rememberTicks(source) {
        const boxes = [...this.shadowRoot.querySelectorAll('.guide .task-box')];
        if (boxes.length === 0) {
            return;
        }

        const storageKey = 'admin2-site-readme-ticks:' + source;
        // the numbers of the ticked boxes, such as [0, 2]; the browser's storage can be turned off (such as in
        // a private window), so if it can't be read, nothing is remembered
        let ticked = null;
        try {
            ticked = JSON.parse(localStorage.getItem(storageKey));
        } catch (error) {
            ticked = null;
        }

        boxes.forEach((box, number) => {
            // the step's text, so screen readers say what each checkbox is for
            box.setAttribute('aria-label', box.parentElement.textContent.trim());
            if (Array.isArray(ticked)) {
                box.checked = ticked.includes(number);
            }

            box.addEventListener('change', () => {
                const nowTicked = [];
                boxes.forEach((otherBox, otherNumber) => {
                    if (otherBox.checked) {
                        nowTicked.push(otherNumber);
                    }
                });
                try {
                    localStorage.setItem(storageKey, JSON.stringify(nowTicked));
                } catch (error) {
                    // storage is turned off: the ticks still work, but aren't remembered
                }
            });
        });
    }

    /*
     * Gives each heading an id from its text, as GitHub does, so a README's section links (such as #quick-start
     * for "Quick Start") work: lower case, punctuation removed, spaces to hyphens, and -1, -2 for repeats.
     */
    addHeadingIds() {
        const usedIds = new Set();
        this.shadowRoot.querySelectorAll('.guide h1, .guide h2, .guide h3, .guide h4, .guide h5, .guide h6').forEach((heading) => {
            // keep an id the Markdown gave the heading itself, such as ## Setup {#setup}
            if (heading.id) {
                usedIds.add(heading.id);
                return;
            }
            // \p{L} and \p{N} match letters and numbers in any language, such as é or ü
            const id = heading.textContent.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-') || 'section';
            let unique = id;
            for (let n = 1; usedIds.has(unique); n++) {
                unique = id + '-' + n;
            }
            usedIds.add(unique);
            heading.id = unique;
            // so the heading can take focus after a jump (for keyboard and screen reader users)
            heading.tabIndex = -1;
        });
    }

    // Scrolls to the heading with this id, and moves keyboard focus to it
    scrollToSection(id) {
        const heading = this.shadowRoot.getElementById(id);
        const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        heading.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
        heading.focus({ preventScroll: true });
    }

    /*
     * Adds an "On this page" list of the guide's sections: beside it on wider screens, in a box above it on
     * narrower ones. The sections are the file's ## headings, or, in a file with fewer than two of them (such as
     * a Grav page that uses ### for its sections), the top heading level it does use. deepestLevel (from the
     * plugin's settings) is 2 to list just those headings, or 3 (the default) or 4 to list one or two levels
     * below them too. Skipped when the file has fewer than two sections.
     */
    addContentsList(deepestLevel) {
        // the top level of the file's sections: ## if it has at least two, otherwise ###, ####, and so on
        let topLevel = 0;
        for (let level = 2; level <= 6; level++) {
            if (this.shadowRoot.querySelectorAll('.guide h' + level).length >= 2) {
                topLevel = level;
                break;
            }
        }
        if (topLevel === 0) {
            return;
        }

        // the headings to list, such as '.guide h2, .guide h3' for ## sections at the default setting; the
        // setting counts levels from the sections' own level, so for ### sections that's '.guide h3, .guide h4'
        const levelsBelow = (deepestLevel || 3) - 2;
        const lowestLevel = Math.min(6, topLevel + levelsBelow);
        const selectors = [];
        for (let level = topLevel; level <= lowestLevel; level++) {
            selectors.push('.guide h' + level);
        }
        let headings = [...this.shadowRoot.querySelectorAll(selectors.join(', '))];

        // start at the first section heading: headings before it belong to the file's title block (such as a
        // subtitle under a README's title), not to its sections. There's always one, as the check above makes sure
        const firstSection = headings.findIndex((heading) => heading.tagName === 'H' + topLevel);
        headings = headings.slice(firstSection);

        // one link for each heading, using the id addHeadingIds() gave it. The level-3 and level-4 classes indent
        // headings one and two levels below the sections, whatever level the sections are
        const items = headings.map((heading) => {
            const id = escapeText(heading.id);
            // how far below the sections this heading is: 0 for a section itself, so level-2, then level-3, …
            const depth = Number(heading.tagName.slice(1)) - topLevel;
            const level = 'level-' + (2 + depth);
            return '<li class="' + level + '"><a href="#' + id + '" data-target="' + id + '">' + escapeText(heading.textContent.trim()) + '</a></li>';
        }).join('');

        // the same list twice; the styles show one or the other
        const side = document.createElement('nav');
        side.className = 'contents-side';
        side.setAttribute('aria-label', 'On this page');
        side.innerHTML = '<p class="contents-title">On this page</p><ul>' + items + '</ul>';
        this.shadowRoot.querySelector('.layout').appendChild(side);

        const box = document.createElement('details');
        box.className = 'contents-box';
        box.innerHTML = '<summary>On this page</summary><ul>' + items + '</ul>';
        this.shadowRoot.querySelector('.main').prepend(box);

        // scroll instead of following the #link: Admin 2 is a single-page app, so changing its address could
        // move it to another screen
        this.shadowRoot.querySelectorAll('[data-target]').forEach((link) => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                this.scrollToSection(link.dataset.target);
            });
        });

        this.highlightCurrentSection(headings, side);
    }

    /*
     * Highlights the section being read: the last heading above a line 150px from the top. An
     * IntersectionObserver reruns this as headings cross that line, whichever part of Admin scrolls.
     */
    highlightCurrentSection(headings, side) {
        const highlight = () => {
            let currentId = headings[0].id;
            for (const heading of headings) {
                if (heading.getBoundingClientRect().top > 150) {
                    break;
                }
                currentId = heading.id;
            }
            // at the end of the guide, short last sections can't reach that line, so use the last one in view
            const guideEnd = this.shadowRoot.querySelector('.guide').getBoundingClientRect().bottom;
            if (guideEnd <= window.innerHeight) {
                for (const heading of headings) {
                    if (heading.getBoundingClientRect().top < window.innerHeight) {
                        currentId = heading.id;
                    }
                }
            }
            // aria-current="location" tells screen readers this link is where the reader is on the page (some say
            // "current location"); the styles highlight it too
            side.querySelectorAll('a').forEach((link) => {
                if (link.dataset.target === currentId) {
                    link.setAttribute('aria-current', 'location');
                } else {
                    link.removeAttribute('aria-current');
                }
            });
        };

        // stop watching the previous guide's headings, after a Refresh
        if (this.observer) {
            this.observer.disconnect();
        }
        // rootMargin moves the observer's top edge down to the same 150px line
        this.observer = new IntersectionObserver(highlight, { rootMargin: '-150px 0px 0px 0px', threshold: [0, 1] });
        headings.forEach((heading) => this.observer.observe(heading));
        highlight();
    }

    // Runs when Admin 2 removes the page: stop watching the headings
    disconnectedCallback() {
        if (this.observer) {
            this.observer.disconnect();
        }
    }

    // Replaces what the element shows, keeping its styles
    show(html) {
        this.shadowRoot.innerHTML = '<style>' + STYLES + '</style>' + html;
    }
}

// Makes text safe to put inside HTML, so characters such as < and & show as themselves
function escapeText(text) {
    return String(text ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
}

// A shorter form of the file's address for the toolbar, such as github.com/owner/repo/README.md
function shortAddress(address) {
    return String(address || '').replace(/^https:\/\/(raw\.githubusercontent\.com|github\.com)\//, 'github.com/')
        .replace(/^https:\/\//, '');
}

// Defines the element once (Admin 2 may load this file again when the page is reopened)
if (!customElements.get(TAG)) {
    customElements.define(TAG, Admin2SiteReadMePage);
}
