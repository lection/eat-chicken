'use strict';

const io = require('socket.io')();
const GameManager = require('../core/GameManager');

let manager = new GameManager();
let userMap = new Map();

let count = 0;
io.on('connection', function (socket) {
    console.log('connect', ++count);
    socket.emit('info', manager.getGameInfo());

    socket.on('disconnect', function () {
        console.log('disconnect', --count);
        let user = userMap.get(socket);
        if(user) {
            console.log('exit', user.name);
            manager.exit(user.name);
            io.emit('info', manager.getGameInfo());
        }
    });

    socket.on('register', function (name, fn) {
        try {
            let user = manager.register(name);
            userMap.set(socket, user);
            console.log('register', user.name);
            fn && fn({status: 'ok', info: manager.getGameInfo()});
            io.emit('info', manager.getGameInfo());
        }catch (e) {
            fn && fn({status: 'error', message: e.message});
            console.log('error', e.message);
        }
    });

    socket.on('move', function (angle) {
        let user = userMap.get(socket);
        if(!user)return;
        manager.move(user.name, angle);
    });

    socket.on('shoot', function (angle) {
        let user = userMap.get(socket);
        if(!user)return;
        manager.shoot(user.name, angle);
    });

    let si;
    socket.on('start', function () {
        if(!si) {
            manager.start();
            si = setInterval(function () {
                manager.action();
                io.emit('info', manager.getGameInfo());
            }, 200);
        }
    });

    function stop() {
        if(si) {
            manager.stop();
            io.emit('stop', Date.now());
            clearInterval(si);
            si = null;
        }
    }

    socket.on('stop', stop);

    socket.on('rebuild', function (data) {
        console.log('rebuild');
        stop();
        for(let socket of userMap.keys()) {
            socket.emit('close', Date.now());
        };
        userMap.clear();
        manager.init();
        io.emit('rebuild', Date.now());
    });

});


io.listen(8008);
