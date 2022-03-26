const 	express 	= require('express'),
		http 		= require('http'),
		https 		= require('https'),
		bodyParser	= require('body-parser'),
		cookieParser= require('cookie-parser'),
		path		= require('path'),
		cors 		= require('cors'),
		fs          = require('fs');
		session     = require('express-session');
		pool  		= require('./common/pool');
		q  			= require('q');
		
		
// Certificate
const privateKey = fs.readFileSync('/etc/letsencrypt/live/pop.appsdashboard.xyz/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/pop.appsdashboard.xyz/cert.pem', 'utf8');
const ca = fs.readFileSync('/etc/letsencrypt/live/pop.appsdashboard.xyz/chain.pem', 'utf8');

const credentials = {
	key: privateKey,
	cert: certificate,
	ca: ca
};

    const userController 	= require('./controllers/user');
	const userModel 		= require('./model/user');
    const  FacebookStrategy  = require('passport-facebook').Strategy;
//build config from params
const config = require('./config');
//console.log("sdfsdfsdf",config);
const {https:{ key, cert}, port, isHttps, serviceName} = config;
//const credentials = {key, cert};


//setup app & its routes
const app = express();
global.app      = app;
app.use(function(req, res, next) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
});

   app.use(express.static(__dirname +''));
   app.set('views', path.join(__dirname, '/views'));
   app.set('view engine', 'ejs');
   app.use(bodyParser.json())
   app.use(bodyParser.json({limit:'50mb'}));
   app.use(bodyParser.urlencoded({ extended: false,limit:'50mb'}));
   app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
 

require('./routes/')();

  app.use(session({
    resave: false,
    saveUninitialized: true,
    secret: 'SECRET' 
  }));
/*  PASSPORT SETUP  */

const passport = require('passport');
var userProfile;

app.use(passport.initialize());
app.use(passport.session());

app.set('view engine', 'ejs');

app.get('/success', (req, res) => res.send(userProfile));
app.get('/error', (req, res) => res.send("error logging in"));

passport.serializeUser(function(user, cb) {
  cb(null, user);
});

passport.deserializeUser(function(obj, cb) {
  cb(null, obj);
});


/*  Google AUTH  */
 
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const GOOGLE_CLIENT_ID = '711338287934-aq766je5gcjmrfv2186gtf3tv87mgsct.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = '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';
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
   callbackURL: "https://pop.appsdashboard.xyz/auth/google/callback"
  },
  async function(accessToken, refreshToken, profile, done) {
      userProfile=profile;
      console.log("check google info",userProfile);      
	  
	  userController.googleUserInsertData(userProfile);	  
      return done(null, userProfile);
  }
));
 
app.get('/auth/google', passport.authenticate('google', { scope : ['profile', 'email'] })

);
 
app.get('/auth/google/callback', 
	passport.authenticate('google', { failureRedirect: '/error' }),
	async function(req, res) {
		// Successful authentication, redirect success.
		let Cats = await userModel.getAllCategories();
		let Categories = Cats.data; 		
		let providerid = userProfile.id;
		let userData = await userModel.getUserData( providerid );
		if(userData.status == false){
			res.render('user/signup', {iam : '', seeking : '', categories : Categories, providerid : providerid});
		} else {
			let top10Movies = userData.data.u_top_10_movies_by_categories;
			if( top10Movies != null){
				res.render('user/userProfile', { name: userData.data.u_name });
			} else {
				res.render('user/signup', {iam : '', seeking : '', categories : Categories, providerid : providerid});
			}
			
		}
		
	}
);
// route for logging out
app.get('/logout', function(req, res) {
  req.session.destroy(function(e){
      req.logout();
      res.redirect('/');
  });
});

/*==================   Facebook Auth ========================= */

let clientID =  "1200668257009476"; // your App ID
let clientSecret =  "179581b94ec45540824917c8b1da7e81"; // your App Secret
let callbackURL = "https://pop.appsdashboard.xyz/auth/facebook/callback";
passport.use(new FacebookStrategy({
  clientID: clientID,
  clientSecret: clientSecret,
  callbackURL: callbackURL,
  profileFields: ['id', 'displayName','email']
}, 
function (accessToken, refreshToken, profile, done) {
	userProfile=profile;
	console.log('facebook_profile_______', userProfile);
	userController.facebookUserInsertData(userProfile);
  return done(null, userProfile);
}
));
/* End Facebook Auth */
  /*  facebook routes  */

app.get('/profile', isLoggedIn,async  function (req, res) {
	// Successful authentication, redirect success.
		console.log('userProfileFacebook___________',userProfile);
		let Cats = await userModel.getAllCategories();
		let Categories = Cats.data; 	
         console.log("cat____data",Categories);		
		let providerid = userProfile.id;
		console.log("pro_id___",providerid);
		
		let userData =  await userModel.getUserData( providerid );
		if(userData.status == false){
			res.render('user/signup', {iam : '', seeking : '', categories : Categories, providerid : providerid});
		} else {
			let top10Movies = userData.data.u_top_10_movies_by_categories;
			if( top10Movies != null){
				res.render('user/userProfile', { name: userData.data.u_name });
			} else {
				res.render('user/signup', {iam : '', seeking : '', categories : Categories, providerid : providerid});
			}
			
		}

});

app.get('/error', isLoggedIn, function (req, res) {
  res.render('/error.ejs');
});

/*app.get('/auth/facebook', passport.authenticate('facebook', {
  scope: ['public_profile', 'email']
}));*/
app.get('/auth/facebook', passport.authenticate('facebook'));
app.get('/auth/facebook/callback',
	passport.authenticate('facebook', {
		successRedirect: '/profile',
		failureRedirect: '/error'
	})
);

app.get('/logout', function (req, res) {
  req.logout();
  res.redirect('/');
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
}
/*  End facebook router */
const httpServer = http.createServer(app);
httpServer.listen(port);
console.log(`[${serviceName}] http server listening at port ${port}`);


const httpsServer = https.createServer(credentials, app);
httpsServer.listen(3001);
console.log("test",`[${serviceName}] https server listening at port ${port + 1}`);



module.exports = { app };