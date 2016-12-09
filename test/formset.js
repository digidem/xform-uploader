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

// TODO(sww): add this to index.js, not FormSet
// test('attachment matching', function (t) {
//   var set = new FormSet()

//   var form = {
//     id: 'foo',
//     things: [
//       'short.mov',
//       'long.3gpp',
//       'bob.',
//       '.avi',
//       'I have spaces.New sentence',
//       'this-maybe_will?match.17pm'
//     ]
//   }
//   set.addForm(form, form.things)

//   t.deepEqual(set.getMissingAttachmentNames(), ['short.mov', 'long.3gpp', 'this-maybe_will?match.17pm'])
//   t.equal(set.getOrphanAttachmentNames().length, 0)
//   t.equal(set.forms.length, 1)

//   t.end()
// })
