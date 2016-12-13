# xform-uploader

> Parse a set of XForms and attachments, and upload them to an `odk-aggregate`
> server or `osm-p2p` + `hyperdrive`.

## Example

```js
var uploader = new Uploader()

uploader.add([
  xmlFile1,
  attachment1,
  attachment2,
  xmlFile2,
  attachment4,
  attachment5
], function (err) {
  console.log(uploader.state())
})

// output:
{
  forms: [
    {
      data: parsedFormAsGeoJSON,
      uploaded: 0 // 0-1 progress uploaded, 1 === upload complete
      attachments: [
        {
          filename: 'originalFilename.jpg',
          mediaId: '1231421531.jpg', // not set on attachments until after upload
          blob: attachment1,
          uploaded: 1
        }, {
          filename: 'originalFilename2.jpg',
          mediaId: null,
          blob: attachment2,
          uploaded: 0
        }
      ]
    }
  ],
  missingAttachments: [
    // A form references this media, but the media itself has not been provided.
    'originalFilename3.jpg'
  ],
  orphanAttachments: [
    // This media was provided, but no form references it.
    'otherFilename.png'
  ]
}

// fires every time the internal state changes
uploader.on('change', function () { console.log(uploader.state()) })

uploader.upload({
  observationsUrl: 'http://localhost:4001/obs/create',
  mediaUrl: 'http://localhost:4002/media/jpg'
})
```

## API

```js
var Uploader = require('xform-uploader')
var uploader = new Uploader()
```

### uploader.add(files, done)

Add an array of [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File)s to the uploader. Once complete, the callback `done` will be called with the form `function (err)`.

### uploader.state()

Synchronously return the instantaneous state of the Uploader as an object. It will have the following structure:

```js
{
  forms: [
    {
      data: parsedFormAsGeoJSON,
      uploaded: 0 // 0-1 progress uploaded, 1 === upload complete
      attachments: [
        {
          filename: 'originalFilename.jpg',
          mediaId: '1231421531', // or 'null' until uploaded
          blob: attachment1,
          uploaded: 1
        }, {
          filename: 'originalFilename2.jpg',
          mediaId: null,
          blob: attachment2,
          uploaded: 0
        }
      ]
    }
  ],
  missingAttachments: [
    // A form references this media, but the media itself has not been provided.
    'originalFilename3.jpg'
  ],
  orphanAttachments: [
    // This media was provided, but no form references it.
    'otherFilename.png'
  ]
}
```

### uploader.on('change', function () { ... })

This event is emitted whenever the public-facing state of the Uploader has changed.

### uploader.upload(servers, done)

Upload the forms and their attachments to various servers.

`servers` is an object. Currently the following keys are accepted:

- `observationsUrl`: an HTTP URL of a POST endpoint to receive the osm observation data that each form represents.
- `mediaUrl`: an HTTP URL of a POST endpoint to receive the media data that each attachment represents.

## Inner Modules

This module contains two inner modules: `FormSet` and `XFormSet`, which are more
general purpose and may useful outside of the context of the outer module,
which is just a small amount of glue code.

# License

ISC

