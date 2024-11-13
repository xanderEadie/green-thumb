// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************

const express = require('express'); // To build an application server or API
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcryptjs'); //  To hash passwords
const axios = require('axios'); // To make HTTP requests from our server. We'll learn more about it in Part C.

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
});

// database configuration
const dbConfig = {
  host: 'db', // the database server
  port: 5432, // the database port
  database: process.env.POSTGRES_DB, // the database name
  user: process.env.POSTGRES_USER, // the user account to connect with
  password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);

// test your database
db.connect()
  .then(obj => {
    console.log('Database connection successful'); // you can view this message in the docker compose logs
    obj.done(); // success, release the connection;
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(__dirname + '/resources')); 
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// initialize session variables
app.use(
    session({
      secret: process.env.SESSION_SECRET,
      saveUninitialized: false,
      resave: false,
    })
);
app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});

// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************

// when navigating to website, redirect to login
app.get('/',(req,res) => {
    // if a session user exists, get personalized plant reccomendations and pass that information as json data to the home page for the carousel when rendering. If not, 
    res.render('pages/home',{plants: []});
})

app.get('/home',(req,res) => {
    res.render('pages/home',{plants: []});
})
app.get('/', (req, res) => {
  res.render('pages/register')
});

// Register
app.post('/register', async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  const name = req.body.name;
  const username = req.body.fname + req.body.lname;
  const email = req.body.email;

  db.task('register-user', task => {
      const insertUser = 'INSERT INTO userInfo (name, username, email, password) VALUES ($1, $2, $3);';
      return task.none(insertUser, [name, username, email, hash])
      .then(() => {
          res.redirect('/login');
      })
  })
  .catch(function (err){
      console.log(err)
  });
});

app.get('/login', (req, res) => {
  res.render('pages/login');
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.task('login', async (t) => {
    const user = await t.oneOrNone('SELECT * FROM users WHERE username = $1', [username]);

    if (!user) {
      res.redirect('/register');
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.render('login', { message: 'Incorrect username or password.' });
    }

    req.session.user = user;
    req.session.save(err => {
      if (err) {
        console.error('Session save error:', err);
      }
      res.redirect('/home');
    });
  })
  .catch(error => {
    console.error('Error during login:', error);
    res.render('login', { message: 'An error occurred. Please try again.' });
  });
});

app.post('/location/add', async (req, res) => {
  const avgHumidity = req.body.avgHumidity;
  const rainfall = req.body.rainfall;
  const avgTemp = req.body.avgTemp;
  const lightAmount = req.body.lightAmount;
  const elevation = req.body.elevation;

  db.task('create-location', task => {
      const insertLocation = 'INSERT INTO location (avgHumidity, rainfall, avgTemp, lightAmount, elevation) VALUES ($1, $2, $3, $4, $5) RETURNING id;';
      const location = task.one(insertLocation, [avgHumidity, rainfall, avgTemp, lightAmount, elevation]);

      const toOtherTable = 'INSERT INTO user_to_location (user_id, location_id) VALUES ($1, $2);';
      return task.none(toOtherTable, [req.session.user.student_id, location]);

      res.redirect('/home');
  })
  .catch(function (err){
      console.log(err)
  });
});

app.get('/register', (req, res) => {
  res.render('pages/register')
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.render('pages/logout');
});

// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
modeule.exports = app.listen(3000);
console.log('Server is listening on port 3000');
