var events = require('events')
var util = require('util')
var XFormSet = require('./xformset')
var after = require('after-all')
var got = require('got')
var parallel = require('run-parallel')
var clone = require('clone')

function XFormUploader () {
  this.forms = new XFormSet()
  this.attachments = {}
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
  // Transform state by adding relevant upload/etc data.
  var state = clone(this.forms.state())

  var self = this
  state.forms.forEach(function (form) {
    form.attachments.forEach(function (attachment) {
      var data = self.attachments[attachment.name]
      if (!data) {
        // Default values to add
        data = {
          uploaded: 0,
          mediaId: null
        }
      }
      Object.assign(attachment, data)
    })
  })

  return state
}

XFormUploader.prototype.upload = function (servers, done) {
  var self = this

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
    // TODO(sww): Handle partial failures!
    parallel(tasks, function (err, ids) {
      console.log('upload', err, ids)

      if (err) return done(err)

      // Update uploaded state of attachments
      attachments.forEach(function (attachment, idx) {
        set(self.attachments, attachment.name, 'uploaded', 1)

        var mediaId = ids[idx]
        set(self.attachments, attachment.name, 'mediaId', mediaId)
      })
      self.emit('change')
      done(null)
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

function set (obj, prop, key, value) {
  if (!obj[prop]) {
    obj[prop] = {}
  }
  obj[prop][key] = value
}

module.exports = XFormUploader
