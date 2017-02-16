var xformToJson = require('xform-to-json')
var FormSet = require('./formset')
var traverse = require('traverse')

function XFormSet () {
  this.forms = new FormSet()
}

XFormSet.prototype.addForm = function (name, xml, done) {
  done = done || function () {}
  var self = this

  xformToJson(xml, { geojson: true }, function (err, json) {
    if (err) return done(err)
    var attachmentNames = getAttachmentNamesFromForm(json)
    self.forms.addForm(name, json, {
      pendingAttachments: attachmentNames,
      xml: xml
    })
    done()
  })
}

XFormSet.prototype.addAttachment = function (name, blob, done) {
  done = done || function () {}
  this.forms.addAttachment(name, blob)
  process.nextTick(done)
}

XFormSet.prototype.state = function () {
  return {
    forms: this.forms.getForms(),
    missingAttachments: this.forms.getMissingAttachmentNames(),
    orphanAttachments: this.forms.getOrphanAttachmentNames()
  }
}

XFormSet.prototype.getForms = function () {
  return this.forms.getForms()
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

module.exports = XFormSet
