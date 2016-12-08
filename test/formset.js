var test = require('tape')
var FormSet = require('../formset')

test('missing attachments', function (t) {
  var set = new FormSet()

  set.addForm({
    id: 'foo',
    attachments: [
      'pic.jpg',
      'foo.png'
    ]
  })

  t.deepEqual(set.getMissingAttachments(), ['pic.jpg', 'foo.png'])

  t.end()
})

test('orphaned attachments', function (t) {
  var set = new FormSet()

  set.addAttachment({
    name: 'foo.png'
  })

  var form = {
    id: 'foo',
    media: [
      'pic.jpg',
      'foo.png'
    ]
  }

  set.addForm(form)

  t.deepEqual(set.getMissingAttachments(), ['pic.jpg'])
  t.deepEqual(set.getOrphanAttachments(), [])
  t.equal(set.forms.length, 1)
  t.deepEqual(set.forms[0], {
    data: form,
    attachments: [
      {
        name: 'foo.png'
      }
    ]
  })

  t.end()
})

test('full proper form set (attach, form, attach)', function (t) {
  var set = new FormSet()

  set.addAttachment({
    name: 'foo.png'
  })

  var form = {
    id: 'foo',
    media: [
      'pic.jpg',
      'foo.png'
    ]
  }
  set.addForm(form)

  set.addAttachment({
    name: 'pic.jpg'
  })

  t.deepEqual(set.getMissingAttachments(), [])
  t.deepEqual(set.getOrphanAttachments(), [])
  t.equal(set.forms.length, 1)
  t.equal(set.forms[0].attachments.length, 2)

  t.end()
})
