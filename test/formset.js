var test = require('tape')
var FormSet = require('../formset')

test('basic', function (t) {
  var set = new FormSet()

  set.addForm({
    id: 'foo',
    attachments: [
      'pic.jpg'
    ]
  })

  t.deepEqual(set.getMissingAttachments(), ['pic.jpg'])

  t.end()
})
