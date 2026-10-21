<?php

// Developed with the assistance of Claude Code (claude.ai)

namespace Grav\Plugin;

use Grav\Common\Plugin;
use RocketTheme\Toolbox\Event\Event;

// Loads this plugin's classes (such as classes/ReadMeController.php) when first needed. They can't be loaded up
// front, as they build on the API plugin, which loads after this one; nor in onApiRegisterRoutes, as the API
// caches its routes, so that event doesn't run on most requests
spl_autoload_register(function (string $class): void {
    $prefix = 'Grav\\Plugin\\Admin2SiteReadMe\\';
    if (str_starts_with($class, $prefix)) {
        $file = __DIR__ . '/classes/' . substr($class, strlen($prefix)) . '.php';
        if (is_file($file)) {
            require $file;
        }
    }
});

/**
 * Admin2 Site ReadMe – adds a "Site ReadMe" item to the Admin 2 sidebar, showing a Markdown file (such as a
 * README on GitHub) inside Admin.
 *
 *   1. onApiSidebarItems   – adds the sidebar item
 *   2. onApiPluginPageInfo – describes the page; Admin 2 then loads admin-next/pages/admin2-site-readme.js
 *   3. onApiRegisterRoutes – adds the API address the page gets its content from (classes/ReadMeController.php)
 *
 * Needs Grav 2, Admin 2 and the Grav API plugin - hibbittsdesign.org
 */
class Admin2SiteReadMePlugin extends Plugin
{
    /**
     * The Grav events this plugin listens to, and the method each one calls.
     */
    public static function getSubscribedEvents(): array
    {
        return [
            'onApiSidebarItems'   => ['onApiSidebarItems', 0],
            'onApiPluginPageInfo' => ['onApiPluginPageInfo', 0],
            'onApiRegisterRoutes' => ['onApiRegisterRoutes', 0],
        ];
    }

    /**
     * Adds the "Site ReadMe" item to Admin 2's sidebar.
     */
    public function onApiSidebarItems(Event $event): void
    {
        $items = $event['items'] ?? [];

        $items[] = [
            'id'        => 'admin2-site-readme',
            'plugin'    => 'admin2-site-readme',
            'label'     => $this->sidebarLabel(),
            // a Font Awesome icon name, such as fa-book-open
            'icon'      => $this->config->get('plugins.admin2-site-readme.sidebar_icon') ?: 'fa-book-open',
            // the page it opens (Admin 2 shows plugin pages at /plugin/{plugin name})
            'route'     => '/plugin/admin2-site-readme',
            // lower numbers appear higher in the sidebar
            'priority'  => (int) ($this->config->get('plugins.admin2-site-readme.sidebar_priority') ?? 5),
            // anyone who can use Admin can read the guide
            'authorize' => 'api.access',
        ];

        $event['items'] = $items;
    }

    /**
     * Describes the page to Admin 2: "component" means this plugin's web component draws it, not a settings form.
     */
    public function onApiPluginPageInfo(Event $event): void
    {
        // Admin 2 asks every plugin in turn, so answer only for this one
        if ($event['plugin'] !== 'admin2-site-readme') {
            return;
        }

        $event['definition'] = [
            'id'        => 'admin2-site-readme',
            'plugin'    => 'admin2-site-readme',
            'title'     => $this->pageTitle(),
            'icon'      => $this->config->get('plugins.admin2-site-readme.sidebar_icon') ?: 'fa-book-open',
            'page_type' => 'component',
        ];
    }

    /**
     * Adds the API address the page gets its content from (usually /api/v1/admin2-site-readme/content).
     */
    public function onApiRegisterRoutes(Event $event): void
    {
        $routes = $event['routes'];
        $routes->get('/admin2-site-readme/content', [\Grav\Plugin\Admin2SiteReadMe\ReadMeController::class, 'content']);
    }

    /**
     * The page's title from the plugin's settings, or "Site ReadMe" when it's left empty.
     */
    private function pageTitle(): string
    {
        $title = trim((string) $this->config->get('plugins.admin2-site-readme.page_title'));

        return $title !== '' ? $title : 'Site ReadMe';
    }

    /**
     * The sidebar item's label from the plugin's settings, or the page's title when it's left empty.
     */
    private function sidebarLabel(): string
    {
        $label = trim((string) $this->config->get('plugins.admin2-site-readme.sidebar_label'));

        return $label !== '' ? $this->chosenLineBreak($label) : $this->pageTitle();
    }

    /**
     * A | in the label marks the one place a long label may break onto a second line in the sidebar, such as
     * "Site Instructions | and ReadMe". The sidebar shows the label as plain text, so a real line break can't be
     * used; instead, the spaces in each part become no-break spaces (so the label can't break there), and the
     * | becomes an ordinary space. A label that fits shows on one line, without the |.
     */
    private function chosenLineBreak(string $label): string
    {
        if (!str_contains($label, '|')) {
            return $label;
        }

        $parts = [];
        foreach (explode('|', $label) as $part) {
            // \u{00A0} is the no-break space character
            $parts[] = str_replace(' ', "\u{00A0}", trim($part));
        }

        return trim(implode(' ', $parts));
    }
}
