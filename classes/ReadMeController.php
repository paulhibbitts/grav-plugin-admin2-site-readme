<?php
namespace Grav\Plugin\Admin2SiteReadMe;

use Grav\Common\HTTP\Response;
use Grav\Plugin\Api\Controllers\AbstractApiController;
use Grav\Plugin\Api\Response\ApiResponse;
use ParsedownExtra;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

/**
 * Answers GET /admin2-site-readme/content with the Markdown file from the plugin's settings, as HTML - hibbittsdesign.org
 *
 * Remote files are fetched here, on the server, as many sites (GitHub included) don't let a browser on another
 * site read their files.
 */
class ReadMeController extends AbstractApiController
{
    // How long the last good copy of a remote file is kept (30 days)
    private const LAST_GOOD_COPY_SECONDS = 30 * 24 * 60 * 60;

    // The largest file shown (1 MB), in case the address points at something huge by mistake
    private const MAX_FILE_BYTES = 1024 * 1024;

    /**
     * Sends { html, source, fetched_at, hide_title, contents_levels } (plus a notice for an older copy),
     * or { error }. The address can be https:// (another site) or user:// (this site); ?refresh=1 fetches
     * a remote file again, skipping the cache.
     */
    public function content(ServerRequestInterface $request): ResponseInterface
    {
        // only people who can use Admin may read the guide
        $this->requirePermission($request, 'api.access');

        $address = trim((string) $this->config->get('plugins.admin2-site-readme.markdown_url'));
        if ($address === '') {
            return ApiResponse::create(['error' => 'No Markdown file is set yet. Add its address in the Admin2 Site ReadMe plugin\'s settings.']);
        }

        if (str_starts_with($address, 'user://')) {
            $guide = $this->localGuide($address);
        } elseif (str_starts_with($address, 'https://')) {
            $refresh = ($request->getQueryParams()['refresh'] ?? '') === '1';
            $guide = $this->remoteGuide($address, $refresh);
        } else {
            // only https for other sites, so the file can't be changed on the way
            return ApiResponse::create(['error' => 'The Markdown file\'s address needs to start with https:// (for a file on another site) or user:// (for a file in this site).']);
        }

        // which title to hide, as the Admin page already has one: 0 none, 1 a # title (the default), 2 a # or ##
        // title. A site that saved the earlier Yes/No switch has true or false, which become 1 or 0 here
        $guide['hide_title'] = min(2, max(0, (int) ($this->config->get('plugins.admin2-site-readme.hide_title') ?? 1)));

        // the deepest heading level in the "On this page" list: 2 (## headings only), 3 (the default) or 4
        $guide['contents_levels'] = min(4, max(2, (int) ($this->config->get('plugins.admin2-site-readme.contents_levels') ?? 3)));

        return ApiResponse::create($guide);
    }

    /**
     * A file in this site, such as user://data/site-readme.md. It's read each time, as that's quick, so it's
     * never out of date.
     */
    private function localGuide(string $address): array
    {
        // where the file is on the server (false when it doesn't exist)
        $file = $this->grav['locator']->findResource($address, true);
        $userFolder = realpath($this->grav['locator']->findResource('user://', true));
        $file = $file ? realpath($file) : false;

        // only .md files inside user/, so the setting can't show other files, such as settings or accounts
        if (!$file || !$userFolder || !str_starts_with($file, $userFolder . DIRECTORY_SEPARATOR) || strtolower(pathinfo($file, PATHINFO_EXTENSION)) !== 'md') {
            return ['error' => 'The file ' . $address . ' wasn\'t found, or isn\'t a Markdown (.md) file in the site\'s user folder.'];
        }

        if (filesize($file) > self::MAX_FILE_BYTES) {
            return ['error' => 'The file ' . $address . ' is larger than 1 MB, so it isn\'t shown.'];
        }

        // the file's web address (such as https://example.org/user/data/site-readme.md), so its relative
        // images and links can be given full addresses
        $relativePath = str_replace(DIRECTORY_SEPARATOR, '/', substr($file, strlen(GRAV_ROOT) + 1));
        $webAddress = rtrim($this->grav['uri']->rootUrl(true), '/') . '/' . $relativePath;

        return [
            'html'       => $this->markdownToSafeHtml((string) file_get_contents($file), $webAddress),
            'source'     => $address,
            'fetched_at' => date('c', filemtime($file)),
            'local'      => true,
        ];
    }

    /**
     * A file on another site, cached for the Keep a Copy For setting's minutes. A "last good copy" is also kept
     * for 30 days, and shown with a note if the file can't be fetched later (for example, the site is down).
     */
    private function remoteGuide(string $address, bool $refresh): array
    {
        // a GitHub page address becomes the raw file's address
        $address = $this->rawGitHubAddress($address);

        // the cached copies are named after the address, so a new address fetches the new file
        $cache = $this->grav['cache'];
        $cacheKey = 'admin2-site-readme-' . md5($address);
        $lastGoodKey = 'admin2-site-readme-last-good-' . md5($address);
        $minutes = max(1, (int) ($this->config->get('plugins.admin2-site-readme.cache_minutes') ?? 60));

        $cached = $refresh ? false : $cache->fetch($cacheKey);
        if (is_array($cached)) {
            return $cached;
        }

        try {
            // give up after 10 seconds, so a slow site doesn't leave the page waiting
            $markdown = Response::get($address, ['timeout' => 10]);
        } catch (\Throwable $e) {
            $problem = 'The Markdown file couldn\'t be fetched from ' . $address . ' (' . $e->getMessage() . ')';

            // show the last good copy, if there is one, with a note saying it's an older copy
            $lastGood = $cache->fetch($lastGoodKey);
            if (is_array($lastGood)) {
                $lastGood['notice'] = $problem . ', so this is the copy fetched earlier.';
                return $lastGood;
            }
            return ['error' => $problem];
        }

        if (strlen($markdown) > self::MAX_FILE_BYTES) {
            return ['error' => 'The file at ' . $address . ' is larger than 1 MB, so it isn\'t shown.'];
        }

        $guide = [
            'html'       => $this->markdownToSafeHtml($markdown, $address),
            'source'     => $address,
            'fetched_at' => date('c'),
        ];
        $cache->save($cacheKey, $guide, $minutes * 60);
        $cache->save($lastGoodKey, $guide, self::LAST_GOOD_COPY_SECONDS);

        return $guide;
    }

    /**
     * Markdown to HTML that's safe to show in Admin, with full addresses for relative links and images.
     */
    private function markdownToSafeHtml(string $markdown, string $address): string
    {
        // A Grav page (or a file from a site such as Jekyll) can start with "front matter": settings such as its
        // title, between two --- lines. They aren't meant to be read, so they're left out
        $markdown = preg_replace('/^(\xEF\xBB\xBF)?---\R.*?\R---(\R|$)/s', '', $markdown, 1);

        // Grav pages wrap shortcode examples in [raw]...[/raw], so Grav shows them rather than running them. Shortcodes
        // never run here, so the markers themselves are left out and only the examples show
        $markdown = preg_replace('#\[/?raw\]#i', '', $markdown);

        // GitHub reads Markdown inside HTML such as <div align="center">; Markdown Extra needs markdown="1" to do it
        $markdown = preg_replace('#<(div|details|section|center)\b(?![^>]*\bmarkdown=)([^>]*)>#i', '<$1$2 markdown="1">', $markdown);

        // Markdown Extra adds tables and footnotes, as in Grav pages
        $parser = new ParsedownExtra();
        $html = $parser->text($markdown);

        $html = $this->githubNotes($html);
        $html = $this->taskLists($html);
        $html = $this->removeUnsafeHtml($html);

        return $this->fullAddresses($html, $address);
    }

    /**
     * Turns GitHub-style notes (a quote starting with [!NOTE], [!TIP], [!IMPORTANT], [!WARNING] or [!CAUTION])
     * into labelled boxes: the [!TIP] becomes a class for the box's colour and a "Tip" label.
     */
    private function githubNotes(string $html): string
    {
        $html = preg_replace_callback(
            '#<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<br\s*/?>)?\s*#i',
            function (array $match) {
                $kind = strtolower($match[1]);
                return '<blockquote class="alert alert-' . $kind . '"><p class="alert-title">' . ucfirst($kind) . '</p><p>';
            },
            $html
        );

        // a [!TIP] followed by an empty quote line leaves an empty paragraph, so remove it
        return preg_replace('#<p class="alert-title">(\w+)</p><p>\s*</p>#', '<p class="alert-title">$1</p>', $html);
    }

    /**
     * Turns task list items (- [ ] Step or - [x] Done in Markdown) into checkboxes, as GitHub shows them.
     * Markdown Extra gives <li>[ ] Step</li>, or <li><p>[ ] Step</p></li> when the list has blank lines in it.
     */
    private function taskLists(string $html): string
    {
        return preg_replace_callback('#<li>(\s*<p>)?\s*\[( |x|X)\]\s+#', function (array $match) {
            $checked = strtolower($match[2]) === 'x' ? ' checked' : '';
            return '<li class="task">' . $match[1] . '<input type="checkbox" class="task-box"' . $checked . '> ';
        }, $html);
    }

    /**
     * Changes a GitHub page address (github.com/owner/repo/blob/branch/README.md) to the raw file's address
     * (raw.githubusercontent.com/owner/repo/branch/README.md), which gives the Markdown. refs/heads/ is removed
     * from raw addresses (GitHub serves the same file), so the branch always follows the repository's name, as
     * fullAddresses() expects. Other addresses are returned as they are.
     */
    private function rawGitHubAddress(string $address): string
    {
        if (preg_match('#^https://github\.com/([^/]+)/([^/]+)/blob/(.+)$#', $address, $parts)) {
            $address = 'https://raw.githubusercontent.com/' . $parts[1] . '/' . $parts[2] . '/' . $parts[3];
        }

        return preg_replace('#^(https://raw\.githubusercontent\.com/[^/]+/[^/]+/)refs/heads/#', '$1', $address);
    }

    /**
     * Removes anything that could run code in Admin: scripts and similar elements, "on..." attributes (such as
     * onclick) and javascript: links. Style attributes go too, as on GitHub, so a file can't cover Admin with
     * something fake, such as a "sign in again" message.
     *
     * DOMDocument reads the HTML as a browser does, so the checks see each attribute's real value, and tricks
     * such as &#106;avascript: can't slip past.
     */
    private function removeUnsafeHtml(string $html): string
    {
        // elements that can run code or load other pages, removed with their contents
        $unsafeElements = ['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
            'form', 'template', 'base', 'meta', 'link', 'noscript',
            // SVG elements that can change attributes later (such as a link to javascript:), load other files
            // or hold HTML; READMEs don't use them. DOMDocument names them in lower case, as here
            'animate', 'set', 'animatemotion', 'animatetransform', 'use', 'foreignobject'];
        // attributes that hold an address, which mustn't be a javascript: (or similar) address
        $addressAttributes = ['href', 'src', 'xlink:href', 'action', 'formaction', 'poster', 'background'];

        $document = new \DOMDocument();
        // One wrapping <div> gives DOMDocument a single element to hold, and the xml line says it's UTF-8 (or é
        // and – would be garbled). The settings stop it adding <html> and <body>, and quiet its warnings about
        // HTML5 elements such as <details>
        $previous = libxml_use_internal_errors(true);
        $document->loadHTML('<?xml encoding="utf-8"?><div id="admin2-site-readme">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        // a copy of the list, as removing elements from the live list would skip some
        $elements = iterator_to_array($document->getElementsByTagName('*'));
        foreach ($elements as $element) {
            if (in_array(strtolower($element->nodeName), $unsafeElements, true)) {
                $element->parentNode?->removeChild($element);
                continue;
            }

            // a copy of the attribute list too, for the same reason
            foreach (iterator_to_array($element->attributes) as $attribute) {
                $name = strtolower($attribute->nodeName);
                // spaces and invisible characters are removed first, as browsers ignore them (java script: still runs)
                $value = strtolower(preg_replace('/[\s\x00-\x1f]+/', '', $attribute->nodeValue));

                $runsCode = str_starts_with($name, 'on');
                $isStyle = $name === 'style';
                $codeAddress = in_array($name, $addressAttributes, true)
                    && (str_starts_with($value, 'javascript:') || str_starts_with($value, 'vbscript:')
                        // data: addresses are kept only for images, such as data:image/png;base64,...
                        || (str_starts_with($value, 'data:') && !str_starts_with($value, 'data:image/')));

                if ($runsCode || $codeAddress || $isStyle) {
                    $element->removeAttribute($attribute->nodeName);
                }
            }
        }

        // the cleaned HTML: everything inside the <div> added above
        $wrapper = (new \DOMXPath($document))->query('//div[@id="admin2-site-readme"]')->item(0);
        $clean = '';
        foreach ($wrapper ? $wrapper->childNodes : [] as $node) {
            $clean .= $document->saveHTML($node);
        }

        return $clean;
    }

    /**
     * Gives relative links and images a full address, based on where the file is, so a README's screenshots
     * still show.
     */
    private function fullAddresses(string $html, string $address): string
    {
        // the folder the file is in, such as https://raw.githubusercontent.com/owner/repo/branch/
        $folder = substr($address, 0, strrpos($address, '/') + 1);
        // where addresses starting with / begin: the top of the site (http:// too, for a site on this computer)...
        $top = preg_replace('#^(https?://[^/]+).*$#', '$1', $address);
        // ...or, on GitHub, the top of the repository, as / means in a GitHub README
        $onGitHub = (bool) preg_match('#^(https://raw\.githubusercontent\.com/[^/]+/[^/]+/[^/]+)/#', $address, $repository);
        if ($onGitHub) {
            $top = $repository[1];
        }

        return preg_replace_callback('#\b(href|src)="([^"]*)"#i', function (array $match) use ($folder, $top, $onGitHub) {
            $attribute = $match[1];
            $value = $match[2];

            // full addresses, links within the page (#...), and email or phone links stay as they are
            if ($value === '' || preg_match('#^([a-z][a-z0-9+.-]*:|//|\#)#i', $value)) {
                return $match[0];
            }
            // an address starting with / joins $top, anything else joins the file's folder ($top has no ending /,
            // $folder has one). The address is already HTML-escaped, so only the added part is escaped
            $start = str_starts_with($value, '/') ? $top : $folder;
            $full = htmlspecialchars($start, ENT_QUOTES) . $value;

            // on GitHub, links (not images) go to GitHub's page for the file, which is easier to read
            if ($onGitHub && strtolower($attribute) === 'href') {
                $full = preg_replace('#^https://raw\.githubusercontent\.com/([^/]+)/([^/]+)/#', 'https://github.com/$1/$2/blob/', $full);
            }

            return $attribute . '="' . $full . '"';
        }, $html);
    }
}
