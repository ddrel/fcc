//Module dependencies.
const express = require('express');
const cookie = require('cookie');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const bodyParser = require('body-parser');
const errorHandler = require('errorhandler');
const dotenv = require('dotenv');
const MongoStore = require('connect-mongo')(session);
const path = require('path');
const mongoose = require('mongoose');
const passport = require('passport');
const swig = require('swig');
const expressValidator = require('express-validator');
const methodOverride = require('method-override');
const fs=require("fs");
const walk    = require('walk');
const flash = require('express-flash');

const MemoryStore = session.MemoryStore;
const store = new MemoryStore();


dotenv.load({ path: '.env' });

const app = express();

mongoose.connect(process.env.MONGODB_DEV  || process.env.MONGODB_LOCAL);
mongoose.connection.on('error', function() {
  console.log('MongoDB Connection Error. Please make sure that MongoDB is running.');
  process.exit(1);
});

app.setMultiView = (viewpath) =>{
    const viewDirs = app.get('views');
      if( typeof viewDirs.push == 'undefined'){
         app.set('views',[viewpath]);
      }else{
         viewDirs.push(viewpath);
      }
      return viewDirs;
}





/**
 * Express configuration.
 */
swig.setDefaults({
   varControls: ['<%=', '%>'] 
});


app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.engine('html', swig.renderFile);
app.set('view engine', 'html');


// /MONGODB_DEV=mongodb://169.44.127.231:27017/fcc  --Bluemix container

console.log("Mongo Connection");
console.log(process.env.MONGODB_DEV  || process.env.MONGODB_LOCAL);
console.log("------------------------------------------------------")
//expose session store for the socketIO
var SessionStore = new MongoStore({
    url:  process.env.MONGODB_DEV  || process.env.MONGODB_LOCAL,
    autoReconnect: true
  })

app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: process.env.SESSION_SECRET,
  key:'fcc.sid',
  store: SessionStore
}));

app.use(bodyParser.json({limit: '1000024mb'}));
app.use(bodyParser.urlencoded({limit: '1000024mb', extended: true}));
app.use(cookieParser());
app.use(expressValidator());
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride());
app.use(flash());


/**
 * API keys and Passport configuration.
 */
var passportConf = require('./passport/passport')(passport);

app.use(function(req, res, next) {
  res.locals.user = req.user;
  next();
});


options = {
  followLinks: false,
    listeners: {      
     directories:  (root, dirStatsArray, next)=> {
        dirStatsArray.forEach( (n) => {
            if(n.name.toLowerCase()=="public"){
                var ppath = __dirname + "/" + path.join(root, n.name);
                var rpath = root.replace(process.env.MODULE_PATH,"").replace("/","");
                rpath = rpath.indexOf("\\")>-1?rpath.replace("\\","/") : ("/" + rpath);
                app.use(rpath, express.static(ppath, { maxAge: 0 })); 
            }
            else if(n.name.toLowerCase().indexOf("view")>-1 && root.indexOf("public")==-1){
                var initpath = root + "/init.js";
                app.setMultiView( root + '/views');
            }else if(n.name.toLowerCase().indexOf("model")>-1 && root.indexOf("public")==-1){
                var _path = "./" + path.join(root, n.name);
                fs.readdirSync(_path).forEach(function(file) {
                    var modelpath=_path + "/" + file;
                    require( modelpath );
                });
            }else if(n.name.toLowerCase().indexOf("service")>-1 && root.indexOf("public")==-1){
                var _path = "./" + path.join(root, n.name);
                fs.readdirSync(_path).forEach(function(file) {
                    var modelpath=_path + "/" + file;
                    require(modelpath)(app,passport);
                });    
            }else if(n.name.toLowerCase().indexOf("route")>-1 && root.indexOf("public")==-1){
                var _path = "./" +  path.join(root, n.name);
                fs.readdirSync(_path).forEach(function(file) {
                    var modelpath=_path + "/" + file;
                    require(modelpath)(app,passport);
                });
            }
        });
        next();
      }
    
    }
  }
walk.walkSync(process.env.MODULE_PATH, options);

app.use(express.static(path.join(__dirname, 'public'), { maxAge: 31557600000 }));
app.use('/bower_components', express.static(__dirname + '/bower_components'));
/*
app.listen(app.get('port'), ()=> {
  console.log('Express server listening on port %d in %s mode', app.get('port'), app.get('env'));
});
*/

//init Socket
const wsserver =  require('http').Server(app); //require('http').createServer()
require('./socket/socket')(wsserver,SessionStore);
 //var host = (process.env.VCAP_APP_HOST || 'localhost');
var port = (process.env.VCAP_APP_PORT || 3000);
wsserver.listen(port);
console.log("Server listining on port " + port + " in " + app.get('env'));
//function () { console.log('Server  listening on port %d in %s mode', wsserver.address().port,"development")}
module.exports = app;


