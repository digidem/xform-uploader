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
  done = done || function () {}

  var self = this
  var next = after(function (err) {
    self.emit('change')
    done(err)
  })

  var uploadFn = null

  // Upload via HTTP POST
  if (servers.mediaUrl) {
    uploadFn = function (blob, fin) {
      uploadBlobHttp(servers.mediaUrl, blob, fin)
    }
  }

  // If an uploadFn was given, upload all attachments.
  if (uploadFn) {
    // Perform the upload
    this.uploadAttachments(uploadFn, next())
  }

  // if (servers.observationsUrl) {
  //   this.uploadObservations(servers.observationsUrl, next())
  // }
}

XFormUploader.prototype.uploadAttachments = function (uploadFn, done) {
  // Deduce all attachments from state
  // TODO(sww): skip attachments that are already uploaded/uploading
  var attachments = this.state().forms.reduce(function (accum, form) {
    return accum.concat(form.attachments)
  }, [])

  var blobs = attachments.map(function (attachment) {
    return attachment.blob
  })

  var self = this
  uploadBlobs(blobs, uploadFn, function (err, ids) {
    if (err) return done(err)

    // Update uploaded state of attachments and set mediaId.
    attachments.forEach(function (attachment, idx) {
      setProp(self.attachments, attachment.name, 'uploaded', 1)

      var mediaId = ids[idx]
      setProp(self.attachments, attachment.name, 'mediaId', mediaId)
    })

    done(null, ids)
  })
}

// Takes a list of blobs and an async upload function, performs the upload
// process on the blobs, and returns the values returned by the uploading
// mechanism.
function uploadBlobs (blobs, uploadFn, done) {
  // Build upload tasks
  var tasks = blobs.map(function (blob) {
    return function (fin) {
      uploadFn(blob, fin)
    }
  })

  // Upload all attachments
  // TODO(sww): Handle partial failures!
  parallel(tasks, done)
}

// Upload a single blob to an HTTP endpoint using a POST request.
function uploadBlobHttp (httpEndpoint, blob, done) {
  var promise = got(httpEndpoint, {
    body: blob,
    retries: 0
  })

  promise.then(function (res) {
    done(null, res.body)
  })

  promise.catch(done)
}

// Set the key in the object obj[prop] to value. If the object obj[prop] doesn't
// yet exist, create it first.
function setProp (obj, prop, key, value) {
  if (!obj[prop]) {
    obj[prop] = {}
  }
  obj[prop][key] = value
}

module.exports = XFormUploader
