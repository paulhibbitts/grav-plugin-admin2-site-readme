/*
 * Admin2 Site ReadMe – the Site ReadMe page in Admin 2 - hibbittsdesign.org
 *
 * Admin 2 loads this file when someone opens the plugin's page, and shows the custom element it defines.
 * It's a "web component": a reusable HTML element made with plain JavaScript, so there's no build step.
 *
 * Admin 2 gives every plugin page a few things on window before this file runs:
 *   __GRAV_PAGE_TAG        – the element name Admin 2 will show (grav-admin2-site-readme--page)
 *   __GRAV_API_SERVER_URL  – the site's address
 *   __GRAV_API_PREFIX      – where the API is on the site (usually /api/v1)
 *   __GRAV_API_TOKEN       – the signed-in person's access token, sent with each API request
 */

// the element name Admin 2 expects; the fallback is the same name, in case it isn't given
const TAG = window.__GRAV_PAGE_TAG || 'grav-admin2-site-readme--page';

/**
 * Asks this plugin's API address for the guide. With refresh, the server fetches the file again now
 * instead of using its cached copy. Returns { html, source, fetched_at } or { error }.
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
 * The page's styles. They use Admin 2's own colour settings (var(--foreground) and so on), so the guide
 * follows Admin's accent colour and Light or Dark mode; the second value in each var() is used if
 * Admin's setting isn't there.
 */
const STYLES = `
    /* the line below the guide: a thin line above it separates it from the guide */
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;
        margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border, #e5e7eb);
        font-size: 0.875rem; color: var(--muted-foreground, #6b7280); }
    .toolbar a { color: var(--primary, #2563eb); }
    button { font: inherit; padding: 0.35rem 0.8rem; border-radius: 0.375rem; cursor: pointer;
        border: 1px solid var(--border, #d1d5db); background: var(--background, #fff); color: var(--foreground, #111827); }
    button:hover { border-color: var(--primary, #2563eb); }
    .message { padding: 1rem; border-radius: 0.5rem; border: 1px solid var(--border, #d1d5db);
        color: var(--muted-foreground, #6b7280); }
    /* the note above an older copy of the guide, slimmer than a full message */
    .notice { max-width: 50rem; margin: 0 0 1.25rem; padding: 0.6rem 0.9rem; font-size: 0.875rem; }

    /* The guide, with its "On this page" list beside it when there's room. This uses the page's own width (a
       container query), not the window's, as Admin's sidebar takes up part of the window */
    :host { display: block; container-type: inline-size; }
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
    /* the section being read, in the accent colour (see highlightCurrentSection()) */
    .contents-side a.is-current { color: var(--primary, #2563eb); border-inline-start-color: var(--primary, #2563eb); font-weight: 600; }

    /* on narrower screens: a slim box above the guide that opens when tapped, with a "›" that turns when open */
    .contents-box { margin: 0 0 1.5rem; padding: 0.5rem 0.875rem; border: 1px solid var(--border, #e5e7eb); border-radius: 0.5rem;
        max-width: 50rem; color: var(--foreground, #111827); }
    .contents-box summary { display: flex; justify-content: space-between; align-items: center; list-style: none;
        font-weight: 600; cursor: pointer; }
    .contents-box summary::-webkit-details-marker { display: none; }
    .contents-box summary::after { content: "\\203A"; font-size: 1.4em; line-height: 1; opacity: 0.6; transition: transform 0.15s ease; }
    .contents-box[open] summary::after { transform: rotate(90deg); }
    .contents-box ul { margin: 0.5rem 0 0.25rem; }
    .contents-box li { margin: 0.3rem 0; }
    .contents-box a { color: var(--primary, #2563eb); }
    @media (prefers-reduced-motion: reduce) { .contents-box summary::after { transition: none; } }

    /* a little space above a heading when it's jumped to */
    .guide [id] { scroll-margin-top: 1rem; }
    .guide [id]:focus { outline: none; }

    /* the guide itself: readable line length and spacing for headings, lists, tables and code */
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

    /* GitHub-style notes (> [!NOTE], > [!TIP] and so on), with a coloured bar and label for each kind */
    .guide .alert { color: var(--foreground, #111827); border-inline-start-color: var(--alert-colour); }
    .guide .alert-title { margin-bottom: 0.25em; font-weight: 600; color: var(--alert-colour); }
    .guide .alert > :last-child { margin-bottom: 0; }
    .guide .alert-note { --alert-colour: #0969da; }
    .guide .alert-tip { --alert-colour: #1a7f37; }
    .guide .alert-important { --alert-colour: #8250df; }
    .guide .alert-warning { --alert-colour: #9a6700; }
    .guide .alert-caution { --alert-colour: #cf222e; }
`;

class Admin2SiteReadMePage extends HTMLElement {
    /*
     * Runs when Admin 2 adds the element to its page. The element draws itself in a "shadow root", which
     * keeps its styles and Admin's styles from affecting each other.
     */
    connectedCallback() {
        if (!this.shadowRoot) {
            this.attachShadow({ mode: 'open' });
        }
        this.load(false);
    }

    // Shows "Loading…", asks for the guide, then shows it (or the reason it can't be shown)
    async load(refresh) {
        this.show('<p class="message">Loading…</p>');

        let guide;
        try {
            guide = await fetchGuide(refresh);
        } catch (error) {
            guide = { error: 'The guide couldn\'t be loaded (' + error.message + ').' };
        }

        if (guide.error) {
            this.show('<p class="message">' + escapeText(guide.error) + '</p>');
            return;
        }

        // Where the guide comes from: a link to a file on another site, or the name of a file in this site
        // (a user:// address, which can't be opened as a link), and when it was fetched or last changed
        const from = guide.local
            ? 'From ' + escapeText(guide.source) + (guide.fetched_at ? ', updated ' + escapeText(new Date(guide.fetched_at).toLocaleString()) : '')
            : 'From <a href="' + escapeText(guide.source) + '" target="_blank" rel="noopener">' + escapeText(shortAddress(guide.source)) + '</a>' +
              (guide.fetched_at ? ', fetched ' + escapeText(new Date(guide.fetched_at).toLocaleString()) : '');

        // the guide's HTML was made safe to show on the server (see classes/ReadMeController.php); above it, a note
        // when it's an older copy (the file couldn't be fetched just now); below it, where it's from and a Refresh
        // button (the guide is in one column, with room beside it for an "On this page" list: see addContentsList())
        this.show(
            '<div class="layout">' +
                '<div class="main">' +
                    (guide.notice ? '<p class="message notice">' + escapeText(guide.notice) + '</p>' : '') +
                    '<article class="guide">' + guide.html + '</article>' +
                    '<div class="toolbar">' +
                        '<span>' + from + '</span>' +
                        '<button type="button" class="refresh">Refresh</button>' +
                    '</div>' +
                '</div>' +
            '</div>'
        );
        this.shadowRoot.querySelector('.refresh').addEventListener('click', () => this.load(true));

        // links to other sites open in a new tab, so Admin stays open
        this.shadowRoot.querySelectorAll('.guide a[href^="http"]').forEach((link) => {
            link.target = '_blank';
            link.rel = 'noopener';
        });

        this.addHeadingIds();
        this.addContentsList();

        // Links within the guide to one of its own sections (such as #quick-start, from a README's own list of
        // contents) scroll to that section. Admin's address is never changed, even when there's no such section
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
     * Gives each heading an id made from its text, the same way GitHub does, so links to a section written for
     * GitHub (such as #quick-start for "Quick Start") work here too: lower case, punctuation removed and spaces
     * changed to hyphens, with -1, -2 and so on added when two headings have the same text.
     */
    addHeadingIds() {
        const usedIds = new Set();
        this.shadowRoot.querySelectorAll('.guide h1, .guide h2, .guide h3, .guide h4, .guide h5, .guide h6').forEach((heading) => {
            // keep an id the Markdown gave the heading itself, such as ## Setup {#setup}
            if (heading.id) {
                usedIds.add(heading.id);
                return;
            }
            // \p{L} and \p{N} match letters and numbers in any language, so headings in French or German work too
            const id = heading.textContent.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-') || 'section';
            let unique = id;
            for (let n = 1; usedIds.has(unique); n++) {
                unique = id + '-' + n;
            }
            usedIds.add(unique);
            heading.id = unique;
            // so the heading can receive focus after a jump, for keyboard and screen reader users
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
     * Adds an "On this page" list of the guide's main sections (its h2 headings): beside the guide on wider
     * screens, staying in view while scrolling, and as a box above it that opens when tapped on narrower ones.
     * Not added for a guide with fewer than two sections.
     */
    addContentsList() {
        const headings = [...this.shadowRoot.querySelectorAll('.guide h2')];
        if (headings.length < 2) {
            return;
        }

        // one link for each heading, using the id addHeadingIds() gave it
        const items = headings.map((heading) => {
            const id = escapeText(heading.id);
            return '<li><a href="#' + id + '" data-target="' + id + '">' + escapeText(heading.textContent.trim()) + '</a></li>';
        }).join('');

        // the same list twice: beside the guide (wider screens) and in a box above it (narrower ones);
        // the styles show one or the other
        const side = document.createElement('nav');
        side.className = 'contents-side';
        side.setAttribute('aria-label', 'On this page');
        side.innerHTML = '<p class="contents-title">On this page</p><ul>' + items + '</ul>';
        this.shadowRoot.querySelector('.layout').appendChild(side);

        const box = document.createElement('details');
        box.className = 'contents-box';
        box.innerHTML = '<summary>On this page</summary><ul>' + items + '</ul>';
        this.shadowRoot.querySelector('.main').prepend(box);

        // Clicking a section scrolls to its heading. A plain #heading link isn't used for this, as Admin 2 is a
        // single-page app, where changing the address could move Admin to a different screen
        this.shadowRoot.querySelectorAll('[data-target]').forEach((link) => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                this.scrollToSection(link.dataset.target);
            });
        });

        this.highlightCurrentSection(headings, side);
    }

    /*
     * Highlights the section being read in the "On this page" column: the last heading that has scrolled up
     * past the top part of the page. An IntersectionObserver tells the page whenever a heading moves into or
     * out of view, which works whichever part of Admin is doing the scrolling.
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
            // Near the end of the guide, the last sections may be too short to scroll up past that line: once
            // the end of the guide is on screen, the last section that's in view is the current one
            const guideEnd = this.shadowRoot.querySelector('.guide').getBoundingClientRect().bottom;
            if (guideEnd <= window.innerHeight) {
                for (const heading of headings) {
                    if (heading.getBoundingClientRect().top < window.innerHeight) {
                        currentId = heading.id;
                    }
                }
            }
            side.querySelectorAll('a').forEach((link) => {
                link.classList.toggle('is-current', link.dataset.target === currentId);
            });
        };

        // stop watching the previous guide's headings, if the page was refreshed
        if (this.observer) {
            this.observer.disconnect();
        }
        // rootMargin moves the top edge the observer watches down by 150px, the same line as in highlight(),
        // so it reports each heading as it scrolls past that line
        this.observer = new IntersectionObserver(highlight, { rootMargin: '-150px 0px 0px 0px', threshold: [0, 1] });
        headings.forEach((heading) => this.observer.observe(heading));
        highlight();
    }

    // Runs when Admin 2 removes the page (such as when moving to another screen): stop watching the headings
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

// Tells the browser about the new element, once (Admin 2 may load this file again when the page is reopened)
if (!customElements.get(TAG)) {
    customElements.define(TAG, Admin2SiteReadMePage);
}
