var events = require('events')
var util = require('util')
var XFormSet = require('./xformset')
var after = require('after-all')
var got = require('got')
var parallel = require('run-parallel')

function XFormUploader () {
  this.forms = new XFormSet()
}

util.inherits(XFormUploader, events.EventEmitter)

XFormUploader.prototype.add = function (files, done) {
  if (!Array.isArray(files)) {
    files = [files]
  }

  var self = this

  var next = after(function (err) {
    finished(err)
  })

  function add (file) {
    var cb = next()
    var reader = new window.FileReader()
    if (file.name.endsWith('.xml')) {
      // XML form
      var xml = reader.readAsText(file)
      self.forms.addForm(xml, cb)
    } else {
      // Attachment
      var blob = reader.readAsBinaryString(file)
      self.forms.addAttachment(file.name, blob, cb)
    }
  }

  files.forEach(add)

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
    // Deduce all attachments from state
    // TODO(sww): skip attachments that are already uploaded/uploading
    var attachments = this.state().forms.reduce(function (accum, form) {
      return accum.concat(form.attachments)
    }, [])

    // Build upload tasks
    var tasks = attachments.map(function (attachment) {
      return function (done) {
        uploadMediaBlob(servers.media, attachment.blob, done)
      }
    })

    // Upload all attachments
    parallel(tasks, function (err, ids) {
      console.log('upload', err, ids)
      // TODO(sww): update uploaded state of attachments
    })
  }
}

function uploadMediaBlob (httpEndpoint, blob, done) {
  console.log('uploading')

  var promise = got(httpEndpoint, {
    body: blob,
    retries: 0
  })

  promise.then(function (res) {
    done(null, res.body)
  })

  promise.catch(done)
}

module.exports = XFormUploader
