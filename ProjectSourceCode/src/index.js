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
const { error } = require('console');

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

// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************

app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});

// when navigating to website, redirect to home
app.get('/',(req,res) => {
    res.status(200).redirect('/home');
})

// GET home
app.get('/home',(req,res) => {
  if(!req.session.user)
  {
    // TODO: if a session user does not exist, get random plants from API 

    // currently, just pass an empty list of plants
    res.status(200).render('pages/home',{plants: []});
  }
  else
  {
    // TODO: if a session user exists, pass personalized plant reccomendations
    // TODO: check that data[0] accurately passes info to home page, once we have user plant data

    // currently, just get plants from the users garden
    let q_get_plant_recs = "SELECT * FROM plants INNER JOIN user_to_plants ON plants.plant_id = user_to_plants.plant_id INNER JOIN userInfo ON user_to_plants.user_id = userInfo.user_id LIMIT 5;";
    db.any(q_get_plant_recs)
    .then(data => {res.status(200).render('pages/home',{user: true, plants: data[0]})})
  }
})

// redirect to login
app.get('/login',(req,res) => {
  res.status(200).render('pages/login');
})

app.post('/login', async (req, res) => 
{
  console.log("attempting to log in user");
  try
  {
    console.log("finding user in users table");
      // find user from users table for req username
      let find_usr_q = "SELECT * FROM userInfo WHERE username=$1 LIMIT 1;";
      let values = [req.body.username];
      const found_user = await db.one(find_usr_q,values);

      try
      {
        // user exists, attempt to validate password
        console.log("user exists, validating password");
        const pwd_match = await bcrypt.compare(req.body.password, found_user.password);
        if(pwd_match == true)
        {
            //save user details in session
            req.session.user = found_user;
            req.session.save((err) => {
                if (err) {
                    console.log('session save error:', err);
                    res.status(500);
                }
                else
                {
                    res.status(200).redirect('/home');
                    console.log("successful login");                      
                }
            })
        }
        else 
        {
          throw new Error('password is incorrect')
        }
      }
      catch (err)
      {
        console.log("incorrect password");
        res.status(409).render('pages/login',{message:"Password is incorrect. Please try again."});
      }
      
  }
  catch(err)
  {
      console.log(err);
      res.status(404).render('pages/login',{message:"User does not exist. Please try again."});
  }
});

// GET register
app.get('/register',(req,res) => {
  res.status(200).render('pages/register');
})

// POST register - register user into database
app.post('/register', async (req, res) => {
  console.log("attempting to register user");
  try
  {
    // does the password field match the confirm password field?
    if(req.body.password != req.body.cpassword)
    {
      throw new Error('password field does not match confirm password field');
    }

    try 
    { 
      console.log("determining if username is taken");
      // Is username already taken?
      let get_username_q = "SELECT * FROM userInfo WHERE username=$1 LIMIT 1;";
      let get_username_values = [req.body.username];
      const found_duplicate_username = await db.none(get_username_q, get_username_values);
      console.log("username not taken, inserting into database");

      try 
      {
        console.log("hashing password")
        //hash the password using bcrypt library 
        const hash = await bcrypt.hash(req.body.password, 10);

        console.log("adding to users table")
        // add user to users database table
        let insert_user_q = "INSERT INTO userInfo (first_name, last_name, email, username, password) VALUES ($1,$2,$3,$4,$5);";
        let insert_user_values = [req.body.first_name,req.body.last_name,req.body.email,req.body.username,hash];

        const added_user = await db.none(insert_user_q,insert_user_values);

        console.log("successfully registered")
        res.status(200).render('pages/login',{message:"Successfully registered!"})
      }
      catch
      {
        console.log("unexpected registration error")
        console.log(err);
        res.status(500).render('pages/login',{message:"Registration failed! Please try again."});
      }
    } 
    catch (err) 
    {
      console.log(err);
      console.log("username already exists")
      res.status(409).render('pages/register',{message:"That username already exists!"});
    }
  }
  catch (err)
  {
    console.log("Password field does not match confirm password field: \n password: " + req.body.password + "\nconfirm password: " + req.body.cpassword)
    console.log(err);
    res.status(409).render('pages/login',{message:"password field does not match confirm password field"});
  }
  
});

// Authentication Middleware.
const auth = (req, res, next) => 
{
    if (!req.session.user) {
        // Default to login page.
        console.log("no session user, returning to home");
        return res.redirect('home');
    }
    next();
}; 
    
// Authentication Required
app.use(auth);

app.get('/logout', async (req,res) => {
  req.session.destroy();
  res.status(200).render('pages/logout',{message:"Logged out successfully"});
})

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
  })
  .then(location => {
    res.redirect('/home', {
      message: `Successfully added location ${req.body.location_id}`,
    });
  })
  .catch(function (err){
      console.log(err)
  });
});

app.get('/plantSearch',(req,res) => {
  res.render('pages/search',{plants: []});
})

// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');
