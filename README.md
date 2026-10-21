# Admin2 Site ReadMe Plugin

**Admin2 Site ReadMe** is a [Grav](https://getgrav.org) plugin for Grav 2 that adds a **Site ReadMe** item to the Admin 2 sidebar. It shows a Markdown file, such as a README on GitHub, inside Admin, so the people editing a site can read its how-tos, guidelines or notes where they work – and it stays up to date, as it's fetched from the file itself.

## Where It Helps Most

- **Custom Grav sites** – when several people work on a site, such as developers, designers, content editors and the client, everyone has the project's information right in Admin: how-tos, content guidelines, who to contact and what's changed. Keep it as a page anyone can update in Admin, or as a file on GitHub alongside the site's code
- **Any page of your own in Admin** – more generally, it's a simple way to add a Markdown page to Admin 2, with its own sidebar item, title and icon, without writing any code: a checklist, a style guide, release notes or a help page for your team
- **Online workshops** – about Grav or a project built on it, where people follow the steps in Admin as they go and tick off task lists, each person's ticks kept in their own browser
- **Demo sites** – a perfect partner for Grav 2's [demo mode](https://learn.getgrav.org/2/api/demo-mode), where visitors sign in to Admin 2 with a shared account to try a site. The Site ReadMe gives them the further information they need right there: what the demo shows, what to try, and `admin:` links that open each screen. Demo accounts can read it with no extra settings, as reading it changes nothing

## Installation

1. Download the plugin, unzip it into `user/plugins`, and rename the folder to `admin2-site-readme`
2. In Admin 2, open **Plugins → Admin2 Site ReadMe** and set **Markdown File Address**, for example `https://github.com/owner/repository/blob/main/README.md`

Needs Grav 2, Admin 2 and the Grav API plugin.

## Settings

- **Markdown File Address** – the https address of the file, such as a GitHub page address (`github.com/…/blob/…`) or file address (`raw.githubusercontent.com/…`). It can also be a Markdown file in the site itself, such as `user://data/site-readme.md` (in the site's `user/data` folder), for a ReadMe that isn't on GitHub or is private
- **Page Title** – the page's title in Admin (Site ReadMe by default), such as Workshop Guide, Project Info or Style Guide
- **Hide File Title** – hides the file's title (its first heading), as the page already has one: a `#` title (the default), a `#` or `##` title (for files that use `##` for their title), or neither. A `###` subtitle straight after the title is hidden too
- **On This Page Headings** – the heading levels in the On this page list: levels 2–3 (`##` and `###`, the default), level 2 only for a shorter list, or down to level 4. In a file that uses `###` for its sections, such as many Grav pages, the list starts there instead
- **Sidebar Label** – the item's name in the sidebar (the Page Title by default). For a long name, a `|` marks where it may break onto a second line, such as `Site Instructions | and ReadMe`
- **Sidebar Icon** – a Font Awesome icon name, such as `fa-book-open` (the default) or `fa-circle-question`
- **Sidebar Position** – lower numbers appear higher in the sidebar (5 by default)
- **Keep a Copy For (Minutes)** – how long to keep the fetched file before fetching it again (60 by default). The page's **Refresh** button fetches it again straight away (a file in the site itself is read fresh each time, so it has no Refresh button)

To let editors update the ReadMe in Admin, make it a page, such as `user://pages/site-readme/default.md`, and set its Published option to No. Its front matter isn't shown, and nor are `[raw]` markers around shortcode examples.

On wider screens, an **On this page** list of the file's main sections sits beside it, highlighting the section being read; on narrower ones, it's a box above the file that opens when tapped.

If a file on another site can't be fetched (for example, the site is down), the last copy fetched in the past 30 days is shown, with a note. These copies are kept in Grav's cache, so leave it turned on (as it is by default). Files larger than 1 MB aren't shown.

For a file in the site itself, images next to it (such as PNG or JPG) show, but Grav's web server settings block SVG images in `user/data` and all `.md` files, so those don't show or open.

Links with an `admin:` address open a screen in Admin, such as `[Pages](admin:/pages)` or `[Site settings](admin:/config/site)`, and work on any site, whatever its address (on GitHub itself, they don't open). Task lists (`- [ ] Step`) show as checkboxes that can be ticked off, remembered in each person's browser. Ticks follow each step's position, so adding steps can shift them.

Links to a section of the file, such as `#quick-start`, scroll to that section, and GitHub-style notes (`> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]` and `> [!CAUTION]`) are shown as labelled boxes, as on GitHub.

> [!TIP]
> Relative links and images in the file are given full addresses, so a README's screenshots still show. Links to other files on GitHub open GitHub's page for that file. Images load from wherever they're hosted, so point the plugin at files you trust.

## How It Works

The file is read on the server, turned into HTML with Grav's Markdown parser (with Markdown Extra), and anything that could run code (scripts, `on…` attributes and `javascript:` links) is removed before it's shown, along with `style` attributes, as on GitHub. The page itself is a web component (`admin-next/pages/admin2-site-readme.js`), the way Admin 2 adds plugin pages, and it follows Admin's Light or Dark mode and accent colour.

## License

MIT – see [LICENSE](LICENSE). By [Paul Hibbitts](https://hibbittsdesign.org).
