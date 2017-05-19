var test = require('tape')
var Uploader = require('../')

test('Form submission', function (t) {
  var uploader = new Uploader()

  var xml = `
    <form id="foo">
      <foo>bar</foo>
      <baz>qux</baz>
    </form>
  `

  var xmlFile = new window.File([xml], 'form.xml', {type: 'text/xml'})

  uploader.add(xmlFile, function (err) {
    t.error(err)
    uploader.submit('https://odk.digital-democracy.org/gh/digidem-test/xform-test/submission', {
      headers: {
        authorization: 'token 32ad3a5ff25301acbe1b3b298140d619ab2b01ab'
      }
    }, function (err, data) {
      console.log('error', err)
      console.log(data)
    })
  })
})
