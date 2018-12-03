
Make a server:

```js
const verser = require('..')
```

When you have the data, set or update the data at particular paths:

```js
verser.set('about', '<html><head>...   <p>Hello, World</p></body></html>')
```

Folks can now fetch that content

```
$ curl http://localhost:8080/hello
```

With version-integrity, including selecting older versions

```
$ got-integrity --check http://localhost:8080/hello
integrity suggested: http://localhost:8080/hello#version-integrity=sha256-OG1ISmX8sd9BmmiI6No7UnNFVtdlfVg8KoYhhROg_yk=
# change from "#" to "?"
$ got-integrity http://localhost:8080/hello?version-integrity=sha256-qBhV8XoC3ZesxmOb3nBNQ75HafJ3Ui4pt4ELIOduKQ4=
```

Actually fails right now.  The versions aren't matching.  But that's the idea.

And streaming...

```
curl http://localhost:8080/hello?stream-of-patches-since=sha256-TMXYnIPNK5ZfdIEBEucoONDwLcRY2IdxhHVrCbBOIDk=
```

gives an event-stream of jpatch objects since that stream, going forward.


## Someday

* better integration with express
* allow you to general pages when asked
* update browser-side library to actually work
* provide nice pause/resume client-side UI
* some nice version tags
