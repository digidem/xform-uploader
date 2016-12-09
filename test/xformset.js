var test = require('tape')
var XFormSet = require('../xformset')

test('missing attachments', function (t) {
  var set = new XFormSet()

  var xml = `
    <form id="foo">
      <attachments>
        <file>pic.jpg</file>
        <file>foo.png</file>
      </attachments>
    </form>
  `

  set.addForm(xml, ready)

  function ready () {
    var state = set.state()
    t.deepEqual(state.missingAttachments, ['pic.jpg', 'foo.png'])
    t.same(state.forms.length, 1)
    t.same(state.orphanAttachments.length, 0)

    t.end()
  }
})

test('orphaned attachments', function (t) {
  var set = new XFormSet()

  var blob = new Buffer('data!')
  set.addAttachment('foo.png', blob)

  var xml = `
    <form id="foo">
      <media>
        <file>pic.jpg</file>
        <file>foo.png</file>
      </media>
    </form>
  `

  set.addForm(xml, ready)

  function ready () {
    var state = set.state()
    t.deepEqual(state.missingAttachments, ['pic.jpg'])
    t.same(state.forms.length, 1)
    t.same(state.orphanAttachments.length, 0)

    t.end()
  }
})

test('attachment matching', function (t) {
  var set = new XFormSet()

  var form = `
    <thing id="bar">
      <doodads>
        <doodad>short.mov</doodad>
        <doodad>long.3gpp</doodad>
        <doodad>bob.</doodad>
        <doodad>.avi</doodad>
        <doodad>I have spaces.New sentence</doodad>
        <doodad>this-maybe_will?match.17pm</doodad>
      </doodads>
    </thing>
  `
  set.addForm(form, ready)

  function ready () {
    var state = set.state()
    t.deepEqual(state.missingAttachments, ['short.mov', 'long.3gpp', 'this-maybe_will?match.17pm'])
    t.equal(state.orphanAttachments.length, 0)
    t.equal(state.forms.length, 1)

    t.end()
  }
})
