var fs = require('fs')
var path = require('path')
var https = require('https')

var express = require('express')
var app = express()
var favicon = require('serve-favicon')
var hbs = require('hbs')
var port = 5090

var Twit = require('twit')
var twitterAccount = require('./twitterAccountKey.json')
var T = new Twit(twitterAccount)

var admin = require('firebase-admin')
var serviceAccount = require('./serviceAccountKey.json')
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://lmttfyi.firebaseio.com'
})
var db = admin.database()

/*
* express server setup
*/
app.set('view engine', 'html')
app.engine('html', hbs.__express)
app.use(favicon(path.join(__dirname, '/public/img/favicon/favicon.ico')))

hbs.registerPartial('footer', fs.readFileSync(path.join(__dirname, '/views/footer.html'), 'utf8'))
app.use(express.static(path.join(__dirname, '/public')))
app.listen(port)

app.get('/', function (req, res) {
  return res.render('index')
})

app.get('/privacy', function (req, res) {
  return res.render('privacy')
})

app.get('/contentpolicy', function (req, res) {
  return res.render('contentpolicy')
})

app.post('/api/adduser/:twitterId', function (req, res) {
  db.ref('users').child(req.params.twitterId).once('value', function (snapshot) {
    var data = snapshot.val()
    if (data) {
      return res.status(200).send('ok')
    } else {
      T.get('users/show', { user_id: req.params.twitterId }, function (err, data, response) {
        return db.ref('users').child(data.id).set({
          name: data.name,
          profile_image_url: data.profile_image_url,
          screen_name: data.screen_name
        }).then(function () {
          res.status(200).send('ok')
        }, function () {
          res.status(400).send('ok')
        })
      })
    }
  })
})

app.get('/https://mobile.twitter.com/:user/status/:id', returnTweetPage)
app.get('/https://twitter.com/:user/status/:id', returnTweetPage)

app.use(notfound)

function returnTweetPage(req, res) {
  function returnData (embed) {
    return res.render('tweet', {
      embed: embed
    })
  }
  db.ref('posts/' + req.params.id).once('value', function (snapshot) {
    var data = snapshot.val()
    if (data) {
      returnData(unescape(data.tweet.html))
    } else {
      https.get({
        host: 'publish.twitter.com',
        path: '/oembed?omit_script=true&hide_thread=true&url=https%3A%2F%2Ftwitter.com%2F' + req.params.user + '%2Fstatus%2F' + req.params.id
      }, function (resp) {
        resp.setEncoding('utf8')
        if (resp.statusCode === 200) {
          resp.on('data', function (d) {
            d = JSON.parse(d)
            db.ref('posts/' + req.params.id)
              .set({
                tweet: d
              })
              .then(function () {
                returnData(unescape(d.html))
              })
          })
        } else {
          return res.render('404', {msg: 'could not find the tweet you are looking for'})
        }
      }).on('error', function (e) {
        return res.render('404', {msg: 'could not find the tweet you are looking for'})
      })
    }
  })
}
function notfound (req, res, next) {
  res.status(404)
  // respond with html page
  if (req.accepts('html')) return res.render('404', {msg: 'could not find what you are looking for'})

  // respond with json
  if (req.accepts('json')) return res.send({ error: 'Not found' })

  // default to plain-text. send()
  return res.type('txt').send('Page Not found')
}
