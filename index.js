var events = require('events')
var util = require('util')
var XFormSet = require('./xformset')
var after = require('after-all')
var d3 = require('d3-request')
var parallel = require('run-parallel')
var series = require('run-series')
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
      self.forms.addAttachment(file.name, file, cb)
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
  var state = this.forms.state()

  var self = this
  const forms = state.forms.map(function (form, idx) {
    form = cloneForm(form)
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

    form.missingAttachments = Object.keys(state.missingAttachments)
      .map(function (key) {
        var name = state.missingAttachments[key]
        return self.forms.forms.missingAttachments[name]
      })
      .filter(function (a) {
        return a.form.data.id === form.data.id
      })
      .map(function (a) {
        return a.name
      })

    return form
  })

  return Object.assign({}, state, {forms: forms})
}

/**
 * Submits forms to an ODK Aggregate server using the Javarosa FormSubmissionAPI spec:
 * https://bitbucket.org/javarosa/javarosa/wiki/FormSubmissionAPI
 *
 * For HTTP Basic Authentication pass `opts.user` and `opts.password`
 *
 * Optionally pass additional headers with `opts.headers`
 *
 * @param {String}   url  Upload URL, should be an OpenRosa compliant server
 * @param {Object}   opts
 * @param {String}   opts.user Username for HTTP Basic Auth
 * @param {String}   opts.password Password for HTTP Basic Auth
 * @param {Object}   opts.headers Any optional headers to send to the server `{header: value}`
 * @param {Function} done Callback
 */
XFormUploader.prototype.submit = function (url, opts, done) {
  if (arguments.length === 2 && typeof opts === 'function') {
    done = opts
    opts = {}
  }
  opts = opts || {}
  opts.headers = opts.headers || {}
  var self = this

  // Create an array of functions that will upload each form
  var uploadTasks = this.state().forms.map(function (form, idx) {
    // Create a form encoded as 'multipart/form-data' and append the form XML
    // and attachments as specified in the Javarosa FormSubmissionAPI spec:
    // https://bitbucket.org/javarosa/javarosa/wiki/FormSubmissionAPI
    var formData = new window.FormData()
    formData.append('xml_submission_file', new window.Blob([form.xml], {type: 'text/xml'}))
    ;(form.attachments || []).forEach(function (attachment) {
      formData.append(attachment.filename, attachment.blob)
    })

    // Set the upload progress of the form on the state
    function onProgress (pe) {
      if (pe.lengthConputable) var progress = pe.loaded / pe.total
      setProp(self.formState, idx, 'uploaded', progress)
      self.emit('change')
    }

    // Return a function that will post the form to the url
    return function (cb) {
      var request = d3.text(url)
        .mimeType('text/xml')
        .on('progress', onProgress)
        .header('X-OpenRosa-Version', '1.0')
        .user(opts.user || null)
        .password(opts.password || null)
      for (var header in opts.headers) {
        request.header(header, opts.headers[header])
      }
      request.post(formData, cb)
    }
  })

  // Upload each multipart-form in series
  series(uploadTasks, done)
}

// TODO(sww): prevent two uploads from being run at the same time
// TODO(sww): don't try to upload the same media twice
XFormUploader.prototype.upload = function (formUploadFn, mediaUploadFn, done) {
  done = done || function () {}

  var self = this
  function onComplete (err) {
    // TODO(sww): fire on partial/full completion, but not on full failure
    self.emit('change')
    done(err)
  }

  if (this.getAttachmentsNotUploaded().length > 0) {
    // Upload media, then forms
    self.uploadAttachments(mediaUploadFn, function (err) {
      if (err) return done(err)
      self.uploadForms(formUploadFn, onComplete)
    })
  } else {
    // Upload forms
    self.uploadForms(formUploadFn, onComplete)
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
  form.attachments = copy.attachments = attachments
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
