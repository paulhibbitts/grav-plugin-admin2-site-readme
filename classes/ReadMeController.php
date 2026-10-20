<?php
namespace Grav\Plugin\Admin2SiteReadMe;

use Grav\Common\HTTP\Response;
use Grav\Plugin\Api\Controllers\AbstractApiController;
use Grav\Plugin\Api\Response\ApiResponse;
use ParsedownExtra;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

/**
 * Answers GET /admin2-site-readme/content: fetches the Markdown file named in the plugin's settings, turns it into
 * HTML, and sends it to the Site ReadMe page in Admin 2 - hibbittsdesign.org
 *
 * The file is fetched here, on the server, rather than by the browser, because many sites (GitHub included)
 * don't let a browser on another site read their files directly. The result is cached for a while, so Admin
 * doesn't fetch the file again each time the page is opened.
 */
class ReadMeController extends AbstractApiController
{
    // How long the last good copy of a remote file is kept, to show when the file can't be fetched (30 days)
    private const LAST_GOOD_COPY_SECONDS = 30 * 24 * 60 * 60;

    // The largest file shown (1 MB, far more than any README), so an address that points at something huge
    // by mistake doesn't slow Admin down
    private const MAX_FILE_BYTES = 1024 * 1024;

    /**
     * Sends the guide as { html, source, fetched_at } – plus a notice when it's an older copy – or { error }
     * when it can't be shown. Add ?refresh=1 to fetch a remote file again now, instead of using the cached copy.
     *
     * The guide can be a file on another site (an https address) or a file in this site (a user:// address,
     * such as user://data/site-readme.md).
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
            return ApiResponse::create($this->localGuide($address));
        }

        // only https addresses for other sites, so the file can't be changed on its way to this site
        if (!str_starts_with($address, 'https://')) {
            return ApiResponse::create(['error' => 'The Markdown file\'s address needs to start with https:// (for a file on another site) or user:// (for a file in this site).']);
        }

        $refresh = ($request->getQueryParams()['refresh'] ?? '') === '1';

        return ApiResponse::create($this->remoteGuide($address, $refresh));
    }

    /**
     * A guide from a file in this site, such as user://data/site-readme.md (the site's user/data folder).
     * It's read each time, as reading a file in the site is quick, so it's never out of date.
     */
    private function localGuide(string $address): array
    {
        // where the file is on the server, using Grav's user:// address (false when it doesn't exist)
        $file = $this->grav['locator']->findResource($address, true);
        $userFolder = realpath($this->grav['locator']->findResource('user://', true));
        $file = $file ? realpath($file) : false;

        // Only a Markdown file inside the site's user folder: this keeps the setting from being used to show
        // other files on the server, such as the site's settings or accounts (which are .yaml files)
        if (!$file || !$userFolder || !str_starts_with($file, $userFolder . DIRECTORY_SEPARATOR) || strtolower(pathinfo($file, PATHINFO_EXTENSION)) !== 'md') {
            return ['error' => 'The file ' . $address . ' wasn\'t found, or isn\'t a Markdown (.md) file in the site\'s user folder.'];
        }

        if (filesize($file) > self::MAX_FILE_BYTES) {
            return ['error' => 'The file ' . $address . ' is larger than 1 MB, so it isn\'t shown.'];
        }

        // the file's own web address (such as https://example.org/user/data/site-readme.md), so its relative
        // images and links can be given full addresses: Grav serves the files in user/ from that address
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
     * A guide from a file on another site (an https address), cached for the Keep a Copy For setting's minutes.
     * Each copy is also saved as the "last good copy", kept for 30 days: if the file can't be fetched later
     * (for example, the other site is down), that copy is shown, with a note, rather than only an error.
     */
    private function remoteGuide(string $address, bool $refresh): array
    {
        // a GitHub page address is changed to the address of the file itself (see rawGitHubAddress())
        $address = $this->rawGitHubAddress($address);

        // the copies are kept under names made from the address, so changing the address fetches the new file
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
     * Turns Markdown into HTML that's safe to show in Admin, with full addresses for its relative links and
     * images (based on $address, where the file is on the web).
     */
    private function markdownToSafeHtml(string $markdown, string $address): string
    {
        // READMEs often wrap Markdown in HTML, such as <div align="center"> around a title and badges. GitHub still
        // reads the Markdown inside; Markdown Extra does that only when the tag has markdown="1", so add it
        $markdown = preg_replace('#<(div|details|section|center)\b(?![^>]*\bmarkdown=)([^>]*)>#i', '<$1$2 markdown="1">', $markdown);

        // Markdown to HTML, with Markdown Extra's tables and footnotes, as Grav uses for pages
        $parser = new ParsedownExtra();
        $html = $parser->text($markdown);

        $html = $this->githubNotes($html);
        $html = $this->removeUnsafeHtml($html);

        return $this->fullAddresses($html, $address);
    }

    /**
     * Turns GitHub-style notes into labelled boxes, as GitHub shows them. In Markdown, a note is a quote that
     * starts with [!NOTE], [!TIP], [!IMPORTANT], [!WARNING] or [!CAUTION]:
     *
     *     > [!TIP]
     *     > Text of the tip.
     *
     * Markdown Extra turns that into <blockquote><p>[!TIP] Text of the tip.</p></blockquote>, so the [!TIP] is
     * replaced with a class for the box's colour and a "Tip" label.
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

        // when the [!TIP] line is followed by an empty quote line, the text is in a paragraph of its own,
        // which leaves an empty paragraph behind
        return preg_replace('#<p class="alert-title">(\w+)</p><p>\s*</p>#', '<p class="alert-title">$1</p>', $html);
    }

    /**
     * Changes a GitHub page address (github.com/owner/repo/blob/branch/README.md) to the address of the file
     * itself (raw.githubusercontent.com/owner/repo/branch/README.md), which gives the Markdown rather than a web
     * page. Any other address is returned as it is.
     *
     * A file address can also name its branch as refs/heads/branch (such as .../repo/refs/heads/master/README.md,
     * which GitHub's Raw button gives). GitHub serves the same file without refs/heads/, so it's left out: then
     * the branch is always the part after the repository's name, which fullAddresses() relies on.
     */
    private function rawGitHubAddress(string $address): string
    {
        if (preg_match('#^https://github\.com/([^/]+)/([^/]+)/blob/(.+)$#', $address, $parts)) {
            $address = 'https://raw.githubusercontent.com/' . $parts[1] . '/' . $parts[2] . '/' . $parts[3];
        }

        return preg_replace('#^(https://raw\.githubusercontent\.com/[^/]+/[^/]+/)refs/heads/#', '$1', $address);
    }

    /**
     * Removes anything from the HTML that could run code in Admin, as the file comes from another site:
     * scripts and similar elements, "on..." attributes (such as onclick), and javascript: links. Style attributes
     * are removed too, as GitHub does, so a file can't cover Admin with something that looks like part of it (such
     * as a fake "sign in again" message). Ordinary HTML that READMEs often use, such as images, tables and
     * <details>, is kept.
     *
     * The HTML is read with PHP's DOMDocument, the way a browser reads it, rather than searched as text: then
     * tricks such as an unquoted javascript: link, or one written with HTML entities (&#106;avascript:), can't
     * slip past, as the checks below see each attribute's real value.
     */
    private function removeUnsafeHtml(string $html): string
    {
        // elements that can run code or load other pages, removed along with everything inside them
        $unsafeElements = ['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
            'form', 'template', 'base', 'meta', 'link', 'noscript',
            // SVG elements that can change other attributes after the page loads (such as setting a link's
            // address to javascript:), bring in content from other files, or hold other HTML; READMEs don't use
            // them, as their badges and logos are images. DOMDocument names them in lower case, as here
            'animate', 'set', 'animatemotion', 'animatetransform', 'use', 'foreignobject'];
        // attributes that hold an address, which mustn't be a javascript: (or similar) address
        $addressAttributes = ['href', 'src', 'xlink:href', 'action', 'formaction', 'poster', 'background'];

        $document = new \DOMDocument();
        // The HTML goes inside one <div>, so DOMDocument has a single element to hold it, and the xml encoding line
        // in front tells DOMDocument it's UTF-8 (otherwise characters such as é or – would be garbled). The libxml
        // settings keep it from adding <html> and <body>, and quiet its warnings about HTML5 elements it doesn't
        // know, such as <details>
        $previous = libxml_use_internal_errors(true);
        $document->loadHTML('<?xml encoding="utf-8"?><div id="admin2-site-readme">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        // a copy of the list of elements, as removing elements while going through the live list would skip some
        $elements = iterator_to_array($document->getElementsByTagName('*'));
        foreach ($elements as $element) {
            if (in_array(strtolower($element->nodeName), $unsafeElements, true)) {
                $element->parentNode?->removeChild($element);
                continue;
            }

            // a copy of the attribute list too, for the same reason
            foreach (iterator_to_array($element->attributes) as $attribute) {
                $name = strtolower($attribute->nodeName);
                // the address without spaces or invisible characters, which browsers ignore (java script: still runs)
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
     * Gives relative links and images a full address, based on where the Markdown file is, so that (for
     * example) an image at images/screenshot.png next to a README on GitHub still shows in Admin.
     */
    private function fullAddresses(string $html, string $address): string
    {
        // the folder the file is in, such as https://raw.githubusercontent.com/owner/repo/branch/
        $folder = substr($address, 0, strrpos($address, '/') + 1);
        // where addresses starting with / begin: the top of the site, such as https://example.org...
        // (http:// too, for a file in a site on this computer, such as http://localhost)
        $top = preg_replace('#^(https?://[^/]+).*$#', '$1', $address);
        // ...but for a file on GitHub, the top of its repository (https://raw.githubusercontent.com/owner/repo/branch),
        // as that's what / means in a GitHub README
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
            // an address starting with / is from the top; anything else is in the same folder as the file
            // ($top has no / at its end and $folder has one, so /docs/a.md and docs/a.md each join up correctly;
            // the value is already HTML-escaped, so only the part added to it is escaped here)
            $start = str_starts_with($value, '/') ? $top : $folder;
            $full = htmlspecialchars($start, ENT_QUOTES) . $value;

            // on GitHub, links (not images) go to GitHub's normal page view of the file, which is easier to read
            // than the file itself: raw.githubusercontent.com/owner/repo/branch/... becomes github.com/owner/repo/blob/branch/...
            if ($onGitHub && strtolower($attribute) === 'href') {
                $full = preg_replace('#^https://raw\.githubusercontent\.com/([^/]+)/([^/]+)/#', 'https://github.com/$1/$2/blob/', $full);
            }

            return $attribute . '="' . $full . '"';
        }, $html);
    }
}
