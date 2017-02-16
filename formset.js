function FormSet () {
  this.forms = []
  this.orphanAttachments = {}
  this.missingAttachments = {}
}

// Add an opaque form and attachment names.
FormSet.prototype.addForm = function (name, formData, opts) {
  opts = opts || {}
  var pendingAttachments = opts.pendingAttachments || []

  var form = {
    name: name,
    data: formData,
    attachments: []
  }

  if (opts.xml) form.xml = opts.xml

  // Filter out orphan attachments that this form references, adding them to
  // the current form.
  var that = this
  pendingAttachments = pendingAttachments.filter(function (name) {
    var attachment = that.orphanAttachments[name]
    if (attachment) {
      form.attachments.push(attachment)

      // Remove from pendingAttachments and orphanAttachments.
      delete that.orphanAttachments[name]
      return false
    } else {
      return true
    }
  })

  // Add all other attachment references to the missing list.
  pendingAttachments.forEach(function (name) {
    that.missingAttachments[name] = {
      name: name,
      form: form
    }
  })

  this.forms.push(form)

  return form
}

FormSet.prototype.addAttachment = function (name, blob) {
  if (!name || !blob) {
    throw new Error('must specify name and blob')
  }

  var attachment = {
    name: name,
    blob: blob
  }

  var entry = this.missingAttachments[attachment.name]
  if (entry) {
    // Add to the form and remove from the missing attachment set.
    entry.form.attachments.push(attachment)
    delete this.missingAttachments[attachment.name]
  } else {
    // Otherwise, add to the orphan list.
    this.orphanAttachments[attachment.name] = attachment
  }
}

FormSet.prototype.getMissingAttachmentNames = function () {
  return Object.keys(this.missingAttachments)
}

FormSet.prototype.getOrphanAttachmentNames = function () {
  return Object.keys(this.orphanAttachments)
}

FormSet.prototype.getForms = function () {
  return this.forms
}

module.exports = FormSet
