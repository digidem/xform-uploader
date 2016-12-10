var events = require('events')
var util = require('util')
var XFormSet = require('./xformset')
var after = require('after-all')
var got = require('got')

function XFormUploader () {
  this.forms = new XFormSet()
}

util.inherits(XFormUploader, events.EventEmitter)

XFormUploader.prototype.add = function (files, done) {
  if (!Array.isArray(files)) {
    files = [files]
  }

  var next = after(function (err) {
    finished(err)
  })

  function add (file) {
    var cb = next()
    var reader = new window.FileReader()
    if (file.name.endsWith('.xml')) {
      // XML form
      var xml = reader.readAsText(file)
      this.forms.addForm(xml, cb)
    } else {
      // Attachment
      var blob = reader.readAsBinaryString(file)
      this.forms.addAttachment(file.name, blob, cb)
    }
  }

  files.forEach(add)

  var self = this
  function finished (err) {
    if (err) return done(err)
    self.emit('change')
    done()
  }
}

XFormUploader.prototype.state = function () {
  // TODO(sww): transform this object /w relevant upload data
  return this.forms.state()
}

XFormUploader.prototype.upload = function (servers) {
  if (servers.media) {
    // TODO(sww): upload all attachments
    // uploadMediaBlob(servers.media, blob, function (err, id) {
    //   ...
    // })
  }
}

function uploadMediaBlob (httpEndpoint, blob, done) {
  var promise = got(httpEndpoint, {
    body: blob
  })

  promise.then(function () {
    // TODO(sww): capture and report the media id
    done(null, 'an_id')
  })

  promise.catch(done)
}
