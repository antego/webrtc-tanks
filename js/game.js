"use strict";

var EnemyTank = function (x, y, peerId, game, player, bullets) {
    this.game = game;
    this.health = 3;
    this.player = player;
    this.bullets = bullets;
    this.fireRate = 1000;
    this.nextFire = 0;
    this.alive = true;

    this.shadow = game.add.sprite(x, y, 'enemy', 'shadow');
    this.tank = game.add.sprite(x, y, 'enemy', 'tank1');
    this.turret = game.add.sprite(x, y, 'enemy', 'turret');

    this.shadow.anchor.set(0.5);
    this.tank.anchor.set(0.5);
    this.turret.anchor.set(0.3, 0.5);

    this.tank.name = peerId.toString();
    game.physics.enable(this.tank, Phaser.Physics.ARCADE);
    this.tank.body.immovable = false;
    this.tank.body.collideWorldBounds = true;
    this.tank.body.bounce.setTo(1, 1);
};

EnemyTank.prototype.damage = function() {
    this.health -= 1;

    if (this.health <= 0)
    {
        this.alive = false;

        this.shadow.kill();
        this.tank.kill();
        this.turret.kill();

        return true;
    }

    return false;
}

EnemyTank.prototype.update = function() {
    this.shadow.x = this.tank.x;
    this.shadow.y = this.tank.y;
    this.shadow.rotation = this.tank.rotation;

    this.turret.x = this.tank.x;
    this.turret.y = this.tank.y;
};

var game = new Phaser.Game(window.innerWidth, window.innerHeight, Phaser.AUTO, 'tanks', { preload: preload, create: create, update: update, render: render });

var host = 'localhost';
var port = 9000;
var peers = {};
var peer;
var myPeerId;

function preload () {

    peer = new Peer({host: host, port: port, path: '/tanks'});
    peer.on('open', function(id) {
      myPeerId = id;
      console.log('connected to server, our peer id is: ' + myPeerId);
      connectToExistingPlayers();
    });

    peer.on('connection', function(conn) {
        console.log('new connection');
        conn.on('data', function (data) {
            var type = MESSAGE_TYPE[data.type];
            if (!type) {
                console.err('unrecognised message: ' + data);
                return;
            }
            handle(type, data);
        });
        conn.on('close', function () {
            console.log('connection closed');
        });
    });

    game.load.atlas('tank', 'assets/tanks.png', 'assets/tanks.json');
    game.load.atlas('enemy', 'assets/enemy-tanks.png', 'assets/tanks.json');
    game.load.image('logo', 'assets/logo.png');
    game.load.image('bullet', 'assets/bullet.png');
    game.load.image('earth', 'assets/scorched_earth.png');
    game.load.spritesheet('kaboom', 'assets/explosion.png', 64, 64, 23);

}

function connectToPlayer (id) {
    if (!_.has(peers, id)) {
        peers[id] = peer.connect(id);
    }
    sendToPeer(id, MESSAGE_TYPE.HELLO);
    console.log('connecting to peer ' + id);
}

function connectToExistingPlayers () {
    $.getJSON(window.location.protocol + '//' + host + ':' + port + '/tanks/peerjs/peers', function (ps) {
        _.each(ps, function (p) {
            if (p === myPeerId) {
                return; // dont connect to self
            }
            connectToPlayer(p);
        });
    });
}

var land;

var shadow;
var tank;
var turret;

var enemies = [];
var enemyBullets;
var enemiesTotal = 0;
var enemiesAlive = 0;
var explosions;

var logo;

var currentSpeed = 0;
var cursors;

var bullets;
var fireRate = 100;
var nextFire = 0;

function create () {

    //  Resize our game world to be a 2000 x 2000 square
    game.world.setBounds(-1000, -1000, 2000, 2000);

    //  Our tiled scrolling background
    land = game.add.tileSprite(0, 0, game.width, game.height, 'earth');
    land.fixedToCamera = true;

    //  The base of our tank
    tank = game.add.sprite(0, 0, 'tank', 'tank1');
    tank.anchor.setTo(0.5, 0.5);
    tank.animations.add('move', ['tank1', 'tank2', 'tank3', 'tank4', 'tank5', 'tank6'], 20, true);

    //  This will force it to decelerate and limit its speed
    game.physics.enable(tank, Phaser.Physics.ARCADE);
    tank.body.drag.set(0.2);
    tank.body.maxVelocity.setTo(400, 400);
    tank.body.collideWorldBounds = true;

    //  Finally the turret that we place on-top of the tank body
    turret = game.add.sprite(0, 0, 'tank', 'turret');
    turret.anchor.setTo(0.3, 0.5);

    //  The enemies bullet group
    enemyBullets = game.add.group();
    enemyBullets.enableBody = true;
    enemyBullets.physicsBodyType = Phaser.Physics.ARCADE;
    enemyBullets.createMultiple(100, 'bullet');

    enemyBullets.setAll('anchor.x', 0.5);
    enemyBullets.setAll('anchor.y', 0.5);
    enemyBullets.setAll('outOfBoundsKill', true);
    enemyBullets.setAll('checkWorldBounds', true);

    //  A shadow below our tank
    shadow = game.add.sprite(0, 0, 'tank', 'shadow');
    shadow.anchor.setTo(0.5, 0.5);

    //  Our bullet group
    bullets = game.add.group();
    bullets.enableBody = true;
    bullets.physicsBodyType = Phaser.Physics.ARCADE;
    bullets.createMultiple(30, 'bullet', 0, false);
    bullets.setAll('anchor.x', 0.5);
    bullets.setAll('anchor.y', 0.5);
    bullets.setAll('outOfBoundsKill', true);
    bullets.setAll('checkWorldBounds', true);

    //  Explosion pool
    explosions = game.add.group();

    for (var i = 0; i < 10; i++)
    {
        var explosionAnimation = explosions.create(0, 0, 'kaboom', [0], false);
        explosionAnimation.anchor.setTo(0.5, 0.5);
        explosionAnimation.animations.add('kaboom');
    }

    tank.bringToTop();
    turret.bringToTop();

    logo = game.add.sprite((game.width - 800) / 2, 200, 'logo');
    logo.fixedToCamera = true;

    game.input.onDown.add(removeLogo, this);

    game.camera.follow(tank);
    game.camera.deadzone = new Phaser.Rectangle(150, 150, 500, 300);
    game.camera.focusOnXY(0, 0);

    cursors = game.input.keyboard.createCursorKeys();

}

function removeLogo () {

    game.input.onDown.remove(removeLogo, this);
    logo.kill();

}

var MESSAGE_TYPE = {
    HELLO: 'HELLO',
    POSITION: 'POSITION',
    FIRE: 'FIRE'
};

function broadcast(messageType, data) {
    _.each(peers, function(peer) {
        peer.send(_.extend(data, {
            id: myPeerId,
            type: messageType
        }));
    });
}

function sendToPeer(id, messageType, data) {
    var peer = peers[id];
    if (peer == null) {
        console.log('unrecognised peer id: ' + id);
    }
    peer.send(_.extend(data, {
        id: myPeerId,
        type: messageType
    }));
}

function broadcastPosition () {
    broadcast(MESSAGE_TYPE.POSITION, {
        x: tank.x,
        y: tank.y,
        angle: tank.angle,
        turretAngle: turret.angle
    });
}

function broadcastHello () {
    broadcast(MESSAGE_TYPE.HELLO);
}

function broadcastFire () {
    broadcast(MESSAGE_TYPE.FIRE);
}

// opposite of broadcast
function handle(messageType, data) {
    if (messageType === MESSAGE_TYPE.HELLO) {
        handleHello(data);
    }
    else if (messageType === MESSAGE_TYPE.POSITION) {
        handlePosition(data);
    } else if (messageType === MESSAGE_TYPE.FIRE) {
        handleFire(data);
    }
}

function handleHello (data) {
    console.log('hello from: ' + data.id);
    connectToPlayer(data.id);
}

function handlePosition (data) {
    var target = _.find(enemies, function (enemy) { return enemy.name == data.name; });
    if (target) {
        target.tank.x = data.x;
        target.tank.y = data.y;
        target.tank.angle = data.angle;
        target.turret.angle = data.turretAngle;
    } else {
        enemies.push(new EnemyTank(data.x, data.y, data.id, game, tank, enemyBullets));
    }
}

function handleFire (data) {
    var target = _.find(enemies, function (enemy) { return enemy.name == data.name; });
    if (target) {
        var bullet = this.bullets.getFirstDead();
        bullet.reset(target.tank.x, target.tank.y);
        bullet.rotation = this.game.physics.arcade.moveToObject(bullet, target.turret, 500);
    }
}

function update () {

    game.physics.arcade.overlap(enemyBullets, tank, bulletHitPlayer, null, this);

    enemiesAlive = 0;

    for (var i = 0; i < enemies.length; i++)
    {
        if (enemies[i].alive)
        {
            enemiesAlive++;
            enemies[i].update();
        }
    }

    if (cursors.left.isDown)
    {
        tank.angle -= 4;
    }
    else if (cursors.right.isDown)
    {
        tank.angle += 4;
    }

    if (cursors.up.isDown)
    {
        //  The speed we'll travel at
        currentSpeed = 300;
    }
    else
    {
        if (currentSpeed > 0)
        {
            currentSpeed -= 4;
        }
    }

    if (currentSpeed > 0)
    {
        game.physics.arcade.velocityFromRotation(tank.rotation, currentSpeed, tank.body.velocity);
    }

    land.tilePosition.x = -game.camera.x;
    land.tilePosition.y = -game.camera.y;

    //  Position all the parts and align rotations
    shadow.x = tank.x;
    shadow.y = tank.y;
    shadow.rotation = tank.rotation;

    turret.x = tank.x;
    turret.y = tank.y;

    turret.rotation = game.physics.arcade.angleToPointer(turret);

    if (game.input.activePointer.isDown)
    {
        //  Boom!
        fire();
    }

    broadcastPosition ();

}

function bulletHitPlayer (tank, bullet) {

    bullet.kill();

}

// function bulletHitEnemy (tank, bullet) {

//     bullet.kill();

//     var destroyed = enemies[tank.name].damage();

//     if (destroyed)
//     {
//         var explosionAnimation = explosions.getFirstExists(false);
//         explosionAnimation.reset(tank.x, tank.y);
//         explosionAnimation.play('kaboom', 30, false, true);
//     }

// }

function fire () {

    if (game.time.now > nextFire && bullets.countDead() > 0)
    {
        nextFire = game.time.now + fireRate;

        var bullet = bullets.getFirstExists(false);

        bullet.reset(turret.x, turret.y);

        bullet.rotation = game.physics.arcade.moveToPointer(bullet, 1000, game.input.activePointer, 500);

        broadcastFire();
    }

}

function render () {

    // game.debug.text('Active Bullets: ' + bullets.countLiving() + ' / ' + bullets.length, 32, 32);
    game.debug.text('Enemies: ' + enemiesAlive + ' / ' + enemiesTotal, 32, 32);

}
