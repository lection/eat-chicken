'use strict';
const _ = require('lodash');
const randomHexColor = require('random-hex-color');

const DEFAULT_OPTIONS = {
    'user_width': 20,
    'move_instance': 10,
    'shoot_interval': 5,
    'shoot_instance': 20,
    'wait_shrink_steps': 100,
    'shrink_steps': 20,
};

function Manager(opts) {
    this.opts = _.assign({}, DEFAULT_OPTIONS, opts);
    this.init();
};

Manager.prototype.init = function () {
    this.status = 0; //准备:0 开始:1 暂停:2 结束:-1
    this.count = 0;
    this.users = {};
    this.bullets = [];
    this.area = {startX: 0, startY:0, endX: 1000, endY: 600};
    this.moveActions = {};
    this.shootActions = {};

    this.shrinkSteps = this.opts.wait_shrink_steps;
    this.shrinked = false;

    this.seats = [];
    for(let i=0;i<10;i++) {
        for(let j=0;j<6;j++) {
            this.seats.push({x: i*100+50 - this.opts.user_width/2, y: j*100+50 - this.opts.user_width/2});
        }
    }
    this.seats = _.shuffle(this.seats);
};

Manager.prototype.register = function(name) {
    if(this.status != 0) {
        throw Error('比赛开始');
    }
    if(this.seats.length == 0) {
        throw Error('人满了');
    }
    if(!name) {
        throw Error('没写名');
    }
    name = name.substring(0, 3);
    name = name.replace('于经文', '吴彦祖').replace('经文', '彦祖');
    if(this.users[name]) {
        throw Error('重名了');
    }
    let seat = this.seats.shift();
    let user = {name: name, color: randomHexColor(), x: seat.x, y: seat.y, alive: true, shootCD: 0};
    this.users[user.name] = user;
    this.count ++;
    return user;
};

Manager.prototype.exit = function(name) {
    let user = this.users[name];
    if(!user) {
        return;
    }
    if(this.status == 0) {
        delete this.users[name];
        this.count --;
        this.seats.push({x: user.x, y: user.y});
    }else {
        user.alive = false;
    }
};

Manager.prototype.move = function(name, angle) {
    if(!this.users[name])return;
    this.moveActions[name] = parseFloat(angle) || 0;
};

Manager.prototype.shoot = function(name, angle) {
    if(!this.users[name])return;
    this.shootActions[name] = parseFloat(angle) || 0;
};

Manager.prototype.start = function () {
    this.status = 1;
};

Manager.prototype.stop = function () {
    this.status = 2;
};

Manager.prototype.action = function() {
    if(this.status != 1) {
        return;
    }

    //缩圈
    let {startX, startY, endX, endY} = this.area;

    if(this.shrinked) {
        if((endX - startX) > 100) {
            startX += 1;
            endX -= 1;
        }
        if((endY - startY) > 100) {
            startY += 1;
            endY -= 1;
        }

        this.shrinkSteps++;
        if(this.shrinkSteps == this.opts.shrink_steps) {
            this.shrinkSteps = this.opts.wait_shrink_steps;
            this.shrinked = false;
        }

    }else {
        this.shrinkSteps--;
        if(this.shrinkSteps == 0) {
            this.shrinked = true;
        }
    }

    this.area = {startX, startY, endX, endY};

    let userEndX = endX - this.opts.user_width, userEndY = endY - this.opts.user_width;

    //移动
    _.each(this.moveActions, (angle, name) => {
        let user = this.users[name];
        if(user && user.alive) {
            let {x, y} = convert(angle, this.opts.move_instance);
            user.x += x;
            user.y += y;
        }
    });
    _.each(this.users, user => {
        if(!user.alive)return;
        if(user.x <= startX) user.x = startX + 1;
        if(user.x >= userEndX) user.x = userEndX - 1;
        if(user.y <= startY) user.y = startY + 1;
        if(user.y >= userEndY) user.y = userEndY - 1;
        user.shootCD--;
    });

    //射击
    let now = Date.now();
    _.each(this.shootActions, (angle, name) => {
        let user = this.users[name];
        if(user && user.alive && user.shootCD <= 0) {
            user.shootCD = this.opts.shoot_interval;
            let x = user.x + this.opts.user_width/2, y = user.y + this.opts.user_width/2;
            this.bullets.push({
                owner: name, x: x, y: y, color: user.color,
                startX: x, startY: y, angle: angle, finished: false
            });
            user.lastShoot = now;
            delete this.shootActions[name];
        }
    });

    //子弹
    _.each(this.bullets, bullet => {
        let {x, y} = convert(bullet.angle, this.opts.shoot_instance);
        bullet.x += x;
        bullet.y += y;

        //击中判定
        _.each(this.users, (user) => {
            if(user.name == bullet.owner || !user.alive || bullet.finished)return;
            if(
                user.x <= bullet.x && (user.x + this.opts.user_width) >= bullet.x &&
                user.y <= bullet.y && (user.y + this.opts.user_width) >= bullet.y
            ) {
                user.alive = false;
                user.murderer = bullet.owner;
                bullet.finished = true;
            }
        });

        //出界判定
        if(bullet.x <= startX || bullet.x >= endX
        || bullet.y <= startY || bullet.y >= endY) {
            bullet.finished = true;
        }
    });


    this.bullets = _.filter(this.bullets, b => !b.finished);
    this.moveActions = {};
};

Manager.prototype.getGameInfo = function () {
    return {
        status: this.status,
        count: this.count,
        users: _.values(this.users),
        bullets: this.bullets,
        area: this.area
    };
};

function convert(angle, instance) {
    return {x: Math.sin(angle) * instance, y: ((angle<Math.PI/2 || angle>Math.PI*3/2)?-1:1) * Math.abs(Math.cos(angle)) * instance};
}

module.exports = Manager;
