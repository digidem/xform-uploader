var dragDrop = require('drag-drop')
var path = require('path')
var xhr = require('xhr')

var forms = {}

dragDrop('#app', function (files, pos) {
  files.forEach(function (file) {
    var dirname = path.dirname(file.fullPath)
    var extname = path.extname(file.name)
    var filename = extname === '.xml' ? 'xml_submission_file' : file.name
    forms[dirname] = forms[dirname] || new FormData()
    forms[dirname].append(filename, file, filename)
    console.log(file.name, file.type)
  })
  Object.keys(forms).forEach(function (formKey) {
    console.log('uploading', formKey)
    var formData = forms[formKey]
    var opts = {
      method: 'POST',
      url: 'https://odk.digital-democracy.org/gh/digidem/fediquep-data/submission',
      body: formData,
      headers: {
        'X-OpenRosa-Version': '1.0',
        'Authorization': 'Basic ' + btoa('gmaclennan:6cad3fc4872c592653ba8e8090a2d0e4493049dd')
      },
      beforeSend: function (req) {
        req.upload.addEventListener('progress', progress, false)
      }
    }
    xhr(opts, done);
    function progress (ev) {
      console.log(formKey, 100 * ev.loaded / ev.total)
    }
  })

  function done (err, resp, body) {
    if (err) return console.error(err)
    console.log(body)
  }
})



// function readFile (file, cb) {
//   var reader = new FileReader()
//   reader.addEventListener('load', function (e) {
//     cb(null, e.target.result)
//   })
//   reader.addEventListener('error', cb)
//   reader.readAsText(file)
// }
