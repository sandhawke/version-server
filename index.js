/*

  persist into simple-git, I think.  use that for hashes, etc.  We'd
  like to store all versions forever, but not in RAM, thanks.

  change UI to be
  ?version-integrity=[patch sha]
  and
  ?stream-of-patches-since=[patch sha or 0]
  
*/
const m = require('appmgr').create()
// const delay = require('delay')
const debug = require('debug')('version-server')
const EventEmitter = require('events')
const jpatch = require('jpatch')
const crypto = require('crypto')

/*
  latestDoc['foo'] is the latest Doc object with .name === 'foo'
*/
const latestDoc = {}

// Just a counter, but start with the time incase the server restarts
// OR: use a hash of the text
let ver = 1000 // (new Date()).valueOf()

class Doc {
  constructor (name, text) {
    this.name = name
    this.text = text

    // inject the version-manager script -- maybe this should be optional?
    // and maybe it should be a query-parm?
    this.text = this.text.replace(/<head>/, `<head>
<script id="version-manager" src="/static/version-manager.js" async></script>`)
    // maybe if it's HTML do some cleanup so when the client removes this
    // script they're likely to get the right hash out of the DOM?

    if (!this.version) {
      this.version = vihash(text)
      debug('version',  this.version)
      // this.version = (ver++).toString()
    }

    this.older = []
    const previous = latestDoc[name]
    if (previous) {
      // take over the EventEmitter from the previous one
      this.ee = previous.ee
      delete previous.ee
      
      this.older.push(...previous.older)
      this.older.unshift(previous)
      delete previous.older

      // forget about anything more than this-many versions back
      const keepVersions = 1000
      if (this.older.length > keepVersions) {
        this.older.splice(keepVersions, this.older.length)
      }
    } else {
      this.ee = new EventEmitter()
    }

    latestDoc[name] = this
    
    // maybe compute the patch?   what if no one's watching?
    // let the first one compute it, and save it somewhere for others
    // to get at, I think?
    this.ee.emit('update')
    
    // debug('set latestDoc[%s] = %O', name, this)
    debug('set latestDoc[%s]', name, this.version)
  }

  findVersion (v) {
    if (this.version === v || v === 'latest') return this
    return this.older.find(x => x.version === v)
  }
}


m.app.use(async (req, res, next) => {
  console.log('req.path', req.path)
  console.log('req.query', req.query)

  let val = req.query['version-integrity']
  if (val) {
    sendVersion(val, req, res)
    return
  }

  val = req.query['stream-of-patches-since']
  if (val) {
    sendStream(val, req, res)
    return
  }

  next()
})

function sendVersion (version, req, res) {
  const docname = req.path.slice(1)
  debug('sendVersion path=%j since=%j', docname, version)
  let doc = latestDoc[docname]
  if (!doc) {
    res.status(404).send('No such resource (at any version)')
    return
  }
  let verDoc = doc.findVersion(version)
  if (verDoc) {
    res.send(verDoc.text) // invert this as doc.sendTo(res) so it can do type, etc
  } else {
    res.status(410).send('Version not available')
  }
}

function sendStream (sinceVersion, req, res) {
  const docname = req.path.slice(1)
  debug('sendStream path=%j since=%j', docname, sinceVersion)
  let doc = latestDoc[docname]
  let sinceDoc = doc ? doc.findVersion(sinceVersion) : undefined

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache'
  })

  // let open = true
  req.on('close', () => {
    console.log('CLOSED')
    doc.ee.off('update', send)
    // open = false
  })
  // setinterval sending ':\n\n' every 30s?  I think I prefer the client do that.

  function sendChanges (from, to, ver) {
    const patch = {}
    if (from) {
      patch.jpatch = jpatch.make(from.text, to.text)
      patch.from = from.version
    } else {
      patch.jpatch = jpatch.make('', to.text)
      patch.from = '0'
    }
    debug('sending patch %j', patch)
    const patchEvent = `event: wrapped-jpatch
id: ${to.version}
data: ${JSON.stringify(patch)}\n\n`
    res.write(patchEvent)
    // save patchEvent for the next thread?  Or some other way to save
    // work if we have a lot of watchers?
  }

  function send () {
    doc = latestDoc[docname]
    sendChanges(sinceDoc, doc)
    sinceDoc = doc
  }

  send()
  doc.ee.on('update', send)

  // req.end() on server shutdown?
}

m.app.get('*', async (req, res) => {
  const docname = req.path.slice(1)
  debug('doc', req.params.doc)
  const doc = latestDoc[docname]
  if (doc) {
    res.send(doc.text)
  } else {
    res.status(404).send(m.H`not found, no doc "${docname}"`)
  }
})


function doc (name, text) {
  debug('setting', name, text)
  const current = latestDoc[name]
  if (current && current.text === text) {
    debug('doc text has no change')
    return current
  } else {
    return new Doc(name, text)
  }
}

function vihash (text) {
  const hash = crypto.createHash('sha256')
  hash.update(text);
  return 'sha256-' + hash.digest('base64').replace(/\//g, '_').replace(/\+/g, '-')
}

module.exports = { set: doc, Doc, appmgr: m, app: m.app }
