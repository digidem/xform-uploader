module.exports = {
  readAsText: function (file, done) {
    var reader = new window.FileReader()
    reader.addEventListener('load', function (e) {
      done(null, e.target.result)
    })
    reader.addEventListener('error', done)
    reader.readAsText(file)
  },

  readAsArrayBuffer: function (file, done) {
    var reader = new window.FileReader()
    reader.addEventListener('load', function (e) {
      done(null, e.target.result)
    })
    reader.addEventListener('error', done)
    reader.readAsArrayBuffer(file)
  }
}
