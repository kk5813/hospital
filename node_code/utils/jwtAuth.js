// JWT鉴权
var express = require('express');
var app = express();
const passport = require('passport');
const query = require('../db/mysql.js');

//passport初始化
app.use(passport.initialize()); 
const JwtStrategy = require('passport-jwt').Strategy,
    ExtractJwt = require('passport-jwt').ExtractJwt;

let opts = {
    secretOrKey: "hello",
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
}

var jwtConfigAuth = new JwtStrategy(opts, (jwt_payload, done) => {
    console.log("loginer_id:", jwt_payload.UserID)
    var sql = `select * from users where UserID="${jwt_payload.UserID}"`
    query(sql, function (err, result) {
        if (err) {
            return res.end('[SELECT ERROR] - ' + err.message);
        } else {
            //console.log(result[0])
            return done(null, result[0]);
        }
    });
})

module.exports = {
    jwtConfigAuth
  };