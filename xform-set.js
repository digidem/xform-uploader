var events = require('events')
var util = require('util')
var xformToJson = require('xform-to-json')
var FormSet = require('./formset')

function XFormSet () {
  this.forms = new FormSet()
}

util.inherits(XFormSet, events.EventEmitter)

XFormSet.prototype.addForm = function (xml) {
  xformToJson(xml, function (err, json) {
    var attachmentNames = getAttachmentNamesFromForm(json)
    this.forms.addForm(json, attachmentNames)
  })
}

XFormSet.prototype.addAttachment = function (name, blob) {
  this.forms.addAttachment(file.name, blob)
}

XFormSet.prototype.state = function () {
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
