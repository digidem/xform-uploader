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
  }, [
    'pic.jpg',
    'foo.png'
  ])

  t.deepEqual(set.getMissingAttachmentNames(), ['pic.jpg', 'foo.png'])
  t.equal(set.getOrphanAttachmentNames().length, 0)
  t.equal(set.forms.length, 1)

  t.end()
})

test('orphaned attachments', function (t) {
  var set = new FormSet()

  var blob = new Buffer('data!')
  set.addAttachment('foo.png', blob)

  var form = {
    id: 'foo',
    media: [
      'pic.jpg',
      'foo.png'
    ]
  }

  set.addForm(form, ['pic.jpg', 'foo.png'])

  t.deepEqual(set.getMissingAttachmentNames(), ['pic.jpg'])
  t.deepEqual(set.getOrphanAttachmentNames(), [])
  t.equal(set.forms.length, 1)
  t.deepEqual(set.forms[0], {
    data: form,
    attachments: [
      {
        name: 'foo.png',
        blob: blob
      }
    ]
  })

  t.end()
})

test('full proper form set (attach, form, attach)', function (t) {
  var set = new FormSet()

  set.addAttachment('foo.png', new Buffer('pics pics pics'))

  var form = {
    id: 'foo',
    media: [
      'pic.jpg',
      'foo.png'
    ]
  }
  set.addForm(form, form.media)

  set.addAttachment('pic.jpg', new Buffer('image image image'))

  t.deepEqual(set.getMissingAttachmentNames(), [])
  t.deepEqual(set.getOrphanAttachmentNames(), [])
  t.equal(set.forms.length, 1)
  t.equal(set.forms[0].attachments.length, 2)

  t.end()
})
