var events = require('events')
var util = require('util')
var XFormSet = require('./xformset')
var after = require('after-all')
var got = require('got')
var parallel = require('run-parallel')
var clone = require('clone')
var SimpleFileReader = require('./file-reader')

function XFormUploader () {
  this.forms = new XFormSet()
  this.attachmentState = {}
  this.formState = {}
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
    if (file.name.endsWith('.xml')) {
      // XML form
      SimpleFileReader.readAsText(file, function (err, xml) {
        if (err) return cb(err)
        self.forms.addForm(xml, cb)
      })
    } else {
      // Attachment
      SimpleFileReader.readAsBinaryString(file, function (err, blob) {
        if (err) return cb(err)
        self.forms.addAttachment(file.name, blob, cb)
      })
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
  state.forms.forEach(function (form, idx) {
    Object.assign(form, self.formState[idx])

    form.attachments.forEach(function (attachment) {
      var data = self.attachmentState[attachment.name]
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

// TODO(sww): prevent two uploads from being run at the same time
// TODO(sww): don't try to upload the same media twice
XFormUploader.prototype.upload = function (servers, done) {
  done = done || function () {}

  var self = this
  function onComplete (err) {
    // TODO(sww): fire on partial/full completion, but not on full failure
    self.emit('change')
    done(err)
  }

  var unuploadedAttachments = this.getAttachmentsNotUploaded()
  if (unuploadedAttachments.length > 0) {
    // Upload media, then forms
    uploadAttachments(function (err) {
      if (err) return done(err)
      uploadForms(onComplete)
    })
  } else {
    // Upload forms
    uploadForms(onComplete)
  }

  function uploadAttachments (fin) {
    var mediaUploadFn = null

    // Upload via HTTP POST
    if (servers.mediaUrl) {
      mediaUploadFn = function (blob, cb) {
        uploadBlobHttp(servers.mediaUrl, blob, cb)
      }
    }

    if (mediaUploadFn) {
      self.uploadAttachments(mediaUploadFn, fin)
    } else {
      fin(new Error('unable to find an upload mechanism for media'))
    }
  }

  function uploadForms (fin) {
    var observationsUploadFn = null

    if (servers.observationsUrl) {
      observationsUploadFn = function (form, fin) {
        uploadBlobHttp(servers.observationsUrl, form, function (err, res) {
          if (res) {
            res = res.trim()
          }
          fin(err, res)
        })
      }
    }

    // If an mediaUploadFn was given, upload all attachments.
    if (observationsUploadFn) {
      // Perform the upload
      self.uploadForms(observationsUploadFn, fin)
    } else {
      fin(new Error('unable to find an upload mechanism for observations'))
    }
  }
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
      setProp(self.attachmentState, attachment.name, 'uploaded', 1)

      var mediaId = ids[idx]
      setProp(self.attachmentState, attachment.name, 'mediaId', mediaId)
    })

    done(null, ids)
  })
}

XFormUploader.prototype.uploadForms = function (uploadFn, done) {
  // Avoids copying attachments
  function cloneForm (form) {
    var attachments = form.attachments
    form.attachments = undefined

    var copy = clone(form)

    form.attachments = attachments

    return copy
  }

  var forms = this.state().forms.map(function (form, idx) {
    // Transform forms to refer to mediaIds rather than JS references.
    var copy = cloneForm(form)
    copy.attachments = form.attachments.map(function (attachment) {
      return attachment.mediaId
    })
    return copy
  })

  // Transform forms into osm observation json blobs.
  var observations = forms
    .map(function (form) {
      return {
        type: 'observation',
        tags: form
      }
    })
    .map(JSON.stringify)

  var self = this
  uploadBlobs(observations, uploadFn, function (err, ids) {
    if (err) return done(err)

    // Set forms as uploaded.
    ids.forEach(function (_, idx) {
      setProp(self.formState, idx, 'uploaded', 1)
    })

    done(null)
  })
}

XFormUploader.prototype.getAttachmentsNotUploaded = function () {
  return this.state().forms.reduce(function (accum, form) {
    var notUploadedAttachments = form.attachments.filter(function (attachment) {
      return !attachment.uploaded
    })
    return accum.concat(notUploadedAttachments)
  }, [])
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
    retries: 0,
    headers: {
      'Content-Type': 'application/json'
    }
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
