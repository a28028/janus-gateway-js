describe('Audiobridge tests', function() {
  var janusConnection;
  var janusSession;
  var audiobridgePlugin;

  function randomRoomId() {
    return Math.floor(Math.random() * 1000 + 1);
  }

  before(function(done) {
    $('#mocha').append('<audio id="audio" autoplay></audio>');

    jQuery.getJSON('./config.json')
      .then(function(config) {
        var janus = new Janus.Client(config.url, config);
        return janus.createConnection('client');
      })
      .then(function(connection) {
        janusConnection = connection;
        return connection.createSession();
      })
      .then(function(session) {
        janusSession = session;
        done();
      });
  });

  after(function(done) {
    janusSession.destroy()
      .then(function() {
        return janusConnection.close();
      })
      .then(done);
  });

  beforeEach(function(done) {
    janusSession.attachPlugin(Janus.AudiobridgePlugin.NAME)
      .then(function(plugin) {
        audiobridgePlugin = plugin;
        done();
      });
  });

  afterEach(function(done) {
    audiobridgePlugin.detach().then(done);
  });

  it('creates, connects, lists', function(done) {
    var roomId = randomRoomId();
    audiobridgePlugin.create(roomId)
      .then(function(response) {
        assert.equal(response['audiobridge'], 'created');
        return audiobridgePlugin.join(roomId);
      })
      .then(function(response) {
        assert.equal(response['plugindata']['data']['audiobridge'], 'joined');
        return audiobridgePlugin.list();
      })
      .then(function(rooms) {
        var createdRoom = jQuery.grep(rooms, function(room) {
          return room.room == roomId;
        });
        assert.equal(createdRoom.length, 1);
        done();
      });
  });

  it('lists participants', function(done) {
    var roomId = randomRoomId();
    audiobridgePlugin.create(roomId)
      .then(function() {
        return audiobridgePlugin.connect(roomId);
      })
      .then(function() {
        return audiobridgePlugin.listParticipants(roomId);
      })
      .then(function(participants) {
        assert.equal(participants.length, 1);
        done();
      });
  });

  it('changes room when connect', function(done) {
    var roomId1 = randomRoomId();
    var roomId2 = randomRoomId();
    audiobridgePlugin.create(roomId1)
      .then(function() {
        return audiobridgePlugin.create(roomId2);
      })
      .then(function() {
        return audiobridgePlugin.connect(roomId1);
      })
      .then(function() {
        return audiobridgePlugin.connect(roomId2);
      })
      .then(function(response) {
        assert.equal(response['plugindata']['data']['audiobridge'], 'roomchanged');
        done();
      });
  });

  it('starts media streaming', function(done) {
    var roomId = randomRoomId();

    var audio = document.getElementById('audio');
    audio.addEventListener('playing', function() {
      done();
    });

    audiobridgePlugin.on('pc:addstream', function(event) {
      assert(event.stream);
      Janus.webrtc.browserShim.attachMediaStream(audio, event.stream);
    });

    audiobridgePlugin.create(roomId)
      .then(function() {
        return audiobridgePlugin.connect(roomId);
      })
      .then(function() {
        return audiobridgePlugin.startMediaStreaming({muted: false});
      });
  });

  it('stops media on detach', function(done) {
    var roomId = randomRoomId();
    var pc;

    audiobridgePlugin.create(roomId)
      .then(function() {
        return audiobridgePlugin.connect(roomId);
      })
      .then(function() {
        return audiobridgePlugin.startMediaStreaming({muted: false});
      })
      .delay(1000)
      .then(function() {
        pc = audiobridgePlugin._pc;
        var localStreams = pc.getLocalStreams();
        assert.strictEqual(localStreams.length, 1);
        assert.strictEqual(localStreams[0].active, true);

        return audiobridgePlugin.detach();
      })
      .then(function() {
        assert.strictEqual(pc.getLocalStreams()[0].active, false);
        done();
      });
  });

});