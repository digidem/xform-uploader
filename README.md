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
          id: '1231421531', // not set on attachments until after upload
          blob: attachment1,
          uploaded: 1
        }, {
          filename: 'originalFilename2.jpg',
          id: null,
          blob: attachment2,
          uploaded: 0
        }, {
          filename: 'originalFilename3.jpg',
          id: null,
          blob: null, // we haven't attached the file yet, but we know there should be one from parsing the form XML
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
  observationUpload: 'http://localhost:4001/observations/add',
  mediaUpload: 'http://localhost:4002/file/add'
})
```

## API

...

## Inner Modules

This module contains two inner modules: `FormSet` and `XFormSet`, which are more
general purpose and may useful outside of the context of this wrapping module,
which is just a small bit of glue.

# License

ISC

