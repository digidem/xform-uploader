var events = require('events')
var util = require('util')
var XFormSet = require('./xformset')
var after = require('after-all')
var d3 = require('d3-request')
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

  files.forEach(add)

  function add (file) {
    var cb = next()
    if (file.name.endsWith('.xml')) {
      // XML form
      SimpleFileReader.readAsText(file, function (err, xml) {
        if (err) return cb(err)
        self.forms.addForm(file.name, xml, cb)
      })
    } else {
      // Attachment
      SimpleFileReader.readAsArrayBuffer(file, function (err, blob) {
        if (err) return cb(err)
        self.forms.addAttachment(file.name, Buffer.from(blob), cb)
      })
    }
  }

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
    var data = self.formState[idx]
    if (!data) {
      // Default values to add
      data = {
        uploaded: 0
      }
    }
    Object.assign(form, data)

    form.attachments.forEach(function (attachment) {
      data = self.attachmentState[attachment.name]
      if (!data) {
        // Default values to add
        data = {
          uploaded: 0,
          mediaId: null
        }
      }
      Object.assign(attachment, data)
    })

    form.missingAttachments = Object.values(state.missingAttachments)
      .map(function (name) {
        return self.forms.forms.missingAttachments[name]
      })
      .filter(function (a) {
        return a.form.data.id === form.data.id
      })
      .map(function (a) {
        return a.name
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

    // HTTP POST upload to a ddem-observation-server.
    if (servers.mediaUrl) {
      mediaUploadFn = function (blob, cb) {
        return d3.request(servers.mediaUrl)
          // map response to text (d3.request returns the xhr instance by default)
          .mimeType('text/plain')
          .response(mapTextResponse)
          .post(blob, cb)
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

    // HTTP POST upload to a ddem-observation-server.
    if (servers.observationsUrl) {
      observationsUploadFn = function (form, cb) {
        return d3.request(servers.observationsUrl)
          .header('Content-Type', 'application/json')
          .mimeType('text/plain')
          .response(mapTextResponse)
          .post(form, cb)
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
  // TODO(sww): skip attachments that are already uploaded/uploading

  // Deduce all attachments from state
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

      setProp(self.attachmentState, attachment.name, 'mediaId', ids[idx])
    })

    done(null, ids)
  })
}

XFormUploader.prototype.uploadForms = function (uploadFn, done) {
  // TODO(sww): skip forms that are already uploaded/uploading

  // Produce a copy of the forms that refer to mediaIds rather than JS
  // references.
  var forms = this.state().forms.map(function (form, idx) {
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

// Make a deep copy of a form, but avoid copying its attachments.
function cloneForm (form) {
  var attachments = form.attachments
  form.attachments = []
  var copy = clone(form)
  form.attachments = attachments
  return copy
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

function mapTextResponse (xhr) {
  return typeof xhr.responseText === 'string' && xhr.responseText.trim()
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
