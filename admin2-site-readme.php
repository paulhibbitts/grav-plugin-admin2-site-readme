<?php

// Developed with the assistance of Claude Code (claude.ai)

namespace Grav\Plugin;

use Grav\Common\Plugin;
use RocketTheme\Toolbox\Event\Event;

// Tells PHP where to find this plugin's classes (such as Grav\Plugin\Admin2SiteReadMe\ReadMeController, in
// classes/ReadMeController.php), so each one is loaded the first time it's needed. Loading the controller straight
// away wouldn't work: it builds on the API plugin's AbstractApiController, which isn't loaded yet when this file is.
// (And it can't be loaded in onApiRegisterRoutes either: the API plugin caches its list of addresses, so on most
// requests that event doesn't run, but the class is still needed to answer)
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
 * Admin2 Site ReadMe – adds a "Site ReadMe" item to the Admin 2 sidebar, which shows a Markdown file (such as a
 * README on GitHub) inside Admin, so the people editing a site can read its instructions where they work.
 *
 * How the pieces fit together:
 *   1. onApiSidebarItems   – adds the sidebar item (its label and icon come from the plugin's settings)
 *   2. onApiPluginPageInfo – tells Admin 2 what the page is called; Admin 2 then loads the page's
 *                            web component from admin-next/pages/admin2-site-readme.js
 *   3. onApiRegisterRoutes – adds the API address the web component asks for the guide's content
 *                            (/admin2-site-readme/content), answered by classes/ReadMeController.php
 *
 * Needs Grav 2 with Admin 2 and the Grav API plugin, which provide these events - hibbittsdesign.org
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
            // the page in Admin 2 that the item opens (Admin 2 shows a plugin's page at /plugin/{plugin name})
            'route'     => '/plugin/admin2-site-readme',
            // where it sits in the sidebar: lower numbers appear first
            'priority'  => (int) ($this->config->get('plugins.admin2-site-readme.sidebar_priority') ?? 5),
            // anyone who can use Admin can read the guide
            'authorize' => 'api.access',
        ];

        $event['items'] = $items;
    }

    /**
     * Describes the plugin's page to Admin 2. "component" means the page is drawn by this plugin's own web
     * component (admin-next/pages/admin2-site-readme.js), rather than as a settings form.
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
     * Adds the API address that the page's web component calls to get the guide's content.
     * With the API plugin's usual prefix, it's /api/v1/admin2-site-readme/content.
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

        return $label !== '' ? $label : $this->pageTitle();
    }
}
