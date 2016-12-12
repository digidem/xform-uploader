var inherits = require('inherits')
var EventEmitter = require('events').EventEmitter
var path = require('path')
var xform2json = require('xform-to-json')

module.exports = XFormUploader
inherits(XFormUploader, EventEmitter)

function XFormUploader (opts) {
  opts = opts || {}
  this.auth = opts.auth
  this.url = opts.url
  this.pendingAttachments = {}
  this.reading = 0
  this.uploading = 0
  this.forms = {}
}

XFormUploader.prototype.add = function (file) {
  var self = this
  if (Array.isArray(file)) {
    return file.forEach(function (f) { self.add(f) })
  }
  var extname = path.extname(file.name)
  if (extname !== '.xml') {
    self._addAttachment(file)
  } else {
    self._addXml(file)
  }
}

XFormUploader.prototype._addAttachment = function (file) {
  var attached = false
  this.forms.forEach(function (form) {
    ;(form.attachments || []).forEach(function (attachment) {
      if (attachment.name === file.name) {
        attachment.file = file
        attached = true
      }
    })
  })
  if (attached) return
  this.pendingAttachments[file.name] = file
}

XFormUploader.prototype._addXml = function (file) {
  var self = this
  self.reading++
  readFile(file, function (err, xml) {
    if (--self.reading === 0) self.emit('_ready')
    if (err) return console.error(err)
    xform2json()
  })
}

XFormUploader.prototype.ready = function (fn) {
  var self = this
  if (self.reading) {
    self.once('_ready', function () { self.ready(fn) })
  } else process.nextTick(fn)
}

function readFile (file, cb) {
  var reader = new window.FileReader()
  reader.addEventListener('load', function (e) {
    cb(null, e.target.result)
  })
  reader.addEventListener('error', cb)
  reader.readAsText(file)
}
