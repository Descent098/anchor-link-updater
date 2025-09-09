# Anchor Link Updater

This project seeks to solve the problem of internal heading links (anchor links) not being handled well in obsidian, it features:

- Automatic updating of internal/external links when a heading is changed in a document
- A UI to help automate fixing already broken heading links in a document

For example, if you have a document with:

```md
## Wireguard (TODO)
...


## Other content

This is a link to [[#Wireguard (TODO)]] and a link with an alias like this [[#Wireguard (TODO)|Wireguard]].
```

If you update the `## Wireguard (TODO)` to `## Wireguard` it will update your links:

```md
## Wireguard
...


## Other content

This is a link to [[#Wireguard]] and a link with an alias like this [[#Wireguard|Wireguard]].
```

Same thing if that content is in `tunneling.md` and you have content in `otherfile.md` that looks like this:

```md
This is a link to [[tunneling#Wireguard (TODO)]] and a link with an alias like this [[tunneling#Wireguard (TODO)|Wireguard]].
```

You can also have global syncing enabled and it will update the links to:

```md
This is a link to [[tunneling#Wireguard]] and a link with an alias like this [[tunneling#Wireguard|Wireguard]].
```

Demo

![](./docs/demo.gif)

## Notes/Warnings

- Each setting/feature can be toggled on and off as you please
- The global syncing can be slow if you have a TON of files

## Contribution Guide

If you find a bug feel free to submit an issue on the github page, and/or file a PR. To work with the project make your changes in `main.ts` (you'll need to run `npm i` if you haven't run the project before), then run `npm run dev` and copy `main.ts`, `manifest.json` and `styles.css` into your plugin folder (`<vault path>/.obsidian/plugins/anchor-link-updater`), then refresh your plugins.
