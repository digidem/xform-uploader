var events = require('events')
var util = require('util')
var XFormSet = require('./xformset')

function XFormUploader () {
  this.forms = new XFormSet()
}

util.inherits(XFormUploader, events.EventEmitter)

XFormUploader.prototype.add = function (file, done) {
  var reader = new window.FileReader()
  if (file.name.endsWith('.xml')) {
    // XML form
    var xml = reader.readAsText(file)
    this.forms.addForm(xml, finished)
  } else {
    // Attachment
    var blob = reader.readAsBinaryString(file)
    this.forms.addAttachment(file.name, blob, finished)
  }

  var self = this
  function finished () {
    self.emit('change')
    done()
  }
}

XFormUploader.prototype.state = function () {
  // TODO(sww): transform this object /w relevant upload data
  return this.forms.state()
}

XFormUploader.prototype.upload = function (servers) {
}

