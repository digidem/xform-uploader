var events = require('events')
var util = require('util')
var xformToJson = require('xform-to-json')
var FormSet = require('./formset')
var traverse = require('traverse')

function XFormSet () {
  this.forms = new FormSet()
}

util.inherits(XFormSet, events.EventEmitter)

XFormSet.prototype.addForm = function (xml, done) {
  xformToJson(xml, function (err, json) {
    if (err) return done(err)
    var attachmentNames = getAttachmentNamesFromForm(json)
    this.forms.addForm(json, attachmentNames)
    done()
  })
}

XFormSet.prototype.addAttachment = function (name, blob, done) {
  this.forms.addAttachment(name, blob)
  process.nextTick(done)
}

XFormSet.prototype.state = function () {
  return {
    forms: this.getForms(),
    missingAttachments: this.getMissingAttachmentNames(),
    orphanAttachments: this.getOrphanAttachmentNames()
  }
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
