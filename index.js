const request = require('request-promise')
const AWS = require('aws-sdk')
const awsIot = require('aws-iot-device-sdk')

const {SYNOLOGY_HOST, SYNOLOGY_USER, SYNOLOGY_PASS, AWS_ACCESS_KEY, AWS_SECRET_ACCESS_KEY, AWS_IOT_ENDPOINT_HOST, AWS_REGION, DEBUG} = process.env;

var session_id

const authenticate = () => request(`${SYNOLOGY_HOST}/webapi/auth.cgi?api=SYNO.API.Auth&method=Login&version=3&account=${SYNOLOGY_USER}&passwd=${SYNOLOGY_PASS}&session=SurveillanceStation&format=sid`)
  .then(JSON.parse)
  .tap(console.info)
  .then(response => session_id = response.data.sid)

const get_cameras = () => request(`${SYNOLOGY_HOST}/webapi/entry.cgi?api=SYNO.SurveillanceStation.Camera&method=List&version=3&_sid=${session_id}`)
  .then(JSON.parse)
  .then(data => data.data.cameras)
  .then(get_feed_urls)
  .tap(console.info)

const get_feed_urls = (cameras) => cameras.map(camera => {
  return {
    name: camera.name,
    external: camera.name.includes("external"),
    internal: camera.name.includes("internal"),
    status: camera.status,
    jpg: `${SYNOLOGY_HOST}/webapi/entry.cgi?api=SYNO.SurveillanceStation.Camera&version=1&method=GetSnapshot&cameraId=${camera.id}&_sid=${session_id}`,
    video: `${SYNOLOGY_HOST}/webapi/SurveillanceStation/videoStreaming.cgi?api=SYNO.SurveillanceStation.VideoStream&version=1&method=Stream&cameraId=${camera.id}&_sid=${session_id}`,
    mjpeg: `${SYNOLOGY_HOST}/webapi/SurveillanceStation/videoStreaming.cgi?api=SYNO.SurveillanceStation.VideoStream&version=1&method=Stream&cameraId=${camera.id}&_sid=${session_id}&format=mjpeg`
  }
})

const publish = (cameras) => Promise.all(cameras.map(camera => {
  let params = {
    thingName: `camera_${camera.name.replace(new RegExp(" ", 'g'), "_")}`,
    thingTypeName: 'camera',
    attributePayload: {
      attributes: {
        external: camera.external.toString(),
        internal: camera.internal.toString(),
      }
    },
  }
  return iot.createThing(params).promise()
    .catch(() => iot.updateThing(params).promise())
    .then(() => iotdata.updateThingShadow({
      thingName: params.thingName,
      payload: JSON.stringify({state: {reported: camera}})
    }).promise())

}))

const iotdata = new AWS.IotData({
  endpoint: AWS_IOT_ENDPOINT_HOST,
  accessKeyId: AWS_ACCESS_KEY,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: AWS_REGION,
  debug: DEBUG,
})

const iot = new AWS.Iot({
  accessKeyId: AWS_ACCESS_KEY,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: AWS_REGION,
  debug: DEBUG,

})

authenticate()
  .then(get_cameras)
  .then(publish)
