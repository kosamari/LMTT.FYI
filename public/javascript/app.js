/* global firebase Quill XMLHttpRequest */
(function () {
  'use strict'
  var tweetId = window.location.pathname.split('/').pop()
  var config = {
    apiKey: 'AIzaSyCRG4xQVnXUiCCU6NhefFUdDOUgyUaMYAw',
    authDomain: 'lmttfyi.firebaseapp.com',
    databaseURL: 'https://lmttfyi.firebaseio.com',
    storageBucket: 'lmttfyi.appspot.com',
    messagingSenderId: '338880669204'
  }

  var $authBtn = document.getElementById('authBtn')
  var $editBtn = document.getElementById('editBtn')
  var $delBtn = document.getElementById('delBtn')
  var $delModal = document.getElementById('delModal')
  var $delYesBtn = document.getElementById('delYesBtn')
  var $delNoBtn = document.getElementById('delNoBtn')
  var $addBtn = document.getElementById('addBtn')
  var $saveBtn = document.getElementById('saveBtn')
  var $userAvatar = document.getElementById('userAvatar')
  var $post = document.getElementById('post')
  var $postContent = document.getElementById('postContent')
  var $postDate = document.getElementById('postDate')
  var $editor = document.getElementById('editor')
  var $authorAccount = document.getElementById('authorAccount')
  var $authorIcon = document.getElementById('authorIcon')

  var userId
  var authorId
  var twitterAccount
  var postId
  var addNewAfterLogin
  var postRef
  var onPostValue
  var quill

// UTILITY
  function getParameterByName (name, url) {
    if (!url) {
      url = window.location.href
    }
    name = name.replace(/[[\]]/g, '\\$&')
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
    var results = regex.exec(url)
    if (!results) return null
    if (!results[2]) return ''
    return decodeURIComponent(results[2].replace(/\+/g, ' '))
  }

  function display (property, el) {
    if (!Array.isArray(el)) {
      el = [el]
    }
    for (var i = 0; i < el.length; i++) {
      el[i].style.display = property
    }
  }

// AUTHENTICATION CONTROLL
  function logout () {
    firebase.auth().signOut()
  }

  function login () {
    var provider = new firebase.auth.TwitterAuthProvider()
    firebase.auth().signInWithPopup(provider)
  }

// SHOW & HIDE ELEMENTS
  function showPost () {
    var hideList = [$editor, $saveBtn]

    if (authorId === userId && authorId && userId) {
      display('inline', [$editBtn, $delBtn])
    } else {
      hideList.push($editBtn)
      hideList.push($delBtn)
    }
    display('block', $post)
    display('inline', $addBtn)
    display('none', hideList)
  }

  function showBlank (msg) {
    display('none', [$post, $editor, $editBtn, $delBtn])
    if (msg) {
      $postContent.innerHTML = msg
      display('block', $post)
    }
  }

  function addNewPost () {
    display('none', [$post, $editBtn, $delBtn, $addBtn])
    display('block', $editor)
    display('inline', $saveBtn)
    quill.setText('')
    postId = twitterAccount + Date.now()
    window.history.pushState(null, null, window.location.pathname + '?post=' + postId)
    postRef = firebase.database().ref('posts/' + tweetId + '/transcript/' + postId)
    onPostValue = postRef.on('value', function (snapshot) {
      var value = snapshot.val()
      authorId = value.user_id
      $postContent.innerHTML = value.content
      if (value.lastedit) {
        $postDate.innerHTML = 'Edited on ' + (new Date(value.lastedit)).toISOString().substring(0, 10)
      }
      updateAuthorInfo(value.twitter_account)
    })
    postRef.set({
      user_id: userId,
      twitter_account: twitterAccount
    })
  }

  function editPost () {
    display('block', $editor)
    display('inline', $saveBtn)
    display('none', [$post, $editBtn, $delBtn, $addBtn])
    quill.setText('')
    quill.clipboard.dangerouslyPasteHTML(0, $postContent.innerHTML)
  }

  function deletePost () {
    display('none', $delModal)
    $delYesBtn.removeEventListener('click', deletePost, false)
    $delNoBtn.removeEventListener('click', cancelDeletePost, false)
    postRef.off('value', onPostValue)
    postRef.remove()
    window.history.replaceState(null, null, window.location.pathname)
    showBlank()
  }

  function cancelDeletePost () {
    display('none', $delModal)
    display('inline', $delBtn)
    $delYesBtn.removeEventListener('click', deletePost, false)
    $delNoBtn.removeEventListener('click', cancelDeletePost, false)
  }

// DATABASE CALL
  function updateAuthorInfo (twitterAccount) {
    firebase.database()
      .ref('users/' + twitterAccount)
      .once('value', function (snapshot) {
        var user = snapshot.val()
        if (user) {
          $authorAccount.innerHTML = 'Post by <a href="https://twitter.com/' + user.screen_name + '" title="auther twitter page">@' + user.screen_name + '</a>'
          $authorIcon.src = user.profile_image_url
          display('inline', $authorIcon)
        } else {
          $authorAccount.innerText = ''
          $authorIcon.src = ''
          display('none', $authorIcon)
        }
      })
  }

  function initializeContent () {
    postId = getParameterByName('post')
    if (postId) {
      postRef = firebase.database().ref('posts/' + tweetId + '/transcript/' + postId)
      onPostValue = postRef.on('value', function (snapshot) {
        var value = snapshot.val()
        if (!value) {
          return showBlank('Sorry, could not find the post you are looking for.')
        }
        updateAuthorInfo(value.twitter_account)
        authorId = value.user_id
        $postContent.innerHTML = value.content || ''
        if (value.lastedit) {
          $postDate.innerHTML = 'Edited on ' + (new Date(value.lastedit)).toISOString().substring(0, 10)
        }
        showPost()
      })
    } else {
      showBlank()
    }
  }

// START UP
  quill = new Quill('#quill', {
    modules: {
      toolbar: '#toolbar'
    },
    placeholder: 'Write your post here',
    theme: 'snow'
  })

  firebase.initializeApp(config)
  firebase.auth().onAuthStateChanged(function (user) {
    if (user) { // logged in
      userId = user.uid
      twitterAccount = user.providerData[0].uid

      $authBtn.innerText = 'Sign Out'
      $userAvatar.src = user.photoURL
      display('inline', $userAvatar)
      $authBtn.onclick = logout

      var request = new XMLHttpRequest()
      request.open('POST', '/api/adduser/' + twitterAccount, true)
      request.send()

      if (authorId === userId) {
        showPost()
      }
      if (addNewAfterLogin) {
        addNewAfterLogin = false
        addNewPost()
      }
    } else { // logged out
      userId = undefined
      twitterAccount = undefined
      $authBtn.innerText = 'Sign in with Twitter'
      $userAvatar.src = ''
      display('none', $userAvatar)
      $authBtn.onclick = login
      showPost()
    }
  })

  initializeContent() // fill contents

// CLICK EVENTS
  $addBtn.addEventListener('click', function () {
    if (!userId) {
      addNewAfterLogin = true
      return login()
    }
    return addNewPost()
  }, false)

  $editBtn.addEventListener('click', function () {
    editPost()
  }, false)

  $delBtn.addEventListener('click', function () {
    display('none', $delBtn)
    display('inline', $delModal)
    $delYesBtn.addEventListener('click', deletePost, false)
    $delNoBtn.addEventListener('click', cancelDeletePost, false)
  }, false)

  $saveBtn.addEventListener('click', function () {
    postRef
      .set({
        user_id: userId,
        twitter_account: twitterAccount,
        content: quill.container.firstChild.innerHTML,
        lastedit: Date.now()
      })
      .then(function () {
        showPost()
      })
      .catch(function () {
        console.log('post save error')
      })
  }, false)

  window.addEventListener('popstate', function (event) {
    initializeContent()
  }, false)

})()
