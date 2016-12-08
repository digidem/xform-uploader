var traverse = require('traverse')

function FormSet () {
  this.forms = []
  this.orphanAttachments = []
  this.missingAttachments = []
}

FormSet.prototype.addForm = function (formJson) {
  var form = {
    data: formJson,
    attachments: []
  }

  // Find all references to attachments.
  var pendingAttachments = getAttachmentNamesFromForm(formJson)

  // Filter out orphan attachments that this form references, adding them to
  // the current form.
  this.orphanAttachments.forEach(function (attachment) {
    var idx = pendingAttachments.indexOf(attachment.name)
    if (idx !== -1) {
      form.attachments.push(attachment)

      // Remove from pendingAttachments and orphanAttachments.
      pendingAttachments.slice(idx, idx + 1)
      delete this.orphanAttachments[attachment.name]
    }
  })

  // Add all other attachment references to the missing list.
  this.missingAttachments = this.missingAttachments.concat(pendingAttachments)

  return form
}

FormSet.prototype.addAttachment = function (binaryString) {
}

FormSet.prototype.getMissingAttachments = function () {
  return this.missingAttachments
}

FormSet.prototype.getOrphanAttachments = function () {
}

// Traverse the entire 'form' object, looking for string values that appear to
// end in a known file extension.
function getAttachmentNamesFromForm (form) {
  var fileRegex = /^.+\.\w+$/

  var result = []
  traverse(form).forEach(function (entry) {
    if (typeof entry === 'string' && fileRegex.test(entry)) {
      result.push(entry)
    }
  })
  return result
}

module.exports = FormSet
