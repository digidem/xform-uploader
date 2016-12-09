var traverse = require('traverse')

function FormSet () {
  this.forms = []
  this.orphanAttachmentNames = {}
  this.missingAttachments = {}
}

// Add an opaque form and attachment names.
FormSet.prototype.addForm = function (formData, pendingAttachments) {
  pendingAttachments = pendingAttachments || []

  var form = {
    data: formData,
    attachments: []
  }

  // Filter out orphan attachments that this form references, adding them to
  // the current form.
  var that = this
  pendingAttachments = pendingAttachments.filter(function (name) {
    var attachment = that.orphanAttachmentNames[name]
    if (attachment) {
      form.attachments.push(attachment)

      // Remove from pendingAttachments and orphanAttachmentNames.
      delete that.orphanAttachmentNames[name]
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
    this.orphanAttachmentNames[attachment.name] = attachment
  }
}

FormSet.prototype.getMissingAttachments = function () {
  return Object.keys(this.missingAttachments)
}

FormSet.prototype.getOrphanAttachments = function () {
  return Object.keys(this.orphanAttachmentNames)
}

module.exports = FormSet
